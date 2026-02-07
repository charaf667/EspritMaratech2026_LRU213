from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register(r"visits", views.VisitViewSet, basename="visit")

urlpatterns = [path("", include(router.urls))]
