from django.conf import settings
from django.db import models

from apps.common.models import UUIDModel


class Attachment(UUIDModel):
    """
    File attachment with manual generic FK (owner_type + owner_id).
    Supports soft delete via deleted_at.
    """

    class OwnerType(models.TextChoices):
        VISIT = "visit", "Visit"
        COMPLAINT_MESSAGE = "complaint_message", "Complaint Message"
        EMERGENCY_INCIDENT = "emergency_incident", "Emergency Incident"

    owner_type = models.CharField(max_length=20, choices=OwnerType.choices)
    owner_id = models.UUIDField()

    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="uploaded_attachments",
        db_column="uploaded_by_user_id",
    )

    mime_type = models.CharField(max_length=255)
    original_filename = models.CharField(max_length=255)
    storage_path = models.TextField()
    size_bytes = models.BigIntegerField()

    created_at = models.DateTimeField(auto_now_add=True)
    deleted_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        db_table = "attachments"
        indexes = [
            models.Index(
                fields=["owner_type", "owner_id"],
                name="attachments_owner_lookup_idx",
                condition=models.Q(deleted_at__isnull=True),
            ),
            models.Index(fields=["uploaded_by"], name="attachments_uploader_idx"),
            models.Index(fields=["-created_at"], name="attachments_created_idx"),
        ]

    @property
    def is_deleted(self):
        return self.deleted_at is not None

    def __str__(self):
        return f"{self.original_filename} ({self.owner_type}:{self.owner_id})"
