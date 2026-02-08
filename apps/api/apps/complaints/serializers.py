from rest_framework import serializers

from .models import Complaint, ComplaintMessage


class ComplaintMessageSerializer(serializers.ModelSerializer):
    author_name = serializers.SerializerMethodField()

    class Meta:
        model = ComplaintMessage
        fields = ("id", "complaint", "author", "author_name", "message", "created_at")
        read_only_fields = ("id", "created_at")

    def get_author_name(self, obj):
        return f"{obj.author.first_name} {obj.author.last_name}".strip() or obj.author.email


class ComplaintSerializer(serializers.ModelSerializer):
    messages = ComplaintMessageSerializer(many=True, read_only=True)
    family_name = serializers.CharField(source="family.head_name", read_only=True)
    created_by_name = serializers.SerializerMethodField()
    assigned_to_name = serializers.SerializerMethodField()
    category = serializers.ChoiceField(choices=Complaint.Category.choices)
    priority = serializers.ChoiceField(choices=Complaint.Priority.choices)
    resolution_notes = serializers.CharField(
        required=False, allow_blank=True, default="", max_length=2000
    )

    class Meta:
        model = Complaint
        fields = (
            "id",
            "family",
            "family_name",
            "visit",
            "created_by",
            "created_by_name",
            "assigned_to",
            "assigned_to_name",
            "category",
            "priority",
            "status",
            "resolved_at",
            "resolution_notes",
            "messages",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at", "resolved_at")

    VALID_TRANSITIONS = {
        "open": ("in_progress",),
        "in_progress": ("resolved", "open"),
        "resolved": ("closed", "in_progress"),
        "closed": (),
    }

    def validate_status(self, value):
        if self.instance and self.instance.status != value:
            allowed = self.VALID_TRANSITIONS.get(self.instance.status, ())
            if value not in allowed:
                raise serializers.ValidationError(
                    f"Cannot transition from '{self.instance.status}' to '{value}'. "
                    f"Allowed: {', '.join(allowed) if allowed else 'none'}."
                )
        return value

    def get_created_by_name(self, obj):
        return f"{obj.created_by.first_name} {obj.created_by.last_name}".strip() or obj.created_by.email

    def get_assigned_to_name(self, obj):
        if not obj.assigned_to:
            return None
        return f"{obj.assigned_to.first_name} {obj.assigned_to.last_name}".strip() or obj.assigned_to.email
