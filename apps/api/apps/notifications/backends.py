"""
Custom Django email backend using Resend API.

Usage in settings.py:
    EMAIL_BACKEND = "apps.notifications.backends.ResendEmailBackend"
    RESEND_API_KEY = "re_xxxxxxxxxxxx"
    DEFAULT_FROM_EMAIL = "OMNIA <noreply@yourdomain.com>"
"""

import logging

import resend
from django.conf import settings
from django.core.mail.backends.base import BaseEmailBackend

logger = logging.getLogger(__name__)


class ResendEmailBackend(BaseEmailBackend):
    """Django email backend that sends via Resend API."""

    def __init__(self, fail_silently=False, **kwargs):
        super().__init__(fail_silently=fail_silently, **kwargs)
        api_key = getattr(settings, "RESEND_API_KEY", "")
        if api_key:
            resend.api_key = api_key
        else:
            logger.warning("RESEND_API_KEY not set — emails will fail")

    def send_messages(self, email_messages):
        """Send one or more EmailMessage objects, return number sent."""
        if not email_messages:
            return 0

        sent_count = 0
        for msg in email_messages:
            try:
                params = {
                    "from_": msg.from_email or getattr(
                        settings, "DEFAULT_FROM_EMAIL", "OMNIA <noreply@omnia.org>"
                    ),
                    "to": list(msg.to),
                    "subject": msg.subject,
                }

                # Use HTML body if available, otherwise plain text
                if hasattr(msg, "alternatives") and msg.alternatives:
                    # EmailMultiAlternatives — pick the HTML alternative
                    for content, mimetype in msg.alternatives:
                        if mimetype == "text/html":
                            params["html"] = content
                            break
                    else:
                        params["html"] = msg.body
                else:
                    params["html"] = msg.body

                # CC / BCC / Reply-To
                if msg.cc:
                    params["cc"] = list(msg.cc)
                if msg.bcc:
                    params["bcc"] = list(msg.bcc)
                if msg.reply_to:
                    params["reply_to"] = msg.reply_to[0]

                r = resend.Emails.send(params)
                logger.info("Resend email sent: id=%s to=%s", r.get("id", "?"), msg.to)
                sent_count += 1

            except Exception as exc:
                logger.exception("Resend email failed to %s: %s", msg.to, exc)
                if not self.fail_silently:
                    raise

        return sent_count
