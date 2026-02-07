from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register(r"emergencies", views.EmergencyIncidentViewSet, basename="emergency")

urlpatterns = [
    path("emergencies/types/", views.EmergencyTypeListView.as_view(), name="emergency-types"),
    path("emergencies/trigger/", views.EmergencyTriggerView.as_view(), name="emergency-trigger"),
    path("", include(router.urls)),
]
