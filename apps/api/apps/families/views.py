import logging
import time
from datetime import timedelta

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db.models import Case, F, Q, Value, When
from django.db.models.functions import Now
from django.utils import timezone
from rest_framework import serializers as drf_serializers
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.audit.utils import log_action
from apps.common.permissions import IsAdmin

from .models import Family, VulnerabilityTag
from .serializers import (
    FamilyCreateSerializer,
    FamilyDetailSerializer,
    FamilyListSerializer,
    VulnerabilityTagSerializer,
)

logger = logging.getLogger(__name__)


def _parse_bbox(raw: str):
    """
    Parse bbox query param: "minLng,minLat,maxLng,maxLat".
    Returns (min_lng, min_lat, max_lng, max_lat) or None on invalid input.
    """
    try:
        parts = [float(x) for x in raw.split(",")]
        if len(parts) != 4:
            return None
        return parts[0], parts[1], parts[2], parts[3]
    except (ValueError, TypeError):
        return None


def _apply_bbox(qs, bbox_tuple):
    """Filter queryset by lat/lng bounding box."""
    min_lng, min_lat, max_lng, max_lat = bbox_tuple
    return qs.filter(
        lat__gte=min_lat, lat__lte=max_lat,
        lng__gte=min_lng, lng__lte=max_lng,
    )

User = get_user_model()


class FamilyPagination(PageNumberPagination):
    page_size = 25
    page_size_query_param = "page_size"
    max_page_size = 100


