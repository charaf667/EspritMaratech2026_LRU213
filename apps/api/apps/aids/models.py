from django.db import models

from apps.common.models import UUIDModel


class AidType(UUIDModel):
    """Lookup table: types of aid that can be distributed."""

    key = models.CharField(max_length=100, unique=True)
    label_fr = models.CharField(max_length=255)
    label_ar = models.CharField(max_length=255)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "aid_types"
        indexes = [
            models.Index(
                fields=["is_active"],
                name="aid_types_active_idx",
                condition=models.Q(is_active=True),
            ),
        ]

    def __str__(self):
        return self.key
