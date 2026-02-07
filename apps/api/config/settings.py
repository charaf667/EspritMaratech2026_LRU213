"""
Django settings for OMNIA Charity Tracking API.
"""

import os
from pathlib import Path

from dotenv import load_dotenv

# Load .env from repo root (two levels up from apps/api/)
ENV_PATH = Path(__file__).resolve().parent.parent.parent.parent / ".env"
load_dotenv(ENV_PATH)

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.environ.get(
    "DJANGO_SECRET_KEY", "insecure-dev-key-change-me"
)

DEBUG = os.environ.get("DJANGO_DEBUG", "True").lower() in ("true", "1", "yes")

ALLOWED_HOSTS = [
    h.strip()
    for h in os.environ.get("ALLOWED_HOSTS", "localhost,127.0.0.1").split(",")
    if h.strip()
]

# ─── Installed apps ──────────────────────────────────────────

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # Third-party
    "rest_framework",
    "corsheaders",
    # Local apps
    "apps.accounts",
    "apps.families",
    "apps.visits",
    "apps.aids",
    "apps.attachments",
    "apps.complaints",
    "apps.cards",
    "apps.audit",
    "apps.stt",
    "apps.routing",
    "apps.ocr",
    "apps.exports",
    "apps.notifications",
    "apps.emergencies",
    "apps.attestations",
    "django.contrib.postgres",
]

# ─── Middleware ───────────────────────────────────────────────

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "apps.audit.middleware.AuditUserMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

# ─── Database ────────────────────────────────────────────────

_database_url = os.environ.get("DATABASE_URL")

if _database_url:
    import dj_database_url

    DATABASES = {
        "default": dj_database_url.parse(_database_url, conn_max_age=600),
    }
else:
    # Fallback: try PG* env vars, else use sqlite for bootstrapping
    _pg_host = os.environ.get("PGHOST")
    if _pg_host:
        DATABASES = {
            "default": {
                "ENGINE": "django.db.backends.postgresql",
                "HOST": _pg_host,
                "PORT": os.environ.get("PGPORT", "5432"),
                "NAME": os.environ.get("PGDATABASE", "omnia"),
                "USER": os.environ.get("PGUSER", "omnia"),
                "PASSWORD": os.environ.get("PGPASSWORD", ""),
            }
        }
    else:
        # TODO: INCONNU (à confirmer) — SQLite fallback for local dev without PG
        DATABASES = {
            "default": {
                "ENGINE": "django.db.backends.sqlite3",
                "NAME": BASE_DIR / "db.sqlite3",
            }
        }

# ─── Auth ────────────────────────────────────────────────────

AUTH_USER_MODEL = "accounts.User"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# ─── i18n ────────────────────────────────────────────────────

LANGUAGE_CODE = "fr"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

# ─── Static files ────────────────────────────────────────────

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# ─── DRF ─────────────────────────────────────────────────────

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework.authentication.SessionAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_RENDERER_CLASSES": [
        "rest_framework.renderers.JSONRenderer",
    ],
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "anon": "60/minute",
        "user": "300/minute",
        "login": "5/minute",
    },
    "EXCEPTION_HANDLER": "config.exception_handler.custom_exception_handler",
}

# ─── CORS (dev) ──────────────────────────────────────────────
# In production, set CORS_ALLOWED_ORIGINS to the actual frontend origin
# and set CORS_ALLOW_CREDENTIALS = True.

CORS_ALLOWED_ORIGINS = [
    o.strip()
    for o in os.environ.get(
        "CORS_ALLOWED_ORIGINS", "http://localhost:3000"
    ).split(",")
    if o.strip()
]
CORS_ALLOW_CREDENTIALS = True

# ─── CSRF ────────────────────────────────────────────────────

CSRF_TRUSTED_ORIGINS = CORS_ALLOWED_ORIGINS[:]
CSRF_COOKIE_HTTPONLY = False  # Frontend JS needs to read csrftoken cookie
CSRF_COOKIE_SAMESITE = "Lax"
CSRF_COOKIE_SECURE = not DEBUG
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Lax"
SESSION_COOKIE_SECURE = not DEBUG
SESSION_COOKIE_AGE = 60 * 60 * 24 * 7  # 7 days
SESSION_SAVE_EVERY_REQUEST = True  # Refresh expiry on every request

CORS_PREFLIGHT_MAX_AGE = 86400  # Cache preflight for 24 hours

# ─── FastAPI internal service ────────────────────────────────

SVC_BASE_URL = "http://{}:{}".format(
    os.environ.get("SVC_HOST", "127.0.0.1"),
    os.environ.get("SVC_PORT", "8001"),
)
SVC_INTERNAL_TOKEN = os.environ.get("SVC_INTERNAL_TOKEN", "change-me-internal-secret")

# ─── WebAuthn (Passkeys) ───────────────────────────────────
WEBAUTHN_RP_ID = os.environ.get("WEBAUTHN_RP_ID", "localhost")
WEBAUTHN_RP_NAME = os.environ.get("WEBAUTHN_RP_NAME", "OMNIA Charity Tracking")
WEBAUTHN_ORIGIN = os.environ.get("WEBAUTHN_ORIGIN", "http://localhost:3000")
WEBAUTHN_CHALLENGE_TIMEOUT_MS = 300_000  # 5 minutes

# ─── Rate limiting ──────────────────────────────────────────
RATELIMIT_ENABLE = not DEBUG

# ─── Email ──────────────────────────────────────────────────
EMAIL_BACKEND = os.environ.get(
    "EMAIL_BACKEND", "django.core.mail.backends.console.EmailBackend"
)
EMAIL_HOST = os.environ.get("EMAIL_HOST", "localhost")
EMAIL_PORT = int(os.environ.get("EMAIL_PORT", "587"))
EMAIL_HOST_USER = os.environ.get("EMAIL_HOST_USER", "")
EMAIL_HOST_PASSWORD = os.environ.get("EMAIL_HOST_PASSWORD", "")
EMAIL_USE_TLS = os.environ.get("EMAIL_USE_TLS", "true").lower() in ("true", "1")
DEFAULT_FROM_EMAIL = os.environ.get("DEFAULT_FROM_EMAIL", "noreply@omnia.org")

# ─── SMS Gateway ────────────────────────────────────────────
SMS_GATEWAY_URL = os.environ.get("SMS_GATEWAY_URL", "")
SMS_GATEWAY_TOKEN = os.environ.get("SMS_GATEWAY_TOKEN", "")

# ─── Sentry (error monitoring) ─────────────────────────────
SENTRY_DSN = os.environ.get("SENTRY_DSN", "")
if SENTRY_DSN:
    import sentry_sdk
    from sentry_sdk.integrations.django import DjangoIntegration

    sentry_sdk.init(
        dsn=SENTRY_DSN,
        integrations=[DjangoIntegration()],
        traces_sample_rate=float(os.environ.get("SENTRY_TRACES_SAMPLE_RATE", "0.1")),
        send_default_pii=False,
        environment=os.environ.get("SENTRY_ENVIRONMENT", "development"),
    )
