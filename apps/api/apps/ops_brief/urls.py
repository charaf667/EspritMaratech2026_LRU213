from django.urls import path

from . import views

urlpatterns = [
    path("admin/ops-brief-input/", views.ops_brief_input_view, name="ops-brief-input"),
    path("admin/ops-brief-generate/", views.ops_brief_generate_view, name="ops-brief-generate"),
]
