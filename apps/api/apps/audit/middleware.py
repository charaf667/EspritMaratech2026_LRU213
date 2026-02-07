"""
Thread-local middleware to capture request.user for audit signals.
"""

import threading

_thread_locals = threading.local()


def get_current_user():
    """Return the current request user, or None if unavailable."""
    return getattr(_thread_locals, "user", None)


class AuditUserMiddleware:
    """Store request.user in thread-local so post_save signals can access it."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        _thread_locals.user = getattr(request, "user", None)
        try:
            return self.get_response(request)
        finally:
            _thread_locals.user = None
