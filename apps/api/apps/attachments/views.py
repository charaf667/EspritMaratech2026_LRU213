import os
import uuid

from django.conf import settings
from django.http import FileResponse
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.audit.utils import log_action

from .models import Attachment
from .serializers import AttachmentReadSerializer, AttachmentUploadSerializer

# Storage directory for uploads
UPLOAD_DIR = os.path.join(settings.BASE_DIR, "uploads")


class AttachmentViewSet(viewsets.ModelViewSet):
    """
    POST   /api/attachments/  — multipart upload
    GET    /api/attachments/   — list (filter by owner_type + owner_id)
    DELETE /api/attachments/{id}/ — soft delete (owner or admin)
    GET    /api/attachments/{id}/download/ — download file
    """

    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]
    serializer_class = AttachmentReadSerializer

    def get_queryset(self):
        qs = Attachment.objects.filter(deleted_at__isnull=True)

        owner_type = self.request.query_params.get("owner_type")
        owner_id = self.request.query_params.get("owner_id")
        if owner_type and owner_id:
            qs = qs.filter(owner_type=owner_type, owner_id=owner_id)

        return qs.order_by("-created_at")

    def create(self, request, *args, **kwargs):
        serializer = AttachmentUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        f = serializer.validated_data["file"]
        owner_type = serializer.validated_data["owner_type"]
        owner_id = serializer.validated_data["owner_id"]

        # Save file to disk
        ext = os.path.splitext(f.name)[1]
        filename = f"{uuid.uuid4()}{ext}"
        subdir = os.path.join(UPLOAD_DIR, owner_type, str(owner_id))
        os.makedirs(subdir, exist_ok=True)
        filepath = os.path.join(subdir, filename)

        with open(filepath, "wb") as dest:
            for chunk in f.chunks():
                dest.write(chunk)

        attachment = Attachment.objects.create(
            owner_type=owner_type,
            owner_id=owner_id,
            uploaded_by=request.user,
            mime_type=f.content_type,
            original_filename=f.name,
            storage_path=filepath,
            size_bytes=f.size,
        )

        log_action(
            actor=request.user,
            action="create",
            entity_type="attachment",
            entity_id=attachment.pk,
            meta={"filename": f.name, "mime_type": f.content_type, "size": f.size},
        )

        return Response(
            AttachmentReadSerializer(attachment).data,
            status=status.HTTP_201_CREATED,
        )

    def destroy(self, request, *args, **kwargs):
        attachment = self.get_object()

        # RBAC: only uploader or admin can delete
        if request.user != attachment.uploaded_by and request.user.role != "admin":
            return Response(
                {"detail": "Not allowed."},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Soft delete
        attachment.deleted_at = timezone.now()
        attachment.save(update_fields=["deleted_at"])

        log_action(
            actor=request.user,
            action="delete",
            entity_type="attachment",
            entity_id=attachment.pk,
        )

        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["get"])
    def download(self, request, pk=None):
        """
        GET /api/attachments/{id}/download/
        Serve the file with Content-Disposition: attachment.
        RBAC: uploader or admin.
        """
        attachment = self.get_object()

        # RBAC check
        if request.user != attachment.uploaded_by and request.user.role != "admin":
            return Response(
                {"detail": "Not allowed."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if not os.path.isfile(attachment.storage_path):
            return Response(
                {"detail": "File not found on disk."},
                status=status.HTTP_404_NOT_FOUND,
            )

        log_action(
            actor=request.user,
            action="download",
            entity_type="attachment",
            entity_id=attachment.pk,
        )

        return FileResponse(
            open(attachment.storage_path, "rb"),
            content_type=attachment.mime_type,
            as_attachment=True,
            filename=attachment.original_filename,
        )
