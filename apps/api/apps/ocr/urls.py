from django.urls import path

from . import views

urlpatterns = [
    path("ocr/extract-cin/", views.extract_cin_view, name="ocr-extract-cin"),
]
