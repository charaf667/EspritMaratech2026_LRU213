from django.contrib import admin

from .models import Attachment


@admin.register(Attachment)
class AttachmentAdmin(admin.ModelAdmin):
    list_display = (
        "original_filename",
        "owner_type",
        "owner_id",
        "mime_type",
        "size_bytes",
        "uploaded_by",
        "created_at",
        "deleted_at",
    )
    list_filter = ("owner_type", "mime_type")
    search_fields = ("original_filename", "storage_path")
