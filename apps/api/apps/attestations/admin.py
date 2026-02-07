from django.contrib import admin

from .models import VisitAttestation


@admin.register(VisitAttestation)
class VisitAttestationAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "visit",
        "status",
        "signer_role",
        "signer_name",
        "created_by",
        "signed_at",
        "created_at",
    )
    list_filter = ("status", "signer_role")
    search_fields = ("signer_name", "witness_name", "visit__family__head_name")
    raw_id_fields = ("visit", "created_by")
    readonly_fields = ("client_id", "signed_at", "created_at")
