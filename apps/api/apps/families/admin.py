from django.contrib import admin

from .models import Family, FamilyVulnerabilityTag, VulnerabilityTag


class FamilyVulnerabilityTagInline(admin.TabularInline):
    model = FamilyVulnerabilityTag
    extra = 0


@admin.register(Family)
class FamilyAdmin(admin.ModelAdmin):
    list_display = (
        "head_name",
        "household_size",
        "zone_label",
        "priority_override",
        "created_by",
        "assigned_to",
        "created_at",
    )
    list_filter = (
        "priority_override",
        "accessibility_verification",
        "has_accessibility_need",
        "ocr_used",
        "zone_label",
    )
    search_fields = ("head_name", "phone", "address_text", "zone_label")
    inlines = [FamilyVulnerabilityTagInline]


@admin.register(VulnerabilityTag)
class VulnerabilityTagAdmin(admin.ModelAdmin):
    list_display = ("key", "label_fr", "label_ar", "is_active", "created_at")
    list_filter = ("is_active",)
    search_fields = ("key", "label_fr", "label_ar")
