from django.utils import timezone
from rest_framework import serializers

from .models import VisitAttestation


class VisitAttestationSerializer(serializers.ModelSerializer):
    """Read serializer for attestation detail."""

    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = VisitAttestation
        fields = (
            "id",
            "visit",
            "created_by",
            "created_by_name",
            "created_at",
            "signed_at",
            "status",
            "signer_name",
            "signer_role",
            "signature_svg",
            "reason_cannot_sign",
            "witness_name",
            "lat",
            "lng",
            "accuracy_m",
            "client_id",
        )
        read_only_fields = fields

    def get_created_by_name(self, obj):
        u = obj.created_by
        return f"{u.first_name} {u.last_name}".strip() or u.email


class CreateAttestationSerializer(serializers.Serializer):
    """Write serializer for POST /api/visits/{id}/attestation/."""

    client_id = serializers.UUIDField(required=False, allow_null=True)
    status = serializers.ChoiceField(choices=VisitAttestation.Status.choices)
    signer_name = serializers.CharField(
        required=False, allow_blank=True, allow_null=True, max_length=200
    )
    signer_role = serializers.ChoiceField(choices=VisitAttestation.SignerRole.choices)
    signature_svg = serializers.CharField(
        required=False, allow_blank=True, allow_null=True
    )
    reason_cannot_sign = serializers.CharField(
        required=False, allow_blank=True, allow_null=True
    )
    witness_name = serializers.CharField(
        required=False, allow_blank=True, allow_null=True, max_length=200
    )
    lat = serializers.FloatField(required=False, allow_null=True)
    lng = serializers.FloatField(required=False, allow_null=True)
    accuracy_m = serializers.IntegerField(required=False, allow_null=True)

    def validate(self, attrs):
        status_val = attrs.get("status")

        if status_val == "signed":
            svg = (attrs.get("signature_svg") or "").strip()
            if not svg:
                raise serializers.ValidationError(
                    {"signature_svg": "Signature SVG is required when status is 'signed'."}
                )

        if status_val == "cannot_sign":
            reason = (attrs.get("reason_cannot_sign") or "").strip()
            if not reason:
                raise serializers.ValidationError(
                    {"reason_cannot_sign": "Reason is required when status is 'cannot_sign'."}
                )

        return attrs
