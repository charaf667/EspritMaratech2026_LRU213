from django.db.models import Q
from rest_framework import status, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Visit
from .serializers import VisitCreateSerializer, VisitListSerializer


class VisitViewSet(viewsets.ModelViewSet):
    """
    Visits CRUD.

    GET /api/visits/?family_id=<uuid>  — list visits for a family (desc)
    POST /api/visits/                  — create visit from wizard payload
    GET /api/visits/<id>/              — visit detail

    RBAC: agent sees own visits, admin sees all.
    """

    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.action == "create":
            return VisitCreateSerializer
        return VisitListSerializer

    def get_queryset(self):
        user = self.request.user
        qs = Visit.objects.select_related(
            "family", "created_by", "attestation"
        ).prefetch_related("aids__aid_type", "beneficiary_cards")

        # RBAC
        if user.role != "admin":
            qs = qs.filter(
                Q(created_by=user)
                | Q(family__assigned_to=user)
                | Q(family__created_by=user)
            )

        # Filter by family_id
        family_id = self.request.query_params.get("family_id")
        if family_id:
            qs = qs.filter(family_id=family_id)

        # Filter by attestation status
        attested = self.request.query_params.get("attested")
        if attested == "false":
            qs = qs.filter(attestation__isnull=True)
        elif attested == "true":
            qs = qs.filter(attestation__isnull=False)

        return qs.order_by("-visited_at")

    def create(self, request, *args, **kwargs):
        # Idempotency: if client_id is provided, check for existing visit
        client_id = request.data.get("client_id")
        if client_id:
            existing = Visit.objects.filter(
                notes__contains=f"[client_id:{client_id}]"
            ).first()
            if existing:
                existing_full = Visit.objects.select_related(
                    "family", "created_by", "attestation"
                ).prefetch_related(
                    "aids__aid_type", "beneficiary_cards"
                ).get(id=existing.id)
                return Response(
                    VisitListSerializer(existing_full, context={"request": request}).data,
                    status=status.HTTP_200_OK,
                )

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        visit = serializer.save()

        # Return the created visit with full read serializer
        read_serializer = VisitListSerializer(
            visit,
            context={"request": request},
        )
        # Need to re-fetch with select_related for proper serialization
        visit_full = Visit.objects.select_related(
            "family", "created_by", "attestation"
        ).prefetch_related(
            "aids__aid_type", "beneficiary_cards"
        ).get(id=visit.id)
        read_serializer = VisitListSerializer(
            visit_full, context={"request": request}
        )
        return Response(read_serializer.data, status=status.HTTP_201_CREATED)
