from django.contrib import admin

from .models import BeneficiaryCard


@admin.register(BeneficiaryCard)
class BeneficiaryCardAdmin(admin.ModelAdmin):
    list_display = (
        "code_short",
        "family",
        "visit",
        "expires_at",
        "revoked_at",
        "revoked_by",
        "created_at",
    )
    list_filter = ("expires_at", "revoked_at")
    search_fields = ("code_short", "family__head_name")
