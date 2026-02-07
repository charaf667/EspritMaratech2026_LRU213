import os
import re

from rest_framework import serializers

from .models import Attachment

ALLOWED_MIME_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/pdf",
}
MAX_ATTACHMENTS_PER_VISIT = 3
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB

# Magic bytes → MIME type mapping
_MAGIC_SIGNATURES = {
    b"\xff\xd8\xff": "image/jpeg",
    b"\x89PNG\r\n\x1a\n": "image/png",
    b"RIFF": "image/webp",  # WebP starts with RIFF....WEBP
    b"%PDF": "application/pdf",
}


def _detect_mime_from_bytes(header: bytes) -> str | None:
    """Detect MIME type from file header bytes."""
    for sig, mime in _MAGIC_SIGNATURES.items():
        if header.startswith(sig):
            # WebP needs further check: RIFF....WEBP
            if sig == b"RIFF" and b"WEBP" not in header[:16]:
                continue
            return mime
    # Try python-magic as fallback
    try:
        import magic
        return magic.from_buffer(header, mime=True)
    except Exception:
        return None


def _sanitize_filename(name: str) -> str:
    """
    Sanitize filename: strip path separators, null bytes, limit length.
    """
    # Remove null bytes
    name = name.replace("\x00", "")
    # Take only the basename (strip any path components)
    name = os.path.basename(name)
    # Remove any remaining path separators
    name = re.sub(r'[/\\]', '_', name)
    # Limit to 255 chars
    if len(name) > 255:
        base, ext = os.path.splitext(name)
        name = base[:255 - len(ext)] + ext
    # Fallback if empty
    if not name:
        name = "attachment"
    return name


class AttachmentReadSerializer(serializers.ModelSerializer):
    class Meta:
        model = Attachment
        fields = (
            "id",
            "owner_type",
            "owner_id",
            "mime_type",
            "original_filename",
            "size_bytes",
            "created_at",
        )


class AttachmentUploadSerializer(serializers.Serializer):
    """Multipart upload: file + owner_type + owner_id."""

    file = serializers.FileField()
    owner_type = serializers.ChoiceField(choices=Attachment.OwnerType.choices)
    owner_id = serializers.UUIDField()

    def validate_file(self, f):
        # Check declared MIME type
        if f.content_type not in ALLOWED_MIME_TYPES:
            raise serializers.ValidationError(
                f"File type '{f.content_type}' not allowed. "
                f"Allowed: {', '.join(sorted(ALLOWED_MIME_TYPES))}"
            )
        if f.size > MAX_FILE_SIZE:
            raise serializers.ValidationError(
                f"File size {f.size} bytes exceeds maximum of {MAX_FILE_SIZE} bytes (5 MB)."
            )

        # Magic byte verification: read header and verify actual content matches
        header = f.read(2048)
        f.seek(0)  # Reset for subsequent reads

        detected_mime = _detect_mime_from_bytes(header)
        if detected_mime and detected_mime != f.content_type:
            raise serializers.ValidationError(
                f"File content ({detected_mime}) does not match declared type ({f.content_type})."
            )

        # Sanitize filename
        f.name = _sanitize_filename(f.name)

        return f

    def validate(self, data):
        # Check max attachments per owner
        owner_type = data["owner_type"]
        owner_id = data["owner_id"]
        existing = Attachment.objects.filter(
            owner_type=owner_type,
            owner_id=owner_id,
            deleted_at__isnull=True,
        ).count()
        if existing >= MAX_ATTACHMENTS_PER_VISIT:
            raise serializers.ValidationError(
                f"Maximum {MAX_ATTACHMENTS_PER_VISIT} attachments per {owner_type}."
            )
        return data
