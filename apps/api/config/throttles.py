"""
Custom DRF throttle classes.
"""

from rest_framework.throttling import AnonRateThrottle


class LoginRateThrottle(AnonRateThrottle):
    """Strict per-IP throttle for login attempts."""

    scope = "login"
