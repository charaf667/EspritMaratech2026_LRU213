from django.urls import path

from . import views

urlpatterns = [
    path("", views.health_view, name="health"),
]
