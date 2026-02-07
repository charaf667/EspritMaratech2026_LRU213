from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from .models import AidType
from .serializers import AidTypeSerializer


class AidTypeViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only list of active aid types."""

    serializer_class = AidTypeSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None  # Return all aid types in a flat list

    def get_queryset(self):
        return AidType.objects.filter(is_active=True).order_by("key")
