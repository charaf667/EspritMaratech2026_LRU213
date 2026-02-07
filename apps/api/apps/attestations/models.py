from django.conf import settings
from django.db import models

from apps.common.models import UUIDModel


class VisitAttestation(UUIDModel):
    """
    Sign-on-glass attestation for a visit.
    One attestation per visit (v1). NOT authentication — just delivery proof.
    Stores SVG path data, not biometric identity.
    """

    class Status(models.TextChoices):
        SIGNED = "signed", "Signed"
        CANNOT_SIGN = "cannot_sign", "Cannot Sign"

    class SignerRole(models.TextChoices):
        BENEFICIARY = "beneficiary", "Beneficiary"
        FAMILY_MEMBER = "family_member", "Family Member"
        WITNESS = "witness", "Witness"

    visit = models.OneToOneField(
        "visits.Visit",
        on_delete=models.CASCADE,
        related_name="attestation",
        db_column="visit_id",
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="created_attestations",
        db_column="created_by_user_id",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    signed_at = models.DateTimeField(blank=True, null=True)

    status = models.CharField(
        max_length=15,
        choices=Status.choices,
    )
    signer_name = models.CharField(max_length=200, blank=True, null=True)
    signer_role = models.CharField(
        max_length=15,
        choices=SignerRole.choices,
    )
    signature_svg = models.TextField(
        blank=True,
        null=True,
        help_text="SVG path data for the signature. Required if status=signed.",
    )
    reason_cannot_sign = models.TextField(
        blank=True,
        null=True,
        help_text="Required if status=cannot_sign.",
    )
    witness_name = models.CharField(max_length=200, blank=True, null=True)

    lat = models.FloatField(blank=True, null=True)
    lng = models.FloatField(blank=True, null=True)
    accuracy_m = models.IntegerField(blank=True, null=True)

    client_id = models.UUIDField(blank=True, null=True, unique=True)

    class Meta:
        db_table = "visit_attestations"
        indexes = [
            models.Index(fields=["visit"], name="attestation_visit_idx"),
            models.Index(fields=["created_by"], name="attestation_created_by_idx"),
            models.Index(
                fields=["status", "-created_at"],
                name="attestation_status_idx",
            ),
        ]

    def __str__(self):
        return f"Attestation {self.id} [{self.status}] for visit {self.visit_id}"