class FamilyViewSet(viewsets.ModelViewSet):
    """
    Families CRUD with search, filters, RBAC, and priority-sort.

    RBAC (Option A):
      - agent: families where assigned_to=me OR created_by=me
      - admin: all families
    """

    permission_classes = [IsAuthenticated]
    pagination_class = FamilyPagination

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return FamilyCreateSerializer
        if self.action == "retrieve":
            return FamilyDetailSerializer
        return FamilyListSerializer

    def get_queryset(self):
        user = self.request.user
        qs = Family.objects.select_related(
            "created_by", "assigned_to"
        ).prefetch_related("vulnerability_tags")

        # RBAC
        if user.role != "admin":
            qs = qs.filter(Q(assigned_to=user) | Q(created_by=user))

        # ── Search ──
        search = self.request.query_params.get("search", "").strip()
        if search:
            qs = qs.filter(
                Q(head_name__icontains=search)
                | Q(phone__icontains=search)
                | Q(id__icontains=search)
            )

        # ── Filters ──
        # 1. priority chip: "overdue" | "urgent" | "normal"
        priority = self.request.query_params.get("priority")
        now = timezone.now()
        if priority == "overdue":
            qs = qs.filter(next_due_at__lt=now)
        elif priority == "urgent":
            qs = qs.filter(priority_override="urgent")
        elif priority == "normal":
            qs = qs.filter(
                Q(priority_override="normal") | Q(priority_override__isnull=True),
                Q(next_due_at__gte=now) | Q(next_due_at__isnull=True),
            )

        # 2. zone chip
        zone = self.request.query_params.get("zone")
        if zone:
            qs = qs.filter(zone_label__iexact=zone)

        # 3. assigned_to chip ("me" or UUID)
        assigned = self.request.query_params.get("assigned_to")
        if assigned == "me":
            qs = qs.filter(assigned_to=user)
        elif assigned:
            qs = qs.filter(assigned_to_id=assigned)

        # 4. aid_type chip — families that received a specific aid type
        aid_type = self.request.query_params.get("aid_type")
        if aid_type:
            qs = qs.filter(visits__aids__aid_type__key=aid_type).distinct()

        # 5. today chip — families with next_due_at today
        today_filter = self.request.query_params.get("today")
        if today_filter == "true":
            today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
            today_end = today_start + timedelta(days=1)
            qs = qs.filter(next_due_at__gte=today_start, next_due_at__lt=today_end)

        # 6. bbox — bounding box filter (minLng,minLat,maxLng,maxLat)
        bbox_raw = self.request.query_params.get("bbox")
        if bbox_raw:
            bbox = _parse_bbox(bbox_raw)
            if bbox:
                qs = _apply_bbox(qs, bbox)

        # ── Sort: overdue(0) > urgent(1) > normal(2), then next_due_at ──
        qs = qs.annotate(
            priority_rank=Case(
                When(next_due_at__lt=now, then=Value(0)),
                When(priority_override="urgent", then=Value(1)),
                default=Value(2),
            )
        ).order_by("priority_rank", F("next_due_at").asc(nulls_last=True))

        return qs

    @action(detail=True, methods=["post"], permission_classes=[IsAdmin])
    def assign(self, request, pk=None):
        """
        POST /api/families/{id}/assign/
        Body: {"user_id": "<uuid>"}  — assign family to agent
        Body: {"user_id": null}      — unassign
        Admin only.
        """
        family = self.get_object()
        user_id = request.data.get("user_id")

        if user_id is not None:
            try:
                agent = User.objects.get(pk=user_id)
            except User.DoesNotExist:
                return Response(
                    {"detail": "User not found."},
                    status=status.HTTP_404_NOT_FOUND,
                )
            family.assigned_to = agent
        else:
            family.assigned_to = None

        family.save(update_fields=["assigned_to", "updated_at"])

        log_action(
            actor=request.user,
            action="assign",
            entity_type="family",
            entity_id=str(family.id),
            meta={"assigned_to": str(user_id)},
        )

        return Response({
            "id": str(family.id),
            "assigned_to_id": str(family.assigned_to_id) if family.assigned_to_id else None,
        })

    @action(detail=True, methods=["post"], permission_classes=[IsAdmin])
    def merge(self, request, pk=None):
        """
        POST /api/families/{id}/merge/
        Body: {"source_id": "<uuid>"}
        Merges source family INTO this family (target):
          - Moves visits, complaints, cards from source → target
          - Merges vulnerability tags (union)
          - Keeps target fields, fills blanks from source
          - Deletes source family
        Admin only.
        """
        target = self.get_object()
        source_id = request.data.get("source_id")
        if not source_id:
            return Response(
                {"detail": "source_id is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            source = Family.objects.get(pk=source_id)
        except Family.DoesNotExist:
            return Response(
                {"detail": "Source family not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        if str(source.id) == str(target.id):
            return Response(
                {"detail": "Cannot merge a family into itself."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        from django.db import transaction

        with transaction.atomic():
            # Move visits
            source.visits.update(family=target)
            # Move complaints (if FK exists)
            if hasattr(source, "complaints"):
                source.complaints.update(family=target)
            # Move beneficiary cards
            if hasattr(source, "beneficiary_cards"):
                source.beneficiary_cards.update(family=target)

            # Merge vulnerability tags (union)
            source_tag_ids = set(
                source.vulnerability_tags.values_list("id", flat=True)
            )
            existing_tag_ids = set(
                target.vulnerability_tags.values_list("id", flat=True)
            )
            new_tags = source_tag_ids - existing_tag_ids
            if new_tags:
                FamilyVulnerabilityTag = Family.vulnerability_tags.through
                FamilyVulnerabilityTag.objects.bulk_create([
                    FamilyVulnerabilityTag(family_id=target.id, tag_id=tid)
                    for tid in new_tags
                ], ignore_conflicts=True)

            # Fill blank fields on target from source
            fill_fields = [
                "phone", "address_text", "vulnerability_notes", "zone_label",
            ]
            for field in fill_fields:
                if not getattr(target, field) and getattr(source, field):
                    setattr(target, field, getattr(source, field))

            # Take larger household_size
            if source.household_size > target.household_size:
                target.household_size = source.household_size

            # Accessibility merge
            if source.has_accessibility_need and not target.has_accessibility_need:
                target.has_accessibility_need = True
                target.accessibility_types = source.accessibility_types

            target.save()

            # Audit
            log_action(
                actor=request.user,
                action="merge",
                entity_type="family",
                entity_id=str(target.id),
                meta={
                    "source_id": str(source.id),
                    "source_name": source.head_name,
                },
            )

            # Delete source
            source.delete()

        serializer = FamilyDetailSerializer(target)
        return Response(serializer.data)


# ── Map-minimal endpoint ─────────────────────────────────────

class FamilyMapSerializer(drf_serializers.ModelSerializer):
    """Lightweight serializer for map markers — only fields needed for rendering."""

    priority = drf_serializers.SerializerMethodField()

    class Meta:
        model = Family
        fields = (
            "id",
            "head_name",
            "lat",
            "lng",
            "zone_label",
            "priority",
            "next_due_at",
            "last_visit_at",
        )

    def get_priority(self, obj):
        if obj.priority_override == "urgent":
            return "urgent"
        now = timezone.now()
        if obj.next_due_at and obj.next_due_at < now:
            return "overdue"
        return "normal"


class FamilyMapView(APIView):
    """
    GET /api/families/map/
    Returns minimal marker data. Accepts optional ?bbox=minLng,minLat,maxLng,maxLat.
    Same RBAC as /api/families/.
    No pagination — returns flat array (expected to be filtered by bbox).
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        t0 = time.monotonic()
        user = request.user

        qs = Family.objects.only(
            "id", "head_name", "lat", "lng", "zone_label",
            "priority_override", "next_due_at", "last_visit_at",
        )

        # RBAC — same rules as FamilyViewSet
        if user.role != "admin":
            qs = qs.filter(Q(assigned_to=user) | Q(created_by=user))

        # bbox filter
        bbox_raw = request.query_params.get("bbox")
        has_bbox = False
        if bbox_raw:
            bbox = _parse_bbox(bbox_raw)
            if bbox:
                qs = _apply_bbox(qs, bbox)
                has_bbox = True

        results = list(qs)
        count = len(results)
        elapsed = time.monotonic() - t0

        # Observability
        if has_bbox:
            logger.info(
                "families/map bbox=%s count=%d time=%.3fs",
                bbox_raw, count, elapsed,
            )
        if count > 2000:
            logger.warning(
                "families/map returned %d items (>2000) — consider tighter bbox or pagination",
                count,
            )

        serializer = FamilyMapSerializer(results, many=True)
        return Response(serializer.data)


class VulnerabilityTagViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = VulnerabilityTag.objects.filter(is_active=True)
    serializer_class = VulnerabilityTagSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None
