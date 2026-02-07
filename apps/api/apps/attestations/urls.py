from django.urls import path

from . import views

urlpatterns = [
    path(
        "visits/<uuid:visit_id>/attestation/",
        views.VisitAttestationView.as_view(),
        name="visit-attestation",
    ),
    path(
        "attestations/",
        views.AttestationListView.as_view(),
        name="attestation-list",
    ),
]
