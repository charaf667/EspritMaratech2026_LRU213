"""
Custom DRF exception handler — enriches throttle errors with Retry-After
and integrates with Sentry if available.
"""

import logging

from rest_framework.views import exception_handler

logger = logging.getLogger(__name__)


def custom_exception_handler(exc, context):
    response = exception_handler(exc, context)

    if response is not None:
        # Enrich 429 with clear message
        if response.status_code == 429:
            retry_after = response.get("Retry-After", "60")
            response.data = {
                "detail": f"Too many requests. Retry after {retry_after}s.",
                "retry_after": int(retry_after) if retry_after.isdigit() else 60,
            }
            logger.warning(
                "Rate limit hit: view=%s ip=%s",
                context.get("view", "unknown"),
                context.get("request", {}).META.get("REMOTE_ADDR", "?")
                if hasattr(context.get("request", {}), "META")
                else "?",
            )

        # Capture 500s in Sentry if installed
        if response.status_code >= 500:
            try:
                import sentry_sdk
                sentry_sdk.capture_exception(exc)
            except ImportError:
                pass

    return response
