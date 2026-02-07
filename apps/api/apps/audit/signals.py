"""
Post-save signals for automatic audit logging.
"""

from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver

from .middleware import get_current_user
from .utils import log_action


def _audit_post_save(sender, instance, created, entity_type, **kwargs):
    """Generic post_save handler."""
    user = get_current_user()
    # Skip if user is anonymous and not authenticated
    if user and not user.is_authenticated:
        user = None
    action = "create" if created else "update"
    log_action(
        actor=user,
        action=action,
        entity_type=entity_type,
        entity_id=instance.pk,
    )


def _audit_post_delete(sender, instance, entity_type, **kwargs):
    """Generic post_delete handler."""
    user = get_current_user()
    if user and not user.is_authenticated:
        user = None
    log_action(
        actor=user,
        action="delete",
        entity_type=entity_type,
        entity_id=instance.pk,
    )


@receiver(post_save, sender="families.Family")
def audit_family_save(sender, instance, created, **kwargs):
    _audit_post_save(sender, instance, created, "family", **kwargs)


@receiver(post_save, sender="visits.Visit")
def audit_visit_save(sender, instance, created, **kwargs):
    _audit_post_save(sender, instance, created, "visit", **kwargs)


@receiver(post_save, sender="complaints.Complaint")
def audit_complaint_save(sender, instance, created, **kwargs):
    _audit_post_save(sender, instance, created, "complaint", **kwargs)


@receiver(post_save, sender="attachments.Attachment")
def audit_attachment_save(sender, instance, created, **kwargs):
    _audit_post_save(sender, instance, created, "attachment", **kwargs)


@receiver(post_save, sender="cards.BeneficiaryCard")
def audit_card_save(sender, instance, created, **kwargs):
    _audit_post_save(sender, instance, created, "card", **kwargs)
