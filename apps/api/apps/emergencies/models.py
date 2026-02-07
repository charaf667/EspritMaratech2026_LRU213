from django.conf import settings
from django.db import models

from apps.common.models import TimeStampedUUIDModel, UUIDModel


class EmergencyType(UUIDModel):
    """Reference table of emergency categories."""

    key = models.CharField(max_length=50, unique=True)
    label_fr = models.CharField(max_length=120)
    label_ar = models.CharField(max_length=120)
    severity_level = models.SmallIntegerField(
        help_text="1 (low) to 5 (critical)"
    )
    is_agent_safety = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "emergency_types"

    def __str__(self):
        return f"{self.key} (sev={self.severity_level})"


class EmergencyIncident(TimeStampedUUIDModel):
    """An emergency incident triggered by an agent or admin."""

    class Status(models.TextChoices):
        OPEN = "open", "Open"
        ACKNOWLEDGED = "acknowledged", "Acknowledged"
        IN_PROGRESS = "in_progress", "In Progress"
        RESOLVED = "resolved", "Resolved"
        CLOSED = "closed", "Closed"

    class TriggerMethod(models.TextChoices):
        LONG_PRESS = "long_press", "Long Press"
        SLIDE = "slide", "Slide"
        ADMIN = "admin", "Admin"

    class NetworkState(models.TextChoices):
        ONLINE = "online", "Online"
        OFFLINE_QUEUED = "offline_queued", "Offline (queued)"

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="emergency_incidents",
        db_column="created_by_user_id",
    )
    family = models.ForeignKey(
        "families.Family",
        on_delete=models.SET_NULL,
        related_name="emergency_incidents",
        blank=True,
        null=True,
        db_column="family_id",
    )
    visit = models.ForeignKey(
        "visits.Visit",
        on_delete=models.SET_NULL,
        related_name="emergency_incidents",
        blank=True,
        null=True,
        db_column="visit_id",
    )
    type = models.ForeignKey(
        EmergencyType,
        on_delete=models.PROTECT,
        related_name="incidents",
        db_column="emergency_type_id",
    )
    status = models.CharField(
        max_length=15,
        choices=Status.choices,
        default=Status.OPEN,
    )
    severity_level = models.SmallIntegerField(
        help_text="Snapshot from EmergencyType at creation time."
    )
    summary = models.TextField(blank=True, null=True)
    details = models.TextField(blank=True, null=True)
    trigger_method = models.CharField(
        max_length=15,
        choices=TriggerMethod.choices,
        default=TriggerMethod.SLIDE,
    )
    lat = models.FloatField(blank=True, null=True)
    lng = models.FloatField(blank=True, null=True)
    accuracy_m = models.IntegerField(blank=True, null=True)
    network_state = models.CharField(
        max_length=15,
        choices=NetworkState.choices,
        default=NetworkState.ONLINE,
    )
    assigned_admin = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="assigned_emergencies",
        blank=True,
        null=True,
        db_column="assigned_admin_user_id",
    )
    acknowledged_at = models.DateTimeField(blank=True, null=True)
    resolved_at = models.DateTimeField(blank=True, null=True)
    closed_at = models.DateTimeField(blank=True, null=True)
    client_id = models.UUIDField(blank=True, null=True, unique=True)

    class Meta:
        db_table = "emergency_incidents"
        indexes = [
            models.Index(
                fields=["status", "-created_at"],
                name="emerg_status_created_idx",
            ),
            models.Index(
                fields=["created_by", "-created_at"],
                name="emerg_created_by_idx",
            ),
            models.Index(
                fields=["family", "-created_at"],
                name="emerg_family_idx",
            ),
            models.Index(
                fields=["visit"],
                name="emerg_visit_idx",
            ),
        ]

    def __str__(self):
        return f"Emergency {self.id} [{self.status}] ({self.type.key})"


class EmergencyAction(UUIDModel):
    """Business-readable timeline entry for an emergency incident."""

    class ActionType(models.TextChoices):
        CREATED = "created", "Created"
        NOTE = "note", "Note"
        STATUS_CHANGE = "status_change", "Status Change"
        NOTIFY = "notify", "Notify"
        CALL = "call", "Call"
        DISPATCH = "dispatch", "Dispatch"
        ASSIGN = "assign", "Assign"

    incident = models.ForeignKey(
        EmergencyIncident,
        on_delete=models.CASCADE,
        related_name="actions",
        db_column="incident_id",
    )
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="emergency_actions",
        blank=True,
        null=True,
        db_column="actor_user_id",
    )
    action_type = models.CharField(
        max_length=15,
        choices=ActionType.choices,
    )
    message = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "emergency_actions"
        indexes = [
            models.Index(
                fields=["incident", "created_at"],
                name="emerg_actions_incident_idx",
            ),
        ]

    def __str__(self):
        return f"{self.action_type} on {self.incident_id}"
