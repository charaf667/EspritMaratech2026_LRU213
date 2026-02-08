from rest_framework import serializers, status, viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.common.permissions import IsAdmin

from .models import NotificationLog, NotificationTemplate


class NotificationLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = NotificationLog
        fields = (
            "id", "template", "recipient_user", "recipient_address",
            "channel", "subject", "body", "status", "error_message",
            "sent_at", "family", "created_at",
        )
        read_only_fields = fields


class NotificationLogViewSet(viewsets.ReadOnlyModelViewSet):
    """Admin-only: view notification logs."""
    serializer_class = NotificationLogSerializer
    permission_classes = [IsAuthenticated, IsAdmin]

    def get_queryset(self):
        qs = NotificationLog.objects.select_related(
            "template", "recipient_user", "family"
        ).order_by("-created_at")

        # Filter by status
        status_filter = self.request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter)

        # Filter by channel
        channel_filter = self.request.query_params.get("channel")
        if channel_filter:
            qs = qs.filter(channel=channel_filter)

        return qs


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsAdmin])
def send_test_email(request):
    """POST /api/notifications/test-email/ — send a test email to current user."""
    from .email_service import send_welcome_email

    log = send_welcome_email(request.user)
    return Response(
        {
            "status": log.status,
            "to": log.recipient_address,
            "subject": log.subject,
            "error": log.error_message or None,
        },
        status=status.HTTP_200_OK if log.status == "sent" else status.HTTP_502_BAD_GATEWAY,
    )
