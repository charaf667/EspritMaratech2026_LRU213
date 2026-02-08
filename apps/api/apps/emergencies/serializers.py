from rest_framework import serializers

from apps.accounts.models import User

from .models import EmergencyAction, EmergencyIncident, EmergencyType


# ─── Read serializers ────────────────────────────────────────


class EmergencyTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmergencyType
        fields = ("id", "key", "label_fr", "label_ar", "severity_level", "is_agent_safety")


class EmergencyActionSerializer(serializers.ModelSerializer):
    actor_name = serializers.SerializerMethodField()

    class Meta:
        model = EmergencyAction
        fields = ("id", "action_type", "actor", "actor_name", "message", "created_at")
        read_only_fields = ("id", "created_at")

    def get_actor_name(self, obj):
        if not obj.actor:
            return "System"
        return f"{obj.actor.first_name} {obj.actor.last_name}".strip() or obj.actor.email


class EmergencyIncidentSerializer(serializers.ModelSerializer):
    actions = EmergencyActionSerializer(many=True, read_only=True)
    type_key = serializers.CharField(source="type.key", read_only=True)
    type_label_fr = serializers.CharField(source="type.label_fr", read_only=True)
    type_label_ar = serializers.CharField(source="type.label_ar", read_only=True)
    created_by_name = serializers.SerializerMethodField()
    assigned_admin_name = serializers.SerializerMethodField()
    family_name = serializers.SerializerMethodField()

    class Meta:
        model = EmergencyIncident
        fields = (
            "id",
            "client_id",
            "type",
            "type_key",
            "type_label_fr",
            "type_label_ar",
            "family",
            "family_name",
            "visit",
            "status",
            "severity_level",
            "summary",
            "details",
            "trigger_method",
            "lat",
            "lng",
            "accuracy_m",
            "network_state",
            "created_by",
            "created_by_name",
            "assigned_admin",
            "assigned_admin_name",
            "acknowledged_at",
            "resolved_at",
            "closed_at",
            "created_at",
            "updated_at",
            "actions",
        )
        read_only_fields = fields

    def get_created_by_name(self, obj):
        return f"{obj.created_by.first_name} {obj.created_by.last_name}".strip() or obj.created_by.email

    def get_assigned_admin_name(self, obj):
        if not obj.assigned_admin:
            return None
        u = obj.assigned_admin
        return f"{u.first_name} {u.last_name}".strip() or u.email

    def get_family_name(self, obj):
        if not obj.family:
            return None
        return obj.family.head_name


# ─── Write serializers ───────────────────────────────────────


class TriggerEmergencySerializer(serializers.Serializer):
    client_id = serializers.UUIDField(required=False, allow_null=True)
    type_key = serializers.CharField(max_length=50)
    family_id = serializers.UUIDField(required=False, allow_null=True)
    visit_id = serializers.UUIDField(required=False, allow_null=True)
    summary = serializers.CharField(required=False, allow_blank=True, allow_null=True, max_length=500)
    details = serializers.CharField(required=False, allow_blank=True, allow_null=True, max_length=5000)
    trigger_method = serializers.ChoiceField(
        choices=EmergencyIncident.TriggerMethod.choices,
        default="slide",
    )
    lat = serializers.FloatField(required=False, allow_null=True, min_value=-90, max_value=90)
    lng = serializers.FloatField(required=False, allow_null=True, min_value=-180, max_value=180)
    accuracy_m = serializers.IntegerField(required=False, allow_null=True, min_value=0, max_value=100000)
    network_state = serializers.ChoiceField(
        choices=EmergencyIncident.NetworkState.choices,
        default="online",
    )

    def validate_type_key(self, value):
        try:
            self._emergency_type = EmergencyType.objects.get(key=value, is_active=True)
        except EmergencyType.DoesNotExist:
            raise serializers.ValidationError(f"Unknown or inactive emergency type: '{value}'.")
        return value

    def validate(self, attrs):
        etype = getattr(self, "_emergency_type", None)
        family_id = attrs.get("family_id")
        visit_id = attrs.get("visit_id")

        # Both null allowed — agent may trigger emergency without family context
        # (family can be assigned later by admin)

        # If both provided, validate visit belongs to family
        if visit_id and family_id:
            from apps.visits.models import Visit

            try:
                visit = Visit.objects.get(id=visit_id)
            except Visit.DoesNotExist:
                raise serializers.ValidationError({"visit_id": "Visit not found."})
            if str(visit.family_id) != str(family_id):
                raise serializers.ValidationError(
                    {"visit_id": "Visit does not belong to the specified family."}
                )

        attrs["_emergency_type"] = etype
        return attrs


class StatusChangeSerializer(serializers.Serializer):
    status = serializers.ChoiceField(
        choices=["acknowledged", "in_progress", "resolved", "closed"],
    )
    message = serializers.CharField(required=False, allow_blank=True, default="")

    VALID_TRANSITIONS = {
        "open": ("acknowledged", "in_progress", "resolved", "closed"),
        "acknowledged": ("in_progress", "resolved", "closed"),
        "in_progress": ("resolved", "closed"),
        "resolved": ("closed",),
        "closed": (),
    }

    def validate_status(self, value):
        incident = self.context.get("incident")
        if not incident:
            return value
        allowed = self.VALID_TRANSITIONS.get(incident.status, ())
        if value not in allowed:
            raise serializers.ValidationError(
                f"Cannot transition from '{incident.status}' to '{value}'. "
                f"Allowed: {', '.join(allowed) if allowed else 'none'}."
            )
        return value


class AssignSerializer(serializers.Serializer):
    admin_id = serializers.UUIDField()

    def validate_admin_id(self, value):
        try:
            user = User.objects.get(id=value)
        except User.DoesNotExist:
            raise serializers.ValidationError("User not found.")
        if user.role != "admin":
            raise serializers.ValidationError("Can only assign to admin users.")
        return value


class ActionNoteSerializer(serializers.Serializer):
    message = serializers.CharField(min_length=1, max_length=2000)
