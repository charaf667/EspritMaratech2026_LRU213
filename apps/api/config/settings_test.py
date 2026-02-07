"""
Test settings for OMNIA.
Usage: python manage.py test --settings=config.settings_test --keepdb
"""

from config.settings import *  # noqa: F401,F403

# Point TEST to the same DB name so --keepdb works without CREATEDB privilege
DATABASES["default"]["TEST"] = {"NAME": DATABASES["default"]["NAME"]}  # noqa: F405

# Disable django-ratelimit decorator in tests
RATELIMIT_ENABLE = False

# Speed up password hashing in tests
PASSWORD_HASHERS = [
    "django.contrib.auth.hashers.MD5PasswordHasher",
]
