from rest_framework import serializers, viewsets
from rest_framework.permissions import IsAuthenticated

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
