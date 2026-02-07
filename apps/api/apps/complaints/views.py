from django.db.models import Q
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.audit.utils import log_action
from apps.common.permissions import IsAdmin

from .models import Complaint, ComplaintMessage
from .serializers import ComplaintMessageSerializer, ComplaintSerializer


class ComplaintViewSet(viewsets.ModelViewSet):
    """
    RBAC: agent sees complaints for families they created/are assigned to.
    Admin sees all.

    Status transitions: open → in_progress → resolved → closed
    """

    serializer_class = ComplaintSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = Complaint.objects.select_related(
            "family", "visit", "created_by", "assigned_to"
        ).prefetch_related("messages__author")

        if user.role != "admin":
            qs = qs.filter(
                Q(created_by=user)
                | Q(family__assigned_to=user)
                | Q(family__created_by=user)
            )

        # Filter by status
        status_filter = self.request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter)

        # Filter by priority
        priority_filter = self.request.query_params.get("priority")
        if priority_filter:
            qs = qs.filter(priority=priority_filter)

        return qs.order_by("-created_at")

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def perform_update(self, serializer):
        old_status = serializer.instance.status
        instance = serializer.save()

        # Set resolved_at when transitioning to resolved
        if instance.status == "resolved" and old_status != "resolved":
            instance.resolved_at = timezone.now()
            instance.save(update_fields=["resolved_at"])

        log_action(
            actor=self.request.user,
            action="update",
            entity_type="complaint",
            entity_id=str(instance.id),
            meta={"old_status": old_status, "new_status": instance.status},
        )

    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticated])
    def add_message(self, request, pk=None):
        """
        POST /api/complaints/{id}/add_message/
        Body: {"message": "..."}
        """
        complaint = self.get_object()
        message_text = request.data.get("message", "").strip()

        if not message_text:
            return Response(
                {"detail": "Message cannot be empty."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        msg = ComplaintMessage.objects.create(
            complaint=complaint,
            author=request.user,
            message=message_text,
        )

        log_action(
            actor=request.user,
            action="add_message",
            entity_type="complaint",
            entity_id=str(complaint.id),
            meta={"message_id": str(msg.id)},
        )

        return Response(
            ComplaintMessageSerializer(msg).data,
            status=status.HTTP_201_CREATED,
        )
