from django.urls import path

from . import views

urlpatterns = [
    path("exports/families/csv/", views.export_families_csv, name="export-families-csv"),
    path("exports/families/xlsx/", views.export_families_xlsx, name="export-families-xlsx"),
    path("exports/visits/csv/", views.export_visits_csv, name="export-visits-csv"),
    path("exports/visits/xlsx/", views.export_visits_xlsx, name="export-visits-xlsx"),
]
