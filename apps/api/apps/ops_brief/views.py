"""
Ops Brief endpoints — aggregates SSOT data and proxies to FastAPI for AI generation.

GET  /api/admin/ops-brief-input/     → returns structured input payload
POST /api/admin/ops-brief-generate/  → calls FastAPI LLM, returns AI brief or fallback
"""

import logging
import os
from datetime import datetime, timedelta, timezone

from django.db.models import Count, Q
from django.utils import timezone as dj_tz
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from apps.common.permissions import IsAdmin
from apps.complaints.models import Complaint
from apps.families.models import Family
from apps.services.svc_client import forward_ops_brief_generate
from apps.visits.models import Visit

logger = logging.getLogger(__name__)


# ── Helpers ──────────────────────────────────────────────────

def _build_ops_brief_input(window_hours=24, lang="fr"):
    """
    Aggregate SSOT data into the ops_brief_input payload.
    Reuses existing model queries (mirrors dashboard_view logic).
    """
    now = dj_tz.now()
    window_start = now - timedelta(hours=window_hours)
    data_missing = []

    # ── KPIs ──
    families_total = Family.objects.count()
    overdue_qs = Family.objects.filter(next_due_at__lt=now)
    overdue_count = overdue_qs.count()
    urgent_count = Family.objects.filter(priority_override="urgent").count()
    visits_24h = Visit.objects.filter(visited_at__gte=window_start).count()

    open_complaints_count = Complaint.objects.filter(
        status__in=["open", "in_progress"]
    ).count()

    # Suspected duplicates count (from dashboard logic)
    suspected_duplicates_count = 0
    duplicates_list = []
    try:
        from django.contrib.postgres.search import TrigramSimilarity

        families_for_dup = list(
            Family.objects.values("id", "head_name", "phone", "zone_label")[:200]
        )
        seen = set()
        for fa in families_for_dup:
            if len(duplicates_list) >= 5:
                break
            similar = (
                Family.objects.exclude(id=fa["id"])
                .annotate(similarity=TrigramSimilarity("head_name", fa["head_name"]))
                .filter(similarity__gte=0.5)
                .values("id", "head_name", "similarity")
                .order_by("-similarity")[:3]
            )
            for s in similar:
                pair = tuple(sorted([str(fa["id"]), str(s["id"])]))
                if pair not in seen:
                    seen.add(pair)
                    sim_pct = round(s["similarity"] * 100)
                    duplicates_list.append({
                        "id": f"dup:{fa['id']}-{s['id']}",
                        "label": f"{fa['head_name']} vs {s['head_name']}",
                        "priority": "high" if sim_pct >= 80 else "medium",
                        "target_url": f"/app/admin?section=duplicates&pair={fa['id']}-{s['id']}",
                        "evidence": f"Similarity {sim_pct}%",
                        "timestamp": now.isoformat(),
                    })
                    if len(duplicates_list) >= 5:
                        break
        suspected_duplicates_count = len(duplicates_list)
    except Exception:
        data_missing.append("suspected_duplicates")

    # ── Top overdue ──
    top_overdue_qs = (
        Family.objects.filter(next_due_at__lt=now)
        .values("id", "head_name", "zone_label", "next_due_at", "last_visit_at")
        .order_by("next_due_at")[:10]
    )
    top_overdue = [
        {
            "id": f"fam:{row['id']}",
            "label": row["head_name"],
            "priority": "overdue",
            "target_url": f"/app/admin?section=families&id={row['id']}",
            "evidence": f"next_due_at={row['next_due_at'].isoformat() if row['next_due_at'] else 'N/A'}",
            "timestamp": row["next_due_at"].isoformat() if row["next_due_at"] else now.isoformat(),
        }
        for row in top_overdue_qs
    ]

    # ── Top urgent ──
    top_urgent_qs = (
        Family.objects.filter(priority_override="urgent")
        .values("id", "head_name", "zone_label", "next_due_at", "last_visit_at")
        .order_by("-created_at")[:10]
    )
    top_urgent = [
        {
            "id": f"fam:{row['id']}",
            "label": row["head_name"],
            "priority": "urgent",
            "target_url": f"/app/admin?section=families&id={row['id']}",
            "evidence": f"priority_override=urgent, last_visit={row['last_visit_at'].isoformat() if row['last_visit_at'] else 'never'}",
            "timestamp": row["next_due_at"].isoformat() if row["next_due_at"] else now.isoformat(),
        }
        for row in top_urgent_qs
    ]

    # ── Open complaints ──
    open_complaints_qs = (
        Complaint.objects.filter(status__in=["open", "in_progress"])
        .values("id", "category", "priority", "status", "created_at", "family__head_name")
        .order_by("-created_at")[:10]
    )
    open_complaints = [
        {
            "id": f"cmp:{row['id']}",
            "label": f"{row['category']} — {row['family__head_name']}",
            "priority": row["priority"],
            "target_url": f"/app/admin?section=complaints&id={row['id']}",
            "evidence": f"status={row['status']}, priority={row['priority']}",
            "timestamp": row["created_at"].isoformat(),
        }
        for row in open_complaints_qs
    ]

    # ── Workload by agent ──
    per_agent = list(
        Family.objects.filter(assigned_to__isnull=False)
        .values(
            "assigned_to__id",
            "assigned_to__first_name",
            "assigned_to__last_name",
            "assigned_to__email",
        )
        .annotate(
            families_count=Count("id"),
            overdue_count=Count("id", filter=Q(next_due_at__lt=now)),
        )
        .order_by("-families_count")
    )
    workload_by_agent = [
        {
            "id": f"usr:{row['assigned_to__id']}",
            "label": (
                f"{row['assigned_to__first_name']} {row['assigned_to__last_name']}".strip()
                or row["assigned_to__email"]
            ),
            "priority": "high" if row["overdue_count"] > 3 else ("medium" if row["overdue_count"] > 0 else "low"),
            "target_url": f"/app/admin?section=users&id={row['assigned_to__id']}",
            "evidence": f"assigned={row['families_count']} overdue={row['overdue_count']}",
            "timestamp": now.isoformat(),
        }
        for row in per_agent
    ]

    return {
        "meta": {
            "schema_version": "1",
            "generated_at": now.isoformat(),
            "window_hours": window_hours,
            "lang": lang,
            "data_missing": data_missing,
        },
        "kpis": {
            "overdue_count": overdue_count,
            "urgent_count": urgent_count,
            "open_complaints_count": open_complaints_count,
            "suspected_duplicates_count": suspected_duplicates_count,
            "visits_last_24h": visits_24h,
            "families_total": families_total,
        },
        "top_overdue": top_overdue,
        "top_urgent": top_urgent,
        "open_complaints": open_complaints,
        "suspected_duplicates": duplicates_list,
        "workload_by_agent": workload_by_agent,
    }


