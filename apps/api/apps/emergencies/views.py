from django.db.models import Q
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.audit.utils import log_action
from apps.common.permissions import IsAdmin

from .models import EmergencyAction, EmergencyIncident, EmergencyType
from .serializers import (
    ActionNoteSerializer,
    AssignSerializer,
    EmergencyIncidentSerializer,
    EmergencyTypeSerializer,
    StatusChangeSerializer,
    TriggerEmergencySerializer,
)


def _user_name(user):
    return f"{user.first_name} {user.last_name}".strip() or user.email


def _serialize_incident(incident, request=None):
    """Re-fetch with joins and serialize."""
    incident = (
        EmergencyIncident.objects
        .select_related("type", "created_by", "assigned_admin", "family")
        .prefetch_related("actions__actor")
        .get(id=incident.id)
    )
    return EmergencyIncidentSerializer(incident, context={"request": request}).data


def _notify_admins_on_trigger(incident):
    """Create NotificationLog entries for all admins (rate-limited per incident)."""
    from apps.accounts.models import User
    from apps.notifications.models import NotificationLog

    # Rate-limit: skip if a notification for this incident exists within 60s
    recent = NotificationLog.objects.filter(
        family=incident.family,
        body__contains=str(incident.id),
        created_at__gte=timezone.now() - timezone.timedelta(seconds=60),
    ).exists()
    if recent:
        return

    admins = User.objects.filter(role="admin", is_active=True)
    type_label = incident.type.label_fr
    agent_name = _user_name(incident.created_by)
    family_name = incident.family.head_name if incident.family else "N/A"

    subject = f"[URGENCE] {type_label} — {family_name}"
    body = (
        f"Emergency triggered by {agent_name}.\n"
        f"Type: {type_label} (severity {incident.severity_level})\n"
        f"Family: {family_name}\n"
        f"Summary: {incident.summary or '—'}\n"
        f"Incident ID: {incident.id}"
    )

    logs = []
    for admin_user in admins:
        logs.append(
            NotificationLog(
                recipient_user=admin_user,
                recipient_address=admin_user.email,
                channel="email",
                subject=subject,
                body=body,
                status="pending",
                family=incident.family,
            )
        )
    if logs:
        NotificationLog.objects.bulk_create(logs)


# ─── A) Emergency types ─────────────────────────────────────


class EmergencyTypeListView(APIView):
    """GET /api/emergencies/types/ — list active emergency types."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        types = EmergencyType.objects.filter(is_active=True).order_by("severity_level", "key")
        serializer = EmergencyTypeSerializer(types, many=True)
        return Response(serializer.data)


# ─── B) Trigger ──────────────────────────────────────────────


class EmergencyTriggerView(APIView):
    """POST /api/emergencies/trigger/ — create a new emergency."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = TriggerEmergencySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        # Idempotency check
        client_id = data.get("client_id")
        if client_id:
            existing = EmergencyIncident.objects.filter(client_id=client_id).first()
            if existing:
                return Response(
                    _serialize_incident(existing, request),
                    status=status.HTTP_200_OK,
                )

        etype = data["_emergency_type"]

        incident = EmergencyIncident.objects.create(
            created_by=request.user,
            type=etype,
            family_id=data.get("family_id"),
            visit_id=data.get("visit_id"),
            status=EmergencyIncident.Status.OPEN,
            severity_level=etype.severity_level,
            summary=data.get("summary") or None,
            details=data.get("details") or None,
            trigger_method=data.get("trigger_method", "slide"),
            lat=data.get("lat"),
            lng=data.get("lng"),
            accuracy_m=data.get("accuracy_m"),
            network_state=data.get("network_state", "online"),
            client_id=client_id,
        )

        # Business timeline
        EmergencyAction.objects.create(
            incident=incident,
            actor=request.user,
            action_type=EmergencyAction.ActionType.CREATED,
            message=f"Emergency triggered: {etype.label_fr} (severity {etype.severity_level})",
        )

        # Technical audit
        log_action(
            actor=request.user,
            action="create",
            entity_type="emergency_incident",
            entity_id=str(incident.id),
            meta={
                "type_key": etype.key,
                "severity": etype.severity_level,
                "trigger_method": incident.trigger_method,
                "network_state": incident.network_state,
                "client_id": str(client_id) if client_id else None,
            },
        )

        # Notify admins
        try:
            _notify_admins_on_trigger(incident)
        except Exception:
            pass  # Don't fail the trigger if notification fails

        return Response(
            _serialize_incident(incident, request),
            status=status.HTTP_201_CREATED,
        )


# ─── C/D/E) List / Mine / Detail ────────────────────────────


