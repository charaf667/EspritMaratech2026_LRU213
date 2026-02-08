from django.utils import timezone
from rest_framework import serializers

from .models import Family, FamilyVulnerabilityTag, VulnerabilityTag


class VulnerabilityTagSerializer(serializers.ModelSerializer):
    class Meta:
        model = VulnerabilityTag
        fields = ("id", "key", "label_fr", "label_ar")


class FamilyListSerializer(serializers.ModelSerializer):
    """Flat representation for list views — matches frontend Family type."""

    priority = serializers.SerializerMethodField()
    assigned_to_id = serializers.UUIDField(source="assigned_to.id", default=None)
    created_by_id = serializers.UUIDField(source="created_by.id", read_only=True)
    vulnerability_tags = VulnerabilityTagSerializer(many=True, read_only=True)

    class Meta:
        model = Family
        fields = (
            "id",
            "head_name",
            "household_size",
            "phone",
            "address_text",
            "zone_label",
            "lat",
            "lng",
            "last_visit_at",
            "next_due_at",
            "priority",
            "priority_override",
            "assigned_to_id",
            "created_by_id",
            "vulnerability_tags",
            "has_accessibility_need",
            "accessibility_types",
            "accessibility_verification",
            "vulnerability_notes",
            "ocr_used",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")

    def get_priority(self, obj):
        """
        Compute display priority:
        - If priority_override is set, use it.
        - If next_due_at is in the past → "overdue"
        - Else → "normal"
        """
        if obj.priority_override == "urgent":
            return "urgent"

        now = timezone.now()
        if obj.next_due_at and obj.next_due_at < now:
            return "overdue"

        if obj.priority_override == "normal":
            return "normal"

        return "normal"


class FamilyDetailSerializer(FamilyListSerializer):
    """Extended detail — includes nested visit history from ViewSet action."""

    pass


class FamilyCreateSerializer(serializers.ModelSerializer):
    """For creating/updating families."""

    head_name = serializers.CharField(min_length=2, max_length=255)
    household_size = serializers.IntegerField(min_value=1, max_value=50)
    phone = serializers.CharField(required=False, allow_blank=True, allow_null=True, max_length=30)
    address_text = serializers.CharField(required=False, allow_blank=True, allow_null=True, max_length=500)
    zone_label = serializers.CharField(required=False, allow_blank=True, allow_null=True, max_length=100)
    lat = serializers.FloatField(min_value=-90, max_value=90)
    lng = serializers.FloatField(min_value=-180, max_value=180)
    vulnerability_notes = serializers.CharField(required=False, allow_blank=True, allow_null=True, max_length=2000)

    class Meta:
        model = Family
        fields = (
            "head_name",
            "household_size",
            "phone",
            "address_text",
            "zone_label",
            "lat",
            "lng",
            "next_due_at",
            "priority_override",
            "assigned_to",
            "vulnerability_notes",
            "has_accessibility_need",
            "accessibility_types",
            "accessibility_verification",
            "ocr_used",
        )

    def validate_head_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Le nom du chef de famille est requis.")
        return value

    def create(self, validated_data):
        validated_data["created_by"] = self.context["request"].user
        return super().create(validated_data)


class FamilyVulnerabilityTagSerializer(serializers.ModelSerializer):
    class Meta:
        model = FamilyVulnerabilityTag
        fields = "__all__"
