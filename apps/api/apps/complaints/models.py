from django.conf import settings
from django.db import models

from apps.common.models import TimeStampedUUIDModel, UUIDModel


class Complaint(TimeStampedUUIDModel):
    """A complaint filed about a family or visit."""

    class Priority(models.TextChoices):
        LOW = "low", "Low"
        MEDIUM = "medium", "Medium"
        HIGH = "high", "High"
        URGENT = "urgent", "Urgent"

    class Status(models.TextChoices):
        OPEN = "open", "Open"
        IN_PROGRESS = "in_progress", "In Progress"
        RESOLVED = "resolved", "Resolved"
        CLOSED = "closed", "Closed"

    family = models.ForeignKey(
        "families.Family",
        on_delete=models.CASCADE,
        related_name="complaints",
        db_column="family_id",
    )
    visit = models.ForeignKey(
        "visits.Visit",
        on_delete=models.SET_NULL,
        related_name="complaints",
        blank=True,
        null=True,
        db_column="visit_id",
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="created_complaints",
        db_column="created_by_user_id",
    )

    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="assigned_complaints",
        blank=True,
        null=True,
        db_column="assigned_to_user_id",
    )

    category = models.CharField(max_length=100)
    priority = models.CharField(max_length=10, choices=Priority.choices)
    status = models.CharField(
        max_length=15,
        choices=Status.choices,
        default=Status.OPEN,
    )
    resolved_at = models.DateTimeField(blank=True, null=True)
    resolution_notes = models.TextField(blank=True, default="")

    class Meta:
        db_table = "complaints"
        indexes = [
            models.Index(fields=["family"], name="complaints_family_idx"),
            models.Index(
                fields=["status", "-created_at"],
                name="complaints_status_idx",
            ),
            models.Index(
                fields=["priority", "-created_at"],
                name="complaints_priority_idx",
            ),
            models.Index(fields=["created_by"], name="complaints_created_by_idx"),
        ]

    def __str__(self):
        return f"Complaint {self.id} ({self.status})"


class ComplaintMessage(UUIDModel):
    """A message in a complaint thread (admin replies only)."""

    complaint = models.ForeignKey(
        Complaint,
        on_delete=models.CASCADE,
        related_name="messages",
        db_column="complaint_id",
    )
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="complaint_messages",
        db_column="author_user_id",
    )
    message = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "complaint_messages"
        indexes = [
            models.Index(
                fields=["complaint", "created_at"],
                name="complaint_msgs_thread_idx",
            ),
            models.Index(
                fields=["id", "complaint"],
                name="complaint_msgs_id_compl_idx",
            ),
        ]
