from django.urls import path

from . import views

urlpatterns = [
    path("transcribe-segment/", views.transcribe_segment_view, name="stt-transcribe"),
]
