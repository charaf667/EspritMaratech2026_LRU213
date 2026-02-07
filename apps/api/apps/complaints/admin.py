from django.contrib import admin

from .models import Complaint, ComplaintMessage


class ComplaintMessageInline(admin.TabularInline):
    model = ComplaintMessage
    extra = 0


@admin.register(Complaint)
class ComplaintAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "family",
        "category",
        "priority",
        "status",
        "created_by",
        "created_at",
    )
    list_filter = ("status", "priority", "category")
    search_fields = ("category", "family__head_name")
    inlines = [ComplaintMessageInline]
