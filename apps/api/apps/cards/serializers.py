from rest_framework import serializers

from apps.visits.serializers import VisitAidReadSerializer

from .models import BeneficiaryCard


class BeneficiaryCardSerializer(serializers.ModelSerializer):
    class Meta:
        model = BeneficiaryCard
        fields = "__all__"


class RedeemRequestSerializer(serializers.Serializer):
    code_short = serializers.CharField(max_length=6)


class FeelingCardSerializer(serializers.Serializer):
    """Read-only snapshot for the beneficiary portal."""

    family_name = serializers.CharField()
    family_id = serializers.UUIDField()
    phone = serializers.CharField(allow_null=True)
    visit_date = serializers.DateTimeField()
    aids = VisitAidReadSerializer(many=True)
    next_action = serializers.CharField()
    code_short = serializers.CharField()
