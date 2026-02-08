"""
High-level email service for OMNIA.

Sends emails via Resend (or console in dev) using the Django email backend.
All sends are logged in NotificationLog for audit.
"""

import logging

from django.core.mail import send_mail
from django.conf import settings
from django.utils import timezone

from . import email_templates
from .models import NotificationLog, NotificationTemplate

logger = logging.getLogger(__name__)


def _send_and_log(
    to_email: str,
    subject: str,
    html_body: str,
    user=None,
    family=None,
    template_key: str = "",
) -> NotificationLog:
    """Send an email, log it, return the log entry."""
    log = NotificationLog.objects.create(
        template=NotificationTemplate.objects.filter(key=template_key).first() if template_key else None,
        recipient_user=user,
        recipient_address=to_email,
        channel="email",
        subject=subject,
        body=html_body,
        status=NotificationLog.Status.PENDING,
        family=family,
    )

    try:
        send_mail(
            subject=subject,
            message="",  # plain text fallback (empty — HTML only)
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[to_email],
            html_message=html_body,
            fail_silently=False,
        )
        log.status = NotificationLog.Status.SENT
        log.sent_at = timezone.now()
        log.save(update_fields=["status", "sent_at", "updated_at"])
        logger.info("Email sent to %s: %s", to_email, subject)
    except Exception as exc:
        log.status = NotificationLog.Status.FAILED
        log.error_message = str(exc)
        log.save(update_fields=["status", "error_message", "updated_at"])
        logger.exception("Email failed to %s: %s", to_email, exc)

    return log


# ─── Public API ──────────────────────────────────────────────


def send_visit_report(visit, agent_user=None):
    """Send visit report email to admin(s)."""
    from apps.accounts.models import User

    aids = []
    for va in visit.aids.select_related("aid_type").all():
        aids.append({
            "label": va.aid_type.label_fr,
            "qty": va.quantity,
        })

    family_name = visit.family.head_name
    agent_name = f"{agent_user.first_name} {agent_user.last_name}" if agent_user else "Agent"
    visit_date = visit.visited_at.strftime("%d/%m/%Y %H:%M")

    subject, html = email_templates.visit_report(
        family_name=family_name,
        agent_name=agent_name,
        visit_date=visit_date,
        aids=aids,
        is_urgent=visit.is_urgent,
        notes=visit.notes or "",
    )

    # Send to all admins
    admins = User.objects.filter(role="admin", is_active=True)
    logs = []
    for admin in admins:
        if admin.email:
            log = _send_and_log(
                to_email=admin.email,
                subject=subject,
                html_body=html,
                user=admin,
                family=visit.family,
                template_key="visit_report",
            )
            logs.append(log)
    return logs


def send_overdue_reminder(family, agent_user, days_overdue: int):
    """Send overdue visit reminder to assigned agent."""
    due_date = family.next_due_at.strftime("%d/%m/%Y") if family.next_due_at else "N/A"

    subject, html = email_templates.overdue_reminder(
        family_name=family.head_name,
        agent_name=f"{agent_user.first_name} {agent_user.last_name}",
        days_overdue=days_overdue,
        due_date=due_date,
    )

    return _send_and_log(
        to_email=agent_user.email,
        subject=subject,
        html_body=html,
        user=agent_user,
        family=family,
        template_key="overdue_reminder",
    )


def send_complaint_update(complaint, new_status: str, message: str = ""):
    """Send complaint status update to the agent who created it."""
    family_name = complaint.family.head_name if complaint.family else "N/A"
    user = complaint.created_by

    subject, html = email_templates.complaint_update(
        family_name=family_name,
        complaint_id=str(complaint.id),
        new_status=new_status,
        message=message,
    )

    if user and user.email:
        return _send_and_log(
            to_email=user.email,
            subject=subject,
            html_body=html,
            user=user,
            family=complaint.family,
            template_key="complaint_update",
        )
    return None


def send_welcome_email(user):
    """Send welcome email to a newly created user."""
    subject, html = email_templates.welcome(
        first_name=user.first_name or user.email.split("@")[0],
        email=user.email,
        role=user.role,
    )

    return _send_and_log(
        to_email=user.email,
        subject=subject,
        html_body=html,
        user=user,
        template_key="welcome",
    )


def send_emergency_alert(incident):
    """Send emergency alert to all admins."""
    from apps.accounts.models import User

    subject, html = email_templates.emergency_alert(
        emergency_type=incident.emergency_type_label if hasattr(incident, "emergency_type_label") else str(incident.emergency_type),
        triggered_by=incident.triggered_by.get_full_name() if incident.triggered_by else "Système",
        summary=incident.summary or "",
        location=f"{incident.lat}, {incident.lng}" if incident.lat and incident.lng else "",
    )

    admins = User.objects.filter(role="admin", is_active=True)
    logs = []
    for admin in admins:
        if admin.email:
            log = _send_and_log(
                to_email=admin.email,
                subject=subject,
                html_body=html,
                user=admin,
                template_key="emergency_alert",
            )
            logs.append(log)
    return logs
