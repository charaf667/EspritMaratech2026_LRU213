from django.conf import settings
from django.db import models

from apps.common.models import TimeStampedUUIDModel, UUIDModel


class Visit(TimeStampedUUIDModel):
    """A visit to a family by an agent."""

    class Motive(models.TextChoices):
        DISTRIBUTION = "distribution", "Distribution"
        FOLLOW_UP = "follow_up", "Follow-up"
        ASSESSMENT = "assessment", "Assessment"
        EMERGENCY = "emergency", "Emergency"

    family = models.ForeignKey(
        "families.Family",
        on_delete=models.CASCADE,
        related_name="visits",
        db_column="family_id",
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="created_visits",
        db_column="created_by_user_id",
    )

    visited_at = models.DateTimeField()
    motive = models.CharField(max_length=20, choices=Motive.choices)

    visit_lat = models.FloatField(blank=True, null=True)
    visit_lng = models.FloatField(blank=True, null=True)

    is_urgent = models.BooleanField(default=False)
    urgent_reason = models.TextField(blank=True, null=True)

    notes = models.TextField(blank=True, null=True)
    next_due_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        db_table = "visits"
        indexes = [
            models.Index(
                fields=["family", "-visited_at"],
                name="visits_family_visited_desc",
            ),
            models.Index(fields=["-visited_at"], name="visits_visited_at_idx"),
            models.Index(fields=["next_due_at"], name="visits_next_due_idx"),
            models.Index(fields=["created_by"], name="visits_created_by_idx"),
        ]

    def __str__(self):
        return f"Visit {self.id} ({self.motive})"


class VisitAid(UUIDModel):
    """An aid item distributed during a visit."""

    visit = models.ForeignKey(
        Visit,
        on_delete=models.CASCADE,
        related_name="aids",
        db_column="visit_id",
    )
    aid_type = models.ForeignKey(
        "aids.AidType",
        on_delete=models.PROTECT,
        related_name="visit_aids",
        db_column="aid_type_id",
    )
    quantity = models.PositiveIntegerField(default=1)
    note_short = models.CharField(max_length=140, blank=True, null=True)
    is_urgent = models.BooleanField(blank=True, null=True)

    class Meta:
        db_table = "visit_aids"
        constraints = [
            models.UniqueConstraint(
                fields=["visit", "aid_type"],
                name="visit_aids_unique",
            ),
        ]
        indexes = [
            models.Index(fields=["visit"], name="visit_aids_visit_idx"),
            models.Index(fields=["aid_type"], name="visit_aids_aid_type_idx"),
        ]
