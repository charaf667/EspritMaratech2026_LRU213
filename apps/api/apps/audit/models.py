from django.conf import settings
from django.db import models

from apps.common.models import UUIDModel


class AuditLog(UUIDModel):
    """Immutable audit trail for all entity changes."""

    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="audit_entries",
        db_column="actor_user_id",
        null=True,
        blank=True,
    )
    action = models.CharField(max_length=50)
    entity_type = models.CharField(max_length=50)
    entity_id = models.UUIDField()
    meta = models.JSONField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "audit_log"
        indexes = [
            models.Index(
                fields=["entity_type", "entity_id", "-created_at"],
                name="audit_log_entity_idx",
            ),
            models.Index(
                fields=["actor", "-created_at"],
                name="audit_log_actor_idx",
            ),
        ]

    def __str__(self):
        return f"{self.action} {self.entity_type}:{self.entity_id}"
