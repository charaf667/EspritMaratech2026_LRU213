"""
Notification sending services — email and SMS.

Uses Django's built-in email backend and a pluggable SMS gateway.
"""

import logging

from django.conf import settings
from django.core.mail import send_mail
from django.utils import timezone

from .models import NotificationLog, NotificationTemplate

logger = logging.getLogger(__name__)


def render_template(template: NotificationTemplate, context: dict) -> tuple[str, str]:
    """Render subject and body from template with context variables."""
    subject = template.subject_template
    body = template.body_template
    for key, value in context.items():
        placeholder = f"{{{key}}}"
        subject = subject.replace(placeholder, str(value))
        body = body.replace(placeholder, str(value))
    return subject, body


def send_email_notification(
    log: NotificationLog,
) -> bool:
    """Send an email notification and update the log status."""
    try:
        send_mail(
            subject=log.subject,
            message=log.body,
            from_email=getattr(settings, "DEFAULT_FROM_EMAIL", "noreply@omnia.org"),
            recipient_list=[log.recipient_address],
            fail_silently=False,
        )
        log.status = NotificationLog.Status.SENT
        log.sent_at = timezone.now()
        log.save(update_fields=["status", "sent_at", "updated_at"])
        return True
    except Exception as exc:
        logger.exception("Failed to send email to %s: %s", log.recipient_address, exc)
        log.status = NotificationLog.Status.FAILED
        log.error_message = str(exc)
        log.save(update_fields=["status", "error_message", "updated_at"])
        return False


def send_sms_notification(
    log: NotificationLog,
) -> bool:
    """
    Send an SMS notification.
    This is a stub — implement with your SMS gateway (Twilio, Vonage, etc.).
    """
    sms_gateway_url = getattr(settings, "SMS_GATEWAY_URL", None)

    if not sms_gateway_url:
        logger.warning("SMS gateway not configured, marking notification as failed")
        log.status = NotificationLog.Status.FAILED
        log.error_message = "SMS gateway not configured"
        log.save(update_fields=["status", "error_message", "updated_at"])
        return False

    try:
        import httpx

        response = httpx.post(
            sms_gateway_url,
            json={
                "to": log.recipient_address,
                "message": log.body,
            },
            headers={
                "Authorization": f"Bearer {getattr(settings, 'SMS_GATEWAY_TOKEN', '')}",
            },
            timeout=10.0,
        )
        if response.status_code in (200, 201, 202):
            log.status = NotificationLog.Status.SENT
            log.sent_at = timezone.now()
            log.save(update_fields=["status", "sent_at", "updated_at"])
            return True
        else:
            log.status = NotificationLog.Status.FAILED
            log.error_message = f"SMS gateway returned {response.status_code}"
            log.save(update_fields=["status", "error_message", "updated_at"])
            return False
    except Exception as exc:
        logger.exception("Failed to send SMS to %s: %s", log.recipient_address, exc)
        log.status = NotificationLog.Status.FAILED
        log.error_message = str(exc)
        log.save(update_fields=["status", "error_message", "updated_at"])
        return False


def dispatch_notification(log: NotificationLog) -> bool:
    """Dispatch a notification based on its channel."""
    if log.channel == NotificationTemplate.Channel.EMAIL:
        return send_email_notification(log)
    elif log.channel == NotificationTemplate.Channel.SMS:
        return send_sms_notification(log)
    else:
        logger.error("Unknown channel: %s", log.channel)
        return False
