import uuid

from django.db import models


class UUIDModel(models.Model):
    """Abstract base: UUID primary key."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    class Meta:
        abstract = True


class TimeStampedUUIDModel(UUIDModel):
    """Abstract base: UUID pk + created_at/updated_at."""

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True
