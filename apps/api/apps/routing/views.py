from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.services.svc_client import forward_route_compute


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def compute_route_view(request):
    """
    POST /api/routing/compute/
    Body: { "points": [{ "lat": ..., "lng": ..., "label": ... }, ...] }

    Forwards to FastAPI routing service for OSRM optimization.
    """
    points = request.data.get("points")
    if not points or not isinstance(points, list) or len(points) < 2:
        return Response(
            {"detail": "At least 2 points are required."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    result, error = forward_route_compute(points)
    if error:
        return Response(
            {"detail": error},
            status=status.HTTP_502_BAD_GATEWAY,
        )
    return Response(result)