class EmergencyIncidentViewSet(viewsets.ReadOnlyModelViewSet):
    """
    GET /api/emergencies/          — list (admin=all, agent=own/assigned families)
    GET /api/emergencies/mine/     — agent's own incidents
    GET /api/emergencies/{id}/     — detail
    """

    serializer_class = EmergencyIncidentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = (
            EmergencyIncident.objects
            .select_related("type", "created_by", "assigned_admin", "family")
            .prefetch_related("actions__actor")
        )

        # RBAC
        if user.role != "admin":
            qs = qs.filter(
                Q(created_by=user)
                | Q(family__assigned_to=user)
                | Q(family__created_by=user)
            )

        # Filters
        status_filter = self.request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter)

        type_filter = self.request.query_params.get("type")
        if type_filter:
            qs = qs.filter(type__key=type_filter)

        created_by_filter = self.request.query_params.get("created_by")
        if created_by_filter:
            qs = qs.filter(created_by_id=created_by_filter)

        since_filter = self.request.query_params.get("since")
        if since_filter:
            qs = qs.filter(created_at__gte=since_filter)

        return qs.order_by("-created_at")

    @action(detail=False, methods=["get"], url_path="mine")
    def mine(self, request):
        """GET /api/emergencies/mine/ — incidents created by current user."""
        qs = self.get_queryset().filter(created_by=request.user)
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)

    # ─── F) Acknowledge ──────────────────────────────────────

    @action(detail=True, methods=["post"], permission_classes=[IsAdmin])
    def acknowledge(self, request, pk=None):
        """POST /api/emergencies/{id}/acknowledge/"""
        incident = self.get_object()

        if incident.status != EmergencyIncident.Status.OPEN:
            return Response(
                {"detail": f"Cannot acknowledge: current status is '{incident.status}'."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        incident.status = EmergencyIncident.Status.ACKNOWLEDGED
        incident.acknowledged_at = timezone.now()
        incident.save(update_fields=["status", "acknowledged_at", "updated_at"])

        EmergencyAction.objects.create(
            incident=incident,
            actor=request.user,
            action_type=EmergencyAction.ActionType.STATUS_CHANGE,
            message=f"Acknowledged by {_user_name(request.user)}",
        )

        log_action(
            actor=request.user,
            action="acknowledge",
            entity_type="emergency_incident",
            entity_id=str(incident.id),
        )

        return Response(_serialize_incident(incident, request))

    # ─── G) Status change ────────────────────────────────────

    @action(detail=True, methods=["post"], url_path="status", permission_classes=[IsAdmin])
    def set_status(self, request, pk=None):
        """POST /api/emergencies/{id}/status/"""
        incident = self.get_object()

        serializer = StatusChangeSerializer(
            data=request.data,
            context={"incident": incident},
        )
        serializer.is_valid(raise_exception=True)

        old_status = incident.status
        new_status = serializer.validated_data["status"]
        message = serializer.validated_data.get("message", "")

        incident.status = new_status
        update_fields = ["status", "updated_at"]

        if new_status == "resolved":
            incident.resolved_at = timezone.now()
            update_fields.append("resolved_at")
        elif new_status == "closed":
            incident.closed_at = timezone.now()
            update_fields.append("closed_at")

        incident.save(update_fields=update_fields)

        action_msg = f"Status: {old_status} → {new_status}"
        if message:
            action_msg += f". {message}"

        EmergencyAction.objects.create(
            incident=incident,
            actor=request.user,
            action_type=EmergencyAction.ActionType.STATUS_CHANGE,
            message=action_msg,
        )

        log_action(
            actor=request.user,
            action="status_change",
            entity_type="emergency_incident",
            entity_id=str(incident.id),
            meta={"old_status": old_status, "new_status": new_status},
        )

        return Response(_serialize_incident(incident, request))

    # ─── H) Add note ─────────────────────────────────────────

    @action(detail=True, methods=["post"], url_path="actions")
    def add_action_note(self, request, pk=None):
        """POST /api/emergencies/{id}/actions/"""
        incident = self.get_object()

        serializer = ActionNoteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        ea = EmergencyAction.objects.create(
            incident=incident,
            actor=request.user,
            action_type=EmergencyAction.ActionType.NOTE,
            message=serializer.validated_data["message"],
        )

        log_action(
            actor=request.user,
            action="add_note",
            entity_type="emergency_incident",
            entity_id=str(incident.id),
            meta={"action_id": str(ea.id)},
        )

        from .serializers import EmergencyActionSerializer

        return Response(
            EmergencyActionSerializer(ea).data,
            status=status.HTTP_201_CREATED,
        )

    # ─── I) Assign ───────────────────────────────────────────

    @action(detail=True, methods=["post"], permission_classes=[IsAdmin])
    def assign(self, request, pk=None):
        """POST /api/emergencies/{id}/assign/"""
        incident = self.get_object()

        serializer = AssignSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        from apps.accounts.models import User

        admin_user = User.objects.get(id=serializer.validated_data["admin_id"])
        incident.assigned_admin = admin_user
        incident.save(update_fields=["assigned_admin", "updated_at"])

        EmergencyAction.objects.create(
            incident=incident,
            actor=request.user,
            action_type=EmergencyAction.ActionType.ASSIGN,
            message=f"Assigned to {_user_name(admin_user)}",
        )

        log_action(
            actor=request.user,
            action="assign",
            entity_type="emergency_incident",
            entity_id=str(incident.id),
            meta={"assigned_admin_id": str(admin_user.id)},
        )

        return Response(_serialize_incident(incident, request))
