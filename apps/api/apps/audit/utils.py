"""
Audit logging helper.
"""

import logging

from .models import AuditLog

logger = logging.getLogger(__name__)


def log_action(actor, action, entity_type, entity_id, meta=None):
    """
    Create an AuditLog entry.

    Args:
        actor: User instance or None (for anonymous access).
        action: e.g. "create", "update", "delete", "access", "download".
        entity_type: e.g. "family", "visit", "complaint", "attachment", "card".
        entity_id: UUID of the entity.
        meta: optional dict with extra context.
    """
    try:
        AuditLog.objects.create(
            actor=actor,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            meta=meta,
        )
    except Exception:
        logger.exception(
            "Failed to create audit log: %s %s:%s", action, entity_type, entity_id
        )
