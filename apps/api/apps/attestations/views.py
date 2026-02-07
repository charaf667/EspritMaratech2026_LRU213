from django.db.models import Q
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.audit.utils import log_action

from .models import VisitAttestation
from .serializers import CreateAttestationSerializer, VisitAttestationSerializer


def _get_visit_with_rbac(user, visit_id):
    """Fetch a visit with RBAC: agent=own/assigned, admin=all."""
    from apps.visits.models import Visit

    qs = Visit.objects.select_related("family", "created_by")
    if user.role != "admin":
        qs = qs.filter(
            Q(created_by=user)
            | Q(family__assigned_to=user)
            | Q(family__created_by=user)
        )
    try:
        return qs.get(id=visit_id)
    except Visit.DoesNotExist:
        return None


class VisitAttestationView(APIView):
    """
    GET  /api/visits/{visit_id}/attestation/  — retrieve attestation
    POST /api/visits/{visit_id}/attestation/  — create attestation (sign or cannot_sign)
    """

    permission_classes = [IsAuthenticated]

    def get(self, request, visit_id):
        visit = _get_visit_with_rbac(request.user, visit_id)
        if not visit:
            return Response(
                {"detail": "Visit not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        try:
            attestation = VisitAttestation.objects.select_related(
                "created_by"
            ).get(visit=visit)
        except VisitAttestation.DoesNotExist:
            return Response(
                {"detail": "No attestation for this visit."},
                status=status.HTTP_404_NOT_FOUND,
            )

        return Response(VisitAttestationSerializer(attestation).data)

    def post(self, request, visit_id):
        visit = _get_visit_with_rbac(request.user, visit_id)
        if not visit:
            return Response(
                {"detail": "Visit not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = CreateAttestationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        # Idempotency via client_id
        client_id = data.get("client_id")
        if client_id:
            existing = VisitAttestation.objects.filter(client_id=client_id).first()
            if existing:
                existing = VisitAttestation.objects.select_related(
                    "created_by"
                ).get(id=existing.id)
                return Response(
                    VisitAttestationSerializer(existing).data,
                    status=status.HTTP_200_OK,
                )

        # One attestation per visit
        if VisitAttestation.objects.filter(visit=visit).exists():
            return Response(
                {"detail": "This visit already has an attestation."},
                status=status.HTTP_409_CONFLICT,
            )

        status_val = data["status"]
        signed_at = timezone.now() if status_val == "signed" else None

        attestation = VisitAttestation.objects.create(
            visit=visit,
            created_by=request.user,
            status=status_val,
            signed_at=signed_at,
            signer_name=data.get("signer_name") or None,
            signer_role=data["signer_role"],
            signature_svg=data.get("signature_svg") or None,
            reason_cannot_sign=data.get("reason_cannot_sign") or None,
            witness_name=data.get("witness_name") or None,
            lat=data.get("lat"),
            lng=data.get("lng"),
            accuracy_m=data.get("accuracy_m"),
            client_id=client_id,
        )

        # Audit log
        log_action(
            actor=request.user,
            action="create",
            entity_type="visit_attestation",
            entity_id=str(attestation.id),
            meta={
                "visit_id": str(visit.id),
                "status": status_val,
                "signer_role": data["signer_role"],
                "client_id": str(client_id) if client_id else None,
            },
        )

        attestation = VisitAttestation.objects.select_related(
            "created_by"
        ).get(id=attestation.id)

        return Response(
            VisitAttestationSerializer(attestation).data,
            status=status.HTTP_201_CREATED,
        )


class AttestationListView(APIView):
    """
    GET /api/attestations/?missing=true  — visits without attestations
    GET /api/attestations/               — all attestations (admin filter)
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        missing = request.query_params.get("missing", "").lower() == "true"

        if missing:
            # Return visits that don't have an attestation
            from apps.visits.models import Visit

            qs = Visit.objects.select_related(
                "family", "created_by"
            ).filter(attestation__isnull=True)

            if request.user.role != "admin":
                qs = qs.filter(
                    Q(created_by=request.user)
                    | Q(family__assigned_to=request.user)
                    | Q(family__created_by=request.user)
                )

            qs = qs.order_by("-visited_at")[:100]

            from apps.visits.serializers import VisitListSerializer

            return Response(VisitListSerializer(qs, many=True).data)

        # All attestations
        qs = VisitAttestation.objects.select_related(
            "visit", "created_by"
        ).order_by("-created_at")

        if request.user.role != "admin":
            qs = qs.filter(
                Q(created_by=request.user)
                | Q(visit__family__assigned_to=request.user)
                | Q(visit__family__created_by=request.user)
            )

        status_filter = request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter)

        qs = qs[:100]
        return Response(VisitAttestationSerializer(qs, many=True).data)
