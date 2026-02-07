import secrets

from django.conf import settings
from django.db import models

from apps.common.models import UUIDModel


def _generate_access_token():
    """Generate a 64-char cryptographic access token."""
    return secrets.token_urlsafe(48)[:64]


class BeneficiaryCard(UUIDModel):
    """Short-code card for the beneficiary portal (feeling portal)."""

    family = models.ForeignKey(
        "families.Family",
        on_delete=models.CASCADE,
        related_name="beneficiary_cards",
        db_column="family_id",
    )
    visit = models.ForeignKey(
        "visits.Visit",
        on_delete=models.SET_NULL,
        related_name="beneficiary_cards",
        blank=True,
        null=True,
        db_column="visit_id",
    )

    code_short = models.CharField(max_length=6, unique=True)
    access_token = models.CharField(
        max_length=64,
        unique=True,
        default=_generate_access_token,
    )
    expires_at = models.DateTimeField()

    last_accessed_at = models.DateTimeField(blank=True, null=True)
    access_count = models.PositiveIntegerField(default=0)

    revoked_at = models.DateTimeField(blank=True, null=True)
    revoked_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="revoked_cards",
        blank=True,
        null=True,
        db_column="revoked_by_user_id",
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "beneficiary_cards"
        indexes = [
            models.Index(fields=["family"], name="benef_cards_family_idx"),
            models.Index(fields=["expires_at"], name="benef_cards_expires_idx"),
        ]

    @property
    def is_revoked(self):
        return self.revoked_at is not None

    def __str__(self):
        return f"Card {self.code_short} (Family: {self.family_id})"
