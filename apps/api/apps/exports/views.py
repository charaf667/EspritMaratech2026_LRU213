"""
Export views — admin-only streaming CSV and Excel exports for families and visits.
"""

import csv
import io
from datetime import timedelta

from django.http import HttpResponse, StreamingHttpResponse
from django.utils import timezone
from openpyxl import Workbook
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from apps.common.permissions import IsAdmin
from apps.families.models import Family
from apps.visits.models import Visit


class Echo:
    """Pseudo-buffer for streaming CSV rows."""

    def write(self, value):
        return value


# ─── Families Export ──────────────────────────────────────────


FAMILY_HEADERS = [
    "ID", "Nom du chef", "Taille ménage", "Téléphone", "Adresse",
    "Zone", "Lat", "Lng", "Dernière visite", "Prochaine échéance",
    "Priorité", "Assigné à", "Créé le",
]


def _family_row(f):
    return [
        str(f.id),
        f.head_name,
        f.household_size,
        f.phone or "",
        f.address_text or "",
        f.zone_label or "",
        f.lat,
        f.lng,
        f.last_visit_at.isoformat() if f.last_visit_at else "",
        f.next_due_at.isoformat() if f.next_due_at else "",
        f.priority_override or "normal",
        f"{f.assigned_to.first_name} {f.assigned_to.last_name}".strip() if f.assigned_to else "",
        f.created_at.isoformat(),
    ]


@api_view(["GET"])
@permission_classes([IsAdmin])
def export_families_csv(request):
    """GET /api/exports/families/csv/ — streaming CSV of all families."""
    families = Family.objects.select_related("assigned_to").order_by("-created_at")

    pseudo_buffer = Echo()
    writer = csv.writer(pseudo_buffer)

    def rows():
        yield writer.write(FAMILY_HEADERS)
        for f in families.iterator(chunk_size=500):
            yield writer.write(_family_row(f))

    response = StreamingHttpResponse(rows(), content_type="text/csv; charset=utf-8")
    response["Content-Disposition"] = 'attachment; filename="familles.csv"'
    return response


@api_view(["GET"])
@permission_classes([IsAdmin])
def export_families_xlsx(request):
    """GET /api/exports/families/xlsx/ — Excel export of all families."""
    families = Family.objects.select_related("assigned_to").order_by("-created_at")

    wb = Workbook()
    ws = wb.active
    ws.title = "Familles"
    ws.append(FAMILY_HEADERS)

    for f in families.iterator(chunk_size=500):
        ws.append(_family_row(f))

    # Auto-width columns
    for col in ws.columns:
        max_len = max(len(str(cell.value or "")) for cell in col)
        ws.column_dimensions[col[0].column_letter].width = min(max_len + 2, 50)

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)

    response = HttpResponse(
        buf.getvalue(),
        content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )
    response["Content-Disposition"] = 'attachment; filename="familles.xlsx"'
    return response


# ─── Visits Export ────────────────────────────────────────────


VISIT_HEADERS = [
    "ID", "Famille ID", "Nom famille", "Agent", "Date visite", "Motif",
    "Urgent", "Raison urgence", "Notes", "Aides", "Prochaine échéance", "Créé le",
]


def _visit_row(v):
    aids_str = ", ".join(
        f"{a.aid_type.label_fr} x{a.quantity}" for a in v.aids.select_related("aid_type")
    )
    return [
        str(v.id),
        str(v.family_id),
        v.family.head_name if v.family else "",
        f"{v.created_by.first_name} {v.created_by.last_name}".strip() if v.created_by else "",
        v.visited_at.isoformat(),
        v.motive,
        "Oui" if v.is_urgent else "Non",
        v.urgent_reason or "",
        v.notes or "",
        aids_str,
        v.next_due_at.isoformat() if v.next_due_at else "",
        v.created_at.isoformat(),
    ]


@api_view(["GET"])
@permission_classes([IsAdmin])
def export_visits_csv(request):
    """GET /api/exports/visits/csv/ — streaming CSV of all visits."""
    visits = (
        Visit.objects.select_related("family", "created_by")
        .prefetch_related("aids__aid_type")
        .order_by("-visited_at")
    )

    pseudo_buffer = Echo()
    writer = csv.writer(pseudo_buffer)

    def rows():
        yield writer.write(VISIT_HEADERS)
        for v in visits.iterator(chunk_size=500):
            yield writer.write(_visit_row(v))

    response = StreamingHttpResponse(rows(), content_type="text/csv; charset=utf-8")
    response["Content-Disposition"] = 'attachment; filename="visites.csv"'
    return response


@api_view(["GET"])
@permission_classes([IsAdmin])
def export_visits_xlsx(request):
    """GET /api/exports/visits/xlsx/ — Excel export of all visits."""
    visits = (
        Visit.objects.select_related("family", "created_by")
        .prefetch_related("aids__aid_type")
        .order_by("-visited_at")
    )

    wb = Workbook()
    ws = wb.active
    ws.title = "Visites"
    ws.append(VISIT_HEADERS)

    for v in visits.iterator(chunk_size=500):
        ws.append(_visit_row(v))

    for col in ws.columns:
        max_len = max(len(str(cell.value or "")) for cell in col)
        ws.column_dimensions[col[0].column_letter].width = min(max_len + 2, 50)

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)

    response = HttpResponse(
        buf.getvalue(),
        content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )
    response["Content-Disposition"] = 'attachment; filename="visites.xlsx"'
    return response
