from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register(r"notifications", views.NotificationLogViewSet, basename="notification")

urlpatterns = [
    path("notifications/test-email/", views.send_test_email, name="notification-test-email"),
    path("", include(router.urls)),
]
