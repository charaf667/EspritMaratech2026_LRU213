from django.contrib import admin

from .models import EmergencyAction, EmergencyIncident, EmergencyType


@admin.register(EmergencyType)
class EmergencyTypeAdmin(admin.ModelAdmin):
    list_display = ("key", "label_fr", "severity_level", "is_agent_safety", "is_active")
    list_filter = ("is_active", "is_agent_safety", "severity_level")
    search_fields = ("key", "label_fr", "label_ar")


class EmergencyActionInline(admin.TabularInline):
    model = EmergencyAction
    extra = 0
    readonly_fields = ("actor", "action_type", "message", "created_at")


@admin.register(EmergencyIncident)
class EmergencyIncidentAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "type",
        "status",
        "severity_level",
        "created_by",
        "family",
        "assigned_admin",
        "created_at",
    )
    list_filter = ("status", "severity_level", "type", "trigger_method", "network_state")
    search_fields = ("summary", "details", "family__head_name")
    raw_id_fields = ("created_by", "family", "visit", "assigned_admin")
    readonly_fields = ("client_id", "acknowledged_at", "resolved_at", "closed_at")
    inlines = [EmergencyActionInline]
