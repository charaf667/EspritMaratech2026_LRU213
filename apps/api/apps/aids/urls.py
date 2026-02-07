from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register(r"aid-types", views.AidTypeViewSet, basename="aid-type")

urlpatterns = [path("", include(router.urls))]