def _build_deterministic_fallback(input_data):
    """
    Build a non-AI deterministic brief from the input data.
    Used when Ollama/FastAPI is unavailable or returns invalid output.
    """
    now_iso = datetime.now(timezone.utc).isoformat()
    kpis = input_data.get("kpis", {})
    lang = input_data.get("meta", {}).get("lang", "fr")

    # Build summary from KPIs
    summary_parts = []
    if kpis.get("overdue_count", 0) > 0:
        summary_parts.append(f"{kpis['overdue_count']} famille(s) en retard")
    if kpis.get("urgent_count", 0) > 0:
        summary_parts.append(f"{kpis['urgent_count']} famille(s) urgente(s)")
    if kpis.get("open_complaints_count", 0) > 0:
        summary_parts.append(f"{kpis['open_complaints_count']} plainte(s) ouverte(s)")
    if kpis.get("suspected_duplicates_count", 0) > 0:
        summary_parts.append(f"{kpis['suspected_duplicates_count']} doublon(s) suspecté(s)")
    summary_parts.append(f"{kpis.get('visits_last_24h', 0)} visite(s) dernières 24h")
    summary_parts.append(f"{kpis.get('families_total', 0)} famille(s) total")

    summary = "Briefing opérationnel (fallback déterministe). " + ". ".join(summary_parts) + "."

    # Build sections from lists
    sections = []

    overdue_items = input_data.get("top_overdue", [])
    if overdue_items:
        sections.append({
            "title": "Familles en retard",
            "bullets": [
                {
                    "text": f"{item['label']} — {item.get('evidence', '')}",
                    "severity": "critical",
                    "citations": [item["id"]],
                }
                for item in overdue_items[:5]
            ],
        })

    urgent_items = input_data.get("top_urgent", [])
    if urgent_items:
        sections.append({
            "title": "Familles urgentes",
            "bullets": [
                {
                    "text": f"{item['label']} — {item.get('evidence', '')}",
                    "severity": "warning",
                    "citations": [item["id"]],
                }
                for item in urgent_items[:5]
            ],
        })

    complaint_items = input_data.get("open_complaints", [])
    if complaint_items:
        sections.append({
            "title": "Plaintes ouvertes",
            "bullets": [
                {
                    "text": f"{item['label']} — {item.get('evidence', '')}",
                    "severity": "warning" if item.get("priority") in ("high", "urgent") else "info",
                    "citations": [item["id"]],
                }
                for item in complaint_items[:5]
            ],
        })

    dup_items = input_data.get("suspected_duplicates", [])
    if dup_items:
        sections.append({
            "title": "Doublons suspectés",
            "bullets": [
                {
                    "text": f"{item['label']} — {item.get('evidence', '')}",
                    "severity": "info",
                    "citations": [item["id"]],
                }
                for item in dup_items[:5]
            ],
        })

    # Build prioritized actions
    actions = []
    priority_counter = 1
    for item in overdue_items[:3]:
        actions.append({
            "title": f"Planifier visite: {item['label']}",
            "why": f"En retard — {item.get('evidence', '')}",
            "priority": priority_counter,
            "target_url": item.get("target_url", ""),
            "citations": [item["id"]],
        })
        priority_counter += 1

    for item in urgent_items[:2]:
        actions.append({
            "title": f"Traiter urgence: {item['label']}",
            "why": f"Marqué urgent — {item.get('evidence', '')}",
            "priority": priority_counter,
            "target_url": item.get("target_url", ""),
            "citations": [item["id"]],
        })
        priority_counter += 1

    # Alerts
    alerts = []
    if kpis.get("overdue_count", 0) >= 5:
        alerts.append({
            "level": "critical",
            "message": f"{kpis['overdue_count']} familles en retard nécessitent une attention immédiate.",
            "citations": [item["id"] for item in overdue_items[:3]],
        })
    if kpis.get("open_complaints_count", 0) >= 3:
        alerts.append({
            "level": "warning",
            "message": f"{kpis['open_complaints_count']} plaintes ouvertes à traiter.",
            "citations": [item["id"] for item in complaint_items[:3]],
        })

    return {
        "meta": {
            "generated_at": now_iso,
            "window_hours": input_data.get("meta", {}).get("window_hours", 24),
            "lang": lang,
            "model": "deterministic-fallback",
        },
        "summary": summary,
        "sections": sections,
        "actions": actions,
        "alerts": alerts,
    }


