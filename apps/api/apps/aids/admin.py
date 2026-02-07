from django.contrib import admin

from .models import AidType


@admin.register(AidType)
class AidTypeAdmin(admin.ModelAdmin):
    list_display = ("key", "label_fr", "label_ar", "is_active", "created_at")
    list_filter = ("is_active",)
    search_fields = ("key", "label_fr", "label_ar")
