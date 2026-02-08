from django.contrib import admin
from django.urls import include, path

# Versioned domain API includes
_v1_domain = [
    path("", include("apps.families.urls")),
    path("", include("apps.visits.urls")),
    path("", include("apps.aids.urls")),
    path("", include("apps.attachments.urls")),
    path("", include("apps.complaints.urls")),
    path("", include("apps.cards.urls")),
    path("", include("apps.audit.urls")),
    path("", include("apps.routing.urls")),
    path("", include("apps.ocr.urls")),
    path("", include("apps.exports.urls")),
    path("", include("apps.notifications.urls")),
    path("", include("apps.dashboard.urls")),
    path("", include("apps.emergencies.urls")),
    path("", include("apps.attestations.urls")),
    path("", include("apps.ops_brief.urls")),
    path("stt/", include("apps.stt.urls")),
]

urlpatterns = [
    path("admin/", admin.site.urls),
    # Unversioned: auth + health (stable contracts)
    path("api/auth/", include("apps.accounts.urls")),
    path("api/health/", include("apps.health.urls")),
    # Versioned: /api/v1/...
    path("api/v1/", include((_v1_domain, "v1"))),
    # Backward compat: /api/... → same as v1 (remove once clients migrate)
    path("api/", include(_v1_domain)),
]
