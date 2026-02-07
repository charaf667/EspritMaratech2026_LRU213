from django.conf import settings
from django.contrib.postgres.fields import ArrayField
from django.core.validators import MinValueValidator
from django.db import models

from apps.common.models import TimeStampedUUIDModel, UUIDModel


class VulnerabilityTag(UUIDModel):
    """Normalized vulnerability tag with bilingual labels."""

    key = models.CharField(max_length=100, unique=True)
    label_fr = models.CharField(max_length=255)
    label_ar = models.CharField(max_length=255)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "vulnerability_tags"
        indexes = [
            models.Index(
                fields=["is_active"],
                name="vuln_tags_active_idx",
                condition=models.Q(is_active=True),
            ),
        ]

    def __str__(self):
        return self.key


class Family(TimeStampedUUIDModel):
    """A beneficiary family."""

    class PriorityOverride(models.TextChoices):
        URGENT = "urgent", "Urgent"
        NORMAL = "normal", "Normal"

    class AccessibilityVerification(models.TextChoices):
        NONE = "none", "None"
        DECLARED = "declared", "Declared"
        VERIFIED = "verified", "Verified"

    head_name = models.CharField(max_length=255)
    household_size = models.PositiveIntegerField(validators=[MinValueValidator(1)])
    phone = models.CharField(max_length=30, blank=True, null=True)
    address_text = models.TextField(blank=True, null=True)

    vulnerability_notes = models.TextField(blank=True, null=True)
    zone_label = models.CharField(max_length=255, blank=True, null=True)

    lat = models.FloatField()
    lng = models.FloatField()

    last_visit_at = models.DateTimeField(blank=True, null=True)
    next_due_at = models.DateTimeField(blank=True, null=True)
    priority_override = models.CharField(
        max_length=10,
        choices=PriorityOverride.choices,
        blank=True,
        null=True,
    )

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="created_families",
        db_column="created_by_user_id",
    )
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="assigned_families",
        blank=True,
        null=True,
        db_column="assigned_to_user_id",
    )

    has_accessibility_need = models.BooleanField(default=False)
    accessibility_types = ArrayField(
        models.TextField(),
        blank=True,
        null=True,
    )
    accessibility_verification = models.CharField(
        max_length=10,
        choices=AccessibilityVerification.choices,
        default=AccessibilityVerification.NONE,
    )
    verified_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="verified_families",
        blank=True,
        null=True,
        db_column="verified_by_user_id",
    )
    verified_at = models.DateTimeField(blank=True, null=True)

    ocr_used = models.BooleanField(default=False)

    vulnerability_tags = models.ManyToManyField(
        VulnerabilityTag,
        through="FamilyVulnerabilityTag",
        related_name="families",
        blank=True,
    )

    class Meta:
        db_table = "families"
        verbose_name_plural = "families"
        indexes = [
            models.Index(fields=["created_by"], name="families_created_by_idx"),
            models.Index(fields=["assigned_to"], name="families_assigned_to_idx"),
            models.Index(fields=["zone_label"], name="families_zone_idx"),
            models.Index(fields=["next_due_at"], name="families_next_due_idx"),
            models.Index(fields=["last_visit_at"], name="families_last_visit_idx"),
            models.Index(fields=["lat", "lng"], name="families_lat_lng_idx"),
            models.Index(fields=["lat"], name="families_lat_idx"),
            models.Index(fields=["lng"], name="families_lng_idx"),
            models.Index(
                fields=["next_due_at", "last_visit_at"],
                name="families_due_sort_idx",
            ),
        ]

    def __str__(self):
        return f"{self.head_name} ({self.household_size})"


class FamilyVulnerabilityTag(models.Model):
    """M2M through table for Family <-> VulnerabilityTag."""

    family = models.ForeignKey(Family, on_delete=models.CASCADE)
    tag = models.ForeignKey(VulnerabilityTag, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "family_vulnerability_tags"
        constraints = [
            models.UniqueConstraint(
                fields=["family", "tag"],
                name="family_vuln_tags_pkey",
            ),
        ]
        indexes = [
            models.Index(fields=["tag"], name="family_vuln_tags_tag_idx"),
        ]
