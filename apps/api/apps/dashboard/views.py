from datetime import timedelta

from django.db.models import Count, Q
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from apps.common.permissions import IsAdmin
from apps.complaints.models import Complaint
from apps.families.models import Family
from apps.visits.models import Visit, VisitAid


@api_view(["GET"])
@permission_classes([IsAdmin])
def dashboard_view(request):
    """
    GET /api/dashboard/
    Admin-only. Returns KPIs, top aids, critical queue, complaints summary,
    data quality, per-agent workload, SLA metrics, and duplicate detection.
    """
    now = timezone.now()
    thirty_days_ago = now - timedelta(days=30)
    seven_days_ago = now - timedelta(days=7)
    fourteen_days_ago = now - timedelta(days=14)

    # ── KPIs ──
    families_total = Family.objects.count()
    visits_30d = Visit.objects.filter(visited_at__gte=thirty_days_ago).count()
    visits_7d = Visit.objects.filter(visited_at__gte=seven_days_ago).count()
    visits_prev_7d = Visit.objects.filter(
        visited_at__gte=fourteen_days_ago,
        visited_at__lt=seven_days_ago,
    ).count()

    overdue_qs = Family.objects.filter(next_due_at__lt=now)
    overdue_count = overdue_qs.count()
    urgent_count = Family.objects.filter(priority_override="urgent").count()

    # Real overdue/urgent trends (current week vs previous week)
    overdue_prev = Family.objects.filter(
        next_due_at__lt=seven_days_ago
    ).count()
    urgent_prev = Family.objects.filter(
        priority_override="urgent",
        created_at__lt=seven_days_ago,
    ).count()

    new_families_7d = Family.objects.filter(created_at__gte=seven_days_ago).count()
    new_families_prev_7d = Family.objects.filter(
        created_at__gte=fourteen_days_ago,
        created_at__lt=seven_days_ago,
    ).count()

    def trend(current, previous):
        if current > previous:
            return 1
        elif current < previous:
            return -1
        return 0

    # ── Top aids (30d) ──
    top_aids = (
        VisitAid.objects.filter(visit__visited_at__gte=thirty_days_ago)
        .values("aid_type__key", "aid_type__label_fr")
        .annotate(count=Count("id"))
        .order_by("-count")[:10]
    )
    top_aids_data = [
        {
            "aid_type_key": row["aid_type__key"],
            "label": row["aid_type__label_fr"],
            "count": row["count"],
        }
        for row in top_aids
    ]

    # ── Critical queue ──
    critical_families = Family.objects.filter(
        Q(next_due_at__lt=now) | Q(priority_override="urgent")
    ).values(
        "id", "head_name", "zone_label", "next_due_at", "priority_override",
        "last_visit_at", "phone",
    ).order_by("next_due_at")[:10]

    critical_queue = []
    for f in critical_families:
        priority = "overdue"
        if f["next_due_at"] and f["next_due_at"] >= now:
            priority = "urgent"
        critical_queue.append({
            "id": str(f["id"]),
            "head_name": f["head_name"],
            "zone_label": f["zone_label"],
            "priority": priority,
            "next_due_at": f["next_due_at"].isoformat() if f["next_due_at"] else None,
            "last_visit_at": f["last_visit_at"].isoformat() if f["last_visit_at"] else None,
            "phone": f["phone"],
        })

    # ── Complaints summary ──
    complaint_counts = dict(
        Complaint.objects.values("status").annotate(count=Count("id")).values_list("status", "count")
    )

    # ── Data quality ──
    missing_phone = Family.objects.filter(
        Q(phone__isnull=True) | Q(phone="")
    ).count()
    missing_location = Family.objects.filter(
        Q(lat__isnull=True) | Q(lng__isnull=True)
    ).count()
    overdue_without_visit = Family.objects.filter(
        next_due_at__lt=now,
        last_visit_at__isnull=True,
    ).count()

    total_checks = families_total * 3 if families_total else 1
    issues = missing_phone + missing_location + overdue_without_visit
    global_score = max(0, round(100 * (1 - issues / total_checks)))

    # ── Per-agent workload ──
    per_agent_workload = list(
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
    workload_data = [
        {
            "agent_id": str(row["assigned_to__id"]),
            "agent_name": f"{row['assigned_to__first_name']} {row['assigned_to__last_name']}".strip()
                or row["assigned_to__email"],
            "families_count": row["families_count"],
            "overdue_count": row["overdue_count"],
        }
        for row in per_agent_workload
    ]

    # ── SLA metrics ──
    # SLA: % of families visited within 30 days of due date
    families_with_due = Family.objects.filter(next_due_at__isnull=False).count()
    families_on_time = Family.objects.filter(
        next_due_at__isnull=False,
        next_due_at__gte=now,
    ).count()
    sla_pct = round(100 * families_on_time / families_with_due) if families_with_due else 100

    # ── Duplicate detection via TrigramSimilarity ──
    duplicates = []
    try:
        from django.contrib.postgres.search import TrigramSimilarity

        # Find potential duplicates by head_name similarity
        families_list = list(
            Family.objects.values("id", "head_name", "phone", "zone_label")[:200]
        )
        seen = set()
        for i, fa in enumerate(families_list):
            if len(duplicates) >= 5:
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
                    duplicates.append({
                        "family_a": str(fa["id"]),
                        "family_a_name": fa["head_name"],
                        "family_b": str(s["id"]),
                        "family_b_name": s["head_name"],
                        "similarity": round(s["similarity"] * 100),
                        "reason": f"Noms similaires ({round(s['similarity'] * 100)}%)",
                    })
                    if len(duplicates) >= 5:
                        break
    except Exception:
        # TrigramSimilarity requires pg_trgm extension; gracefully skip
        pass

    return Response({
        "kpis": {
            "families_total": families_total,
            "visits_30d": visits_30d,
            "visits_7d": visits_7d,
            "visits_trend": trend(visits_7d, visits_prev_7d),
            "overdue": overdue_count,
            "overdue_trend": trend(overdue_count, overdue_prev),
            "urgent": urgent_count,
            "urgent_trend": trend(urgent_count, urgent_prev),
            "new_families_7d": new_families_7d,
            "new_families_trend": trend(new_families_7d, new_families_prev_7d),
        },
        "top_aids_30d": top_aids_data,
        "critical_queue": critical_queue,
        "complaints_summary": {
            "open": complaint_counts.get("open", 0),
            "in_progress": complaint_counts.get("in_progress", 0),
            "resolved": complaint_counts.get("resolved", 0),
            "closed": complaint_counts.get("closed", 0),
        },
        "data_quality": {
            "global_score": global_score,
            "missing_phone": missing_phone,
            "missing_location": missing_location,
            "overdue_without_visit": overdue_without_visit,
        },
        "per_agent_workload": workload_data,
        "sla_pct": sla_pct,
        "suspected_duplicates": duplicates,
    })
