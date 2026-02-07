from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register(r"families", views.FamilyViewSet, basename="family")
router.register(
    r"vulnerability-tags", views.VulnerabilityTagViewSet, basename="vulnerability-tag"
)

urlpatterns = [
    path("families/map/", views.FamilyMapView.as_view(), name="family-map"),
    path("", include(router.urls)),
]
