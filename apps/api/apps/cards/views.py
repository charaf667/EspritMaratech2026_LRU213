from django.utils import timezone
from django_ratelimit.decorators import ratelimit
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from apps.audit.utils import log_action
from apps.visits.serializers import VisitAidReadSerializer

from .models import BeneficiaryCard


@ratelimit(key="ip", rate="5/m", method="POST", block=True)
@api_view(["POST"])
@permission_classes([AllowAny])
def redeem_view(request):
    """
    POST /api/feeling/redeem/
    Body: { "code_short": "ABC123" }

    Validates the card is not expired and not revoked.
    Returns an opaque access_token for subsequent card detail requests.
    """
    code = request.data.get("code_short", "").strip().upper()
    if not code:
        return Response(
            {"detail": "code_short is required."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        card = BeneficiaryCard.objects.select_related(
            "family", "visit"
        ).get(code_short=code)
    except BeneficiaryCard.DoesNotExist:
        return Response(
            {"detail": "Invalid code."},
            status=status.HTTP_404_NOT_FOUND,
        )

    now = timezone.now()
    if card.is_revoked:
        return Response(
            {"detail": "This card has been revoked."},
            status=status.HTTP_403_FORBIDDEN,
        )
    if card.expires_at < now:
        return Response(
            {"detail": "This card has expired."},
            status=status.HTTP_410_GONE,
        )

    # Log access to audit
    log_action(
        actor=None,
        action="redeem",
        entity_type="card",
        entity_id=card.pk,
        meta={"ip": _get_client_ip(request)},
    )

    return Response({
        "token": card.access_token,
        "family_name": card.family.head_name,
    })


@ratelimit(key="ip", rate="20/m", method="GET", block=True)
@api_view(["GET"])
@permission_classes([AllowAny])
def card_detail_view(request, token):
    """
    GET /api/feeling/card/<token>/

    Returns read-only snapshot of the beneficiary card.
    Looks up by access_token (opaque), increments access_count.
    """
    try:
        card = BeneficiaryCard.objects.select_related(
            "family", "visit"
        ).get(access_token=token)
    except BeneficiaryCard.DoesNotExist:
        return Response(
            {"detail": "Invalid token."},
            status=status.HTTP_404_NOT_FOUND,
        )

    now = timezone.now()
    if card.is_revoked:
        return Response(
            {"detail": "This card has been revoked."},
            status=status.HTTP_403_FORBIDDEN,
        )
    if card.expires_at < now:
        return Response(
            {"detail": "This card has expired."},
            status=status.HTTP_410_GONE,
        )

    # Track access
    card.last_accessed_at = now
    card.access_count = (card.access_count or 0) + 1
    card.save(update_fields=["last_accessed_at", "access_count"])

    # Log access
    log_action(
        actor=None,
        action="access",
        entity_type="card",
        entity_id=card.pk,
        meta={"ip": _get_client_ip(request), "access_count": card.access_count},
    )

    visit = card.visit
    aids_data = []
    if visit:
        visit_aids = visit.aids.select_related("aid_type").all()
        aids_data = VisitAidReadSerializer(visit_aids, many=True).data

    return Response({
        "family_name": card.family.head_name,
        "family_id": str(card.family.id),
        "phone": card.family.phone,
        "visit_date": visit.visited_at.isoformat() if visit else None,
        "aids": aids_data,
        "next_action": "Prochain suivi dans 30 jours",
        "code_short": card.code_short,
    })


def _get_client_ip(request):
    """Extract client IP from request headers."""
    xff = request.META.get("HTTP_X_FORWARDED_FOR")
    if xff:
        return xff.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR", "unknown")
