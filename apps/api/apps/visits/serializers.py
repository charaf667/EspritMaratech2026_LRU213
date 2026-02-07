import secrets
import string
from datetime import timedelta

from django.utils import timezone
from rest_framework import serializers

from apps.aids.models import AidType
from apps.cards.models import BeneficiaryCard
from apps.complaints.models import Complaint

from .models import Visit, VisitAid


class VisitAidReadSerializer(serializers.ModelSerializer):
    aid_type_key = serializers.CharField(source="aid_type.key", read_only=True)
    label_fr = serializers.CharField(source="aid_type.label_fr", read_only=True)
    label_ar = serializers.CharField(source="aid_type.label_ar", read_only=True)

    class Meta:
        model = VisitAid
        fields = (
            "id",
            "aid_type_id",
            "aid_type_key",
            "label_fr",
            "label_ar",
            "quantity",
            "note_short",
            "is_urgent",
        )


class VisitAidWriteSerializer(serializers.Serializer):
    """Input shape for creating aids within a visit."""

    aid_type_key = serializers.CharField()
    qty = serializers.IntegerField(min_value=1)
    note_short = serializers.CharField(required=False, allow_blank=True, default="")


class VisitListSerializer(serializers.ModelSerializer):
    aids = VisitAidReadSerializer(many=True, read_only=True)
    created_by_id = serializers.UUIDField(source="created_by.id", read_only=True)
    family_id = serializers.UUIDField(source="family.id", read_only=True)
    feeling_token = serializers.SerializerMethodField()
    has_attestation = serializers.SerializerMethodField()
    attestation_status = serializers.SerializerMethodField()
    attested_at = serializers.SerializerMethodField()

    class Meta:
        model = Visit
        fields = (
            "id",
            "family_id",
            "created_by_id",
            "visited_at",
            "motive",
            "visit_lat",
            "visit_lng",
            "is_urgent",
            "urgent_reason",
            "notes",
            "next_due_at",
            "aids",
            "feeling_token",
            "has_attestation",
            "attestation_status",
            "attested_at",
            "created_at",
        )

    def get_feeling_token(self, obj):
        card = obj.beneficiary_cards.first()
        return card.access_token if card else None

    def get_has_attestation(self, obj):
        return hasattr(obj, "attestation") and obj.attestation is not None

    def get_attestation_status(self, obj):
        att = getattr(obj, "attestation", None)
        return att.status if att else None

    def get_attested_at(self, obj):
        att = getattr(obj, "attestation", None)
        return att.signed_at if att else None


class VisitCreateSerializer(serializers.Serializer):
    """
    Accepts the wizard payload:
    {
        family_id: UUID,
        visited_at: datetime (optional, default=now),
        motive: str (default="distribution"),
        notes: str,
        is_urgent: bool,
        urgent_reason: str,
        aids: [{ aid_type_key, qty, note_short? }],
        complaint_text: str (optional)
    }
    """

    family_id = serializers.UUIDField()
    visited_at = serializers.DateTimeField(required=False)
    motive = serializers.ChoiceField(
        choices=Visit.Motive.choices, default="distribution"
    )
    notes = serializers.CharField(required=False, allow_blank=True, default="")
    is_urgent = serializers.BooleanField(default=False)
    urgent_reason = serializers.CharField(
        required=False, allow_blank=True, default=""
    )
    visit_lat = serializers.FloatField(required=False, allow_null=True, default=None)
    visit_lng = serializers.FloatField(required=False, allow_null=True, default=None)
    aids = VisitAidWriteSerializer(many=True, required=False, default=[])
    complaint_text = serializers.CharField(
        required=False, allow_blank=True, default=""
    )

    def validate_aids(self, aids):
        if len(aids) > 10:
            raise serializers.ValidationError("Maximum 10 aid items per visit.")
        # Validate all aid_type_keys exist
        keys = [a["aid_type_key"] for a in aids]
        existing = set(
            AidType.objects.filter(key__in=keys, is_active=True).values_list(
                "key", flat=True
            )
        )
        invalid = set(keys) - existing
        if invalid:
            raise serializers.ValidationError(
                f"Unknown aid_type_key(s): {', '.join(invalid)}"
            )
        return aids

    def create(self, validated_data):
        user = self.context["request"].user
        aids_data = validated_data.pop("aids", [])
        complaint_text = validated_data.pop("complaint_text", "")
        now = timezone.now()

        if "visited_at" not in validated_data or validated_data["visited_at"] is None:
            validated_data["visited_at"] = now

        # Create visit
        visit = Visit.objects.create(
            family_id=validated_data["family_id"],
            created_by=user,
            visited_at=validated_data["visited_at"],
            motive=validated_data["motive"],
            notes=validated_data["notes"],
            is_urgent=validated_data["is_urgent"],
            urgent_reason=validated_data.get("urgent_reason", ""),
            visit_lat=validated_data.get("visit_lat"),
            visit_lng=validated_data.get("visit_lng"),
            next_due_at=now + timedelta(days=30),
        )

        # Create visit aids
        if aids_data:
            aid_type_map = {
                at.key: at
                for at in AidType.objects.filter(
                    key__in=[a["aid_type_key"] for a in aids_data]
                )
            }
            visit_aids = []
            for a in aids_data:
                visit_aids.append(
                    VisitAid(
                        visit=visit,
                        aid_type=aid_type_map[a["aid_type_key"]],
                        quantity=a["qty"],
                        note_short=a.get("note_short", ""),
                    )
                )
            VisitAid.objects.bulk_create(visit_aids)

        # Update family: last_visit_at + next_due_at
        from apps.families.models import Family

        Family.objects.filter(id=validated_data["family_id"]).update(
            last_visit_at=visit.visited_at,
            next_due_at=visit.next_due_at,
        )

        # Create complaint if text provided
        if complaint_text.strip():
            Complaint.objects.create(
                family_id=validated_data["family_id"],
                visit=visit,
                created_by=user,
                category="visit_report",
                priority="medium",
                status="open",
            )
            from apps.complaints.models import ComplaintMessage

            # Store the text as first message on the complaint
            complaint = visit.complaints.first()
            if complaint:
                ComplaintMessage.objects.create(
                    complaint=complaint,
                    author=user,
                    message=complaint_text,
                )

        # Generate beneficiary card (feeling portal)
        code = _generate_short_code()
        BeneficiaryCard.objects.create(
            family_id=validated_data["family_id"],
            visit=visit,
            code_short=code,
            expires_at=now + timedelta(days=7),
        )

        return visit


def _generate_short_code(length=6):
    """Generate a unique 6-char alphanumeric code."""
    chars = string.ascii_uppercase + string.digits
    for _ in range(10):  # Max retries
        code = "".join(secrets.choice(chars) for _ in range(length))
        if not BeneficiaryCard.objects.filter(code_short=code).exists():
            return code
    raise RuntimeError("Failed to generate unique short code")