# ── Views ────────────────────────────────────────────────────

@api_view(["GET"])
@permission_classes([IsAdmin])
def ops_brief_input_view(request):
    """
    GET /api/admin/ops-brief-input/?window=24h&lang=fr
    Returns the structured input payload for the AI ops brief.
    """
    # Parse window parameter (default 24h)
    window_raw = request.query_params.get("window", "24h")
    try:
        window_hours = int(window_raw.replace("h", ""))
    except (ValueError, AttributeError):
        window_hours = 24

    lang = request.query_params.get("lang", "fr")
    if lang not in ("fr", "ar", "tn"):
        lang = "fr"

    input_data = _build_ops_brief_input(window_hours=window_hours, lang=lang)
    return Response(input_data)


@api_view(["POST"])
@permission_classes([IsAdmin])
def ops_brief_generate_view(request):
    """
    POST /api/admin/ops-brief-generate/
    Body (optional): { "window_hours": 24, "lang": "fr" }

    1. Builds ops_brief_input from SSOT
    2. Calls FastAPI LLM service
    3. Returns AI output or deterministic fallback
    """
    enabled = os.environ.get("OPS_BRIEF_ENABLED", "true").lower() in ("true", "1")
    if not enabled:
        return Response(
            {"detail": "Ops brief feature is disabled."},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    window_hours = request.data.get("window_hours", 24)
    lang = request.data.get("lang", "fr")
    if lang not in ("fr", "ar", "tn"):
        lang = "fr"

    # Step 1: Build input from SSOT
    input_data = _build_ops_brief_input(window_hours=window_hours, lang=lang)

    # Step 2: Call FastAPI
    result, error = forward_ops_brief_generate(lang, window_hours, input_data)

    # Step 3: Return AI output or fallback
    if error or not result:
        logger.warning("Ops brief LLM failed (%s), returning deterministic fallback", error)
        fallback = _build_deterministic_fallback(input_data)
        return Response({
            "success": True,
            "output": fallback,
            "fallback": True,
            "error": error,
        })

    # FastAPI returns {success, output, fallback, error, timing_ms}
    if result.get("success") and result.get("output"):
        return Response({
            "success": True,
            "output": result["output"],
            "fallback": result.get("fallback", False),
            "error": None,
            "timing_ms": result.get("timing_ms"),
        })

    # LLM returned but was not successful → fallback
    logger.warning("Ops brief LLM returned unsuccessful: %s", result.get("error"))
    fallback = _build_deterministic_fallback(input_data)
    return Response({
        "success": True,
        "output": fallback,
        "fallback": True,
        "error": result.get("error"),
    })
