import uuid

from django.conf import settings
from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models


class UserManager(BaseUserManager):
    """Custom manager: email is the unique identifier for login."""

    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError("Email is required")
        email = self.normalize_email(email)
        extra_fields.setdefault("is_active", True)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("role", "admin")
        return self.create_user(email, password, **extra_fields)


class User(AbstractUser):
    """
    Custom user: UUID PK, email as login identifier.
    Maps to SQL: users table with role constraint.
    """

    class Role(models.TextChoices):
        AGENT = "agent", "Agent"
        ADMIN = "admin", "Admin"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    username = models.CharField(max_length=150, blank=True, default="")
    email = models.EmailField(unique=True)
    role = models.CharField(
        max_length=10,
        choices=Role.choices,
        default=Role.AGENT,
    )

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    objects = UserManager()

    class Meta:
        db_table = "users"
        indexes = [
            models.Index(fields=["role"], name="users_role_idx"),
        ]

    def __str__(self):
        return self.email


class WebAuthnCredential(models.Model):
    """
    Stores WebAuthn public-key credentials (passkeys).
    No biometric data is stored — only the public credential.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="webauthn_credentials",
    )
    credential_id = models.TextField(unique=True, help_text="Base64url-encoded credential ID")
    public_key = models.BinaryField(help_text="COSE public key bytes")
    sign_count = models.BigIntegerField(default=0)
    transports = models.JSONField(null=True, blank=True, help_text='e.g. ["internal","hybrid"]')
    aaguid = models.CharField(max_length=36, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    last_used_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "webauthn_credentials"
        indexes = [
            models.Index(fields=["user"], name="webauthn_user_idx"),
        ]

    def __str__(self):
        return f"Passkey {self.credential_id[:16]}… ({self.user.email})"
