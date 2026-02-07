from rest_framework import serializers

from .models import AidType


class AidTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = AidType
        fields = ("id", "key", "label_fr", "label_ar")
        read_only_fields = fields
