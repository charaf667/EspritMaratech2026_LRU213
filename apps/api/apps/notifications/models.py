from django.conf import settings
from django.db import models

from apps.common.models import TimeStampedUUIDModel


class NotificationTemplate(TimeStampedUUIDModel):
    """Reusable notification templates."""

    class Channel(models.TextChoices):
        EMAIL = "email", "Email"
        SMS = "sms", "SMS"

    key = models.CharField(max_length=50, unique=True)
    channel = models.CharField(max_length=10, choices=Channel.choices)
    subject_template = models.CharField(max_length=255, blank=True, default="")
    body_template = models.TextField(
        help_text="Use {family_name}, {agent_name}, {due_date}, {days_overdue} placeholders."
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "notification_templates"

    def __str__(self):
        return f"{self.key} ({self.channel})"


class NotificationLog(TimeStampedUUIDModel):
    """Log of all notifications sent."""

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        SENT = "sent", "Sent"
        FAILED = "failed", "Failed"

    template = models.ForeignKey(
        NotificationTemplate,
        on_delete=models.SET_NULL,
        null=True,
        related_name="logs",
    )
    recipient_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="notification_logs",
    )
    recipient_address = models.CharField(
        max_length=255,
        help_text="Email or phone number",
    )
    channel = models.CharField(max_length=10, choices=NotificationTemplate.Channel.choices)
    subject = models.CharField(max_length=255, blank=True, default="")
    body = models.TextField()
    status = models.CharField(
        max_length=10,
        choices=Status.choices,
        default=Status.PENDING,
    )
    error_message = models.TextField(blank=True, default="")
    sent_at = models.DateTimeField(blank=True, null=True)

    family = models.ForeignKey(
        "families.Family",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="notification_logs",
    )

    class Meta:
        db_table = "notification_logs"
        indexes = [
            models.Index(fields=["status", "-created_at"], name="notif_status_idx"),
            models.Index(fields=["recipient_user", "-created_at"], name="notif_user_idx"),
        ]

    def __str__(self):
        return f"Notification {self.id} ({self.status})"
