from django.contrib import admin

from .models import Visit, VisitAid


class VisitAidInline(admin.TabularInline):
    model = VisitAid
    extra = 0


@admin.register(Visit)
class VisitAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "family",
        "motive",
        "visited_at",
        "is_urgent",
        "created_by",
        "created_at",
    )
    list_filter = ("motive", "is_urgent")
    search_fields = ("family__head_name", "notes", "urgent_reason")
    inlines = [VisitAidInline]
