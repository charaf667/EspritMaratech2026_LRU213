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
    Build a rich deterministic brief from the input data.
    Designed to produce professional, detailed output even without AI.
    """
    now_iso = datetime.now(timezone.utc).isoformat()
    kpis = input_data.get("kpis", {})
    lang = input_data.get("meta", {}).get("lang", "fr")
    window_hours = input_data.get("meta", {}).get("window_hours", 24)

    families_total = kpis.get("families_total", 0)
    overdue_count = kpis.get("overdue_count", 0)
    urgent_count = kpis.get("urgent_count", 0)
    complaints_count = kpis.get("open_complaints_count", 0)
    duplicates_count = kpis.get("suspected_duplicates_count", 0)
    visits_24h = kpis.get("visits_last_24h", 0)

    overdue_items = input_data.get("top_overdue", [])
    urgent_items = input_data.get("top_urgent", [])
    complaint_items = input_data.get("open_complaints", [])
    dup_items = input_data.get("suspected_duplicates", [])
    workload_items = input_data.get("workload_by_agent", [])

    # ── Executive summary ──
    overdue_pct = round(overdue_count / families_total * 100, 1) if families_total else 0
    summary_lines = []
    summary_lines.append(
        f"Le système OMNIA suit actuellement {families_total} famille(s) bénéficiaire(s)."
    )
    if visits_24h:
        summary_lines.append(
            f"{visits_24h} visite(s) ont été effectuée(s) dans les dernières {window_hours}h."
        )
    else:
        summary_lines.append(
            f"Aucune visite enregistrée dans les dernières {window_hours}h, ce qui nécessite une action immédiate."
        )
    if overdue_count:
        summary_lines.append(
            f"{overdue_count} famille(s) ({overdue_pct}%) sont en retard de suivi et requièrent une planification prioritaire."
        )
    if urgent_count:
        summary_lines.append(
            f"{urgent_count} famille(s) sont marquée(s) comme urgente(s) par les agents de terrain."
        )
    if complaints_count:
        summary_lines.append(
            f"{complaints_count} plainte(s) ouverte(s) en attente de résolution."
        )
    if duplicates_count:
        summary_lines.append(
            f"{duplicates_count} doublon(s) suspecté(s) nécessitent une vérification pour assurer la qualité des données."
        )
    summary = " ".join(summary_lines)

    # ── Sections ──
    sections = []

    # S1: KPIs analysis
    kpi_bullets = []
    kpi_bullets.append({
        "text": f"Base de données: {families_total} famille(s) enregistrée(s). "
                f"Taux de retard: {overdue_pct}% ({overdue_count}/{families_total}).",
        "severity": "critical" if overdue_pct > 20 else ("warning" if overdue_pct > 10 else "info"),
        "citations": [],
    })
    if visits_24h:
        kpi_bullets.append({
            "text": f"Activité terrain: {visits_24h} visite(s) dans les dernières {window_hours}h. "
                    f"Ratio couverture: {round(visits_24h / max(families_total, 1) * 100, 1)}% de la base.",
            "severity": "info",
            "citations": [],
        })
    else:
        kpi_bullets.append({
            "text": f"Aucune visite dans les dernières {window_hours}h. Activité terrain à relancer d'urgence.",
            "severity": "critical",
            "citations": [],
        })
    sections.append({"title": "Indicateurs Clés (KPIs)", "bullets": kpi_bullets})

    # S2: Overdue families
    if overdue_items:
        bullets = []
        for item in overdue_items[:5]:
            evidence = item.get("evidence", "")
            # Parse next_due_at from evidence for human-readable text
            due_info = evidence.replace("next_due_at=", "Échéance dépassée: ")
            bullets.append({
                "text": f"{item['label']} — {due_info}. "
                        f"Impact: cette famille ne reçoit plus de suivi depuis la date d'échéance. "
                        f"Recommandation: planifier une visite dans les 48h.",
                "severity": "critical",
                "citations": [item["id"]],
            })
        sections.append({"title": "Retards & Suivis en Souffrance", "bullets": bullets})

    # S3: Urgent families
    if urgent_items:
        bullets = []
        for item in urgent_items[:5]:
            evidence = item.get("evidence", "")
            last_visit_info = ""
            if "last_visit=" in evidence:
                lv = evidence.split("last_visit=")[1]
                last_visit_info = f" Dernière visite: {lv}."
            bullets.append({
                "text": f"{item['label']} — Marqué urgent par l'agent.{last_visit_info} "
                        f"Cette famille requiert une intervention prioritaire.",
                "severity": "warning",
                "citations": [item["id"]],
            })
        sections.append({"title": "Cas Urgents & Prioritaires", "bullets": bullets})

    # S4: Complaints
    if complaint_items:
        bullets = []
        for item in complaint_items[:5]:
            bullets.append({
                "text": f"{item['label']} — {item.get('evidence', '')}. "
                        f"Recommandation: assigner un responsable et traiter sous 72h.",
                "severity": "warning" if item.get("priority") in ("high", "urgent") else "info",
                "citations": [item["id"]],
            })
        sections.append({"title": "Plaintes & Réclamations", "bullets": bullets})

    # S5: Workload
    if workload_items:
        bullets = []
        for item in workload_items[:5]:
            evidence = item.get("evidence", "")
            bullets.append({
                "text": f"{item['label']} — {evidence.replace('assigned=', 'Familles assignées: ').replace('overdue=', ', en retard: ')}. "
                        f"Priorité de rééquilibrage: {item.get('priority', 'medium')}.",
                "severity": "warning" if item.get("priority") == "high" else "info",
                "citations": [item["id"]],
            })
        sections.append({"title": "Charge de Travail des Agents", "bullets": bullets})

    # S6: Duplicates & data quality
    dq_bullets = []
    if dup_items:
        for item in dup_items[:3]:
            dq_bullets.append({
                "text": f"{item['label']} — {item.get('evidence', '')}. "
                        f"Recommandation: vérifier et fusionner si confirmé.",
                "severity": "info",
                "citations": [item["id"]],
            })
    data_missing = input_data.get("meta", {}).get("data_missing", [])
    if data_missing:
        dq_bullets.append({
            "text": f"Données manquantes détectées: {', '.join(data_missing)}. "
                    f"Impact: l'analyse peut être incomplète.",
            "severity": "warning",
            "citations": ["data_missing"],
        })
    if dq_bullets:
        sections.append({"title": "Qualité des Données & Doublons", "bullets": dq_bullets})

    # ── Actions prioritaires ──
    actions = []
    priority_counter = 1

    for item in overdue_items[:2]:
        actions.append({
            "title": f"Planifier visite urgente: {item['label']}",
            "why": f"Famille en retard de suivi. Chaque jour supplémentaire augmente le risque de perte de contact avec le bénéficiaire.",
            "priority": priority_counter,
            "target_url": item.get("target_url", "/app/admin?section=families"),
            "citations": [item["id"]],
        })
        priority_counter += 1

    for item in urgent_items[:2]:
        actions.append({
            "title": f"Intervenir sur cas urgent: {item['label']}",
            "why": f"Famille marquée urgente par l'agent terrain. Nécessite une évaluation et une réponse rapide.",
            "priority": priority_counter,
            "target_url": item.get("target_url", "/app/admin?section=families"),
            "citations": [item["id"]],
        })
        priority_counter += 1

    for item in complaint_items[:1]:
        actions.append({
            "title": f"Résoudre plainte: {item['label']}",
            "why": f"Plainte ouverte nécessitant un suivi. Le délai de résolution impacte la satisfaction des bénéficiaires.",
            "priority": priority_counter,
            "target_url": item.get("target_url", "/app/admin?section=complaints"),
            "citations": [item["id"]],
        })
        priority_counter += 1

    if not actions:
        actions.append({
            "title": "Vérifier la planification des visites",
            "why": "Aucune action critique détectée. Profitez de cette période calme pour anticiper les prochaines échéances.",
            "priority": 1,
            "target_url": "/app/admin?section=planner",
            "citations": [],
        })

    # ── Alerts ──
    alerts = []
    if overdue_count >= 1:
        level = "critical" if overdue_count >= 3 else "warning"
        alerts.append({
            "level": level,
            "message": f"{overdue_count} famille(s) en retard de suivi. "
                       f"{'Situation critique nécessitant une mobilisation immédiate des agents.' if overdue_count >= 3 else 'Planifier des visites de rattrapage dans les prochains jours.'}",
            "citations": [item["id"] for item in overdue_items[:3]],
        })
    if complaints_count >= 1:
        level = "warning" if complaints_count >= 3 else "info"
        alerts.append({
            "level": level,
            "message": f"{complaints_count} plainte(s) ouverte(s) en attente de traitement. "
                       f"Délai moyen de résolution à surveiller.",
            "citations": [item["id"] for item in complaint_items[:3]],
        })
    if visits_24h == 0 and families_total > 0:
        alerts.append({
            "level": "warning",
            "message": f"Aucune visite enregistrée dans les dernières {window_hours}h. "
                       f"Vérifier la disponibilité des agents et relancer la planification.",
            "citations": [],
        })
    if not alerts:
        alerts.append({
            "level": "info",
            "message": "Situation opérationnelle stable. Aucune alerte critique détectée.",
            "citations": [],
        })

    return {
        "meta": {
            "generated_at": now_iso,
            "window_hours": window_hours,
            "lang": lang,
            "model": "omnia-analytics-v1",
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
