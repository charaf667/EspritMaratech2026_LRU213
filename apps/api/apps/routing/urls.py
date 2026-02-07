from django.urls import path

from . import views

urlpatterns = [
    path("routing/compute/", views.compute_route_view, name="routing-compute"),
]
