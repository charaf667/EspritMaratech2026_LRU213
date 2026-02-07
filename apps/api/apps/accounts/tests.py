"""
Unit tests for accounts app: auth views, serializers, throttling.
"""

import uuid

from django.test import TestCase, TransactionTestCase, override_settings
from rest_framework.test import APIClient

from .models import User


def _uid():
    return uuid.uuid4().hex[:8]


class UserModelTests(TestCase):
    def test_create_user(self):
        email = f"test-{_uid()}@omnia.org"
        user = User.objects.create_user(
            email=email, password="testpass123",
            first_name="Test", last_name="User",
        )
        self.assertEqual(user.email, email)
        self.assertEqual(user.role, "agent")
        self.assertTrue(user.check_password("testpass123"))
        self.assertTrue(user.is_active)
        self.assertFalse(user.is_staff)

    def test_create_superuser(self):
        user = User.objects.create_superuser(
            email=f"admin-{_uid()}@test.org", password="adminpass",
        )
        self.assertTrue(user.is_staff)
        self.assertTrue(user.is_superuser)
        self.assertEqual(user.role, "admin")

    def test_create_user_no_email_raises(self):
        with self.assertRaises(ValueError):
            User.objects.create_user(email="", password="test")


class AuthViewTests(TransactionTestCase):
    def setUp(self):
        self.client = APIClient()
        self._email = f"sara-{_uid()}@omnia.org"
        self.user = User.objects.create_user(
            email=self._email, password="dev12345",
            first_name="Sara", last_name="Mansouri", role="agent",
        )

    def test_csrf_view(self):
        resp = self.client.get("/api/auth/csrf/")
        self.assertEqual(resp.status_code, 200)
        self.assertIn("csrfToken", resp.json())

    def test_login_success(self):
        resp = self.client.post("/api/auth/login/", {
            "email": self._email, "password": "dev12345",
        }, format="json")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["email"], self._email)
        self.assertEqual(data["role"], "agent")
        self.assertIn("id", data)

    def test_login_wrong_password(self):
        resp = self.client.post("/api/auth/login/", {
            "email": self._email, "password": "wrong",
        }, format="json")
        self.assertEqual(resp.status_code, 401)

    def test_login_invalid_email(self):
        resp = self.client.post("/api/auth/login/", {
            "email": f"notauser-{_uid()}@omnia.org", "password": "dev12345",
        }, format="json")
        self.assertEqual(resp.status_code, 401)

    def test_login_missing_fields(self):
        resp = self.client.post("/api/auth/login/", {}, format="json")
        self.assertEqual(resp.status_code, 400)

    def test_me_authenticated(self):
        self.client.force_authenticate(user=self.user)
        resp = self.client.get("/api/auth/me/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["email"], self._email)

    def test_me_unauthenticated(self):
        resp = self.client.get("/api/auth/me/")
        self.assertEqual(resp.status_code, 403)

    def test_logout(self):
        self.client.force_authenticate(user=self.user)
        resp = self.client.post("/api/auth/logout/")
        self.assertEqual(resp.status_code, 200)

    def test_users_list_admin_only(self):
        self.client.force_authenticate(user=self.user)
        resp = self.client.get("/api/auth/users/")
        self.assertEqual(resp.status_code, 403)

    def test_users_list_as_admin(self):
        admin = User.objects.create_user(
            email=f"admin-{_uid()}@omnia.org", password="dev12345", role="admin",
        )
        self.client.force_authenticate(user=admin)
        resp = self.client.get("/api/auth/users/")
        self.assertEqual(resp.status_code, 200)
        self.assertIsInstance(resp.json(), list)
        self.assertGreaterEqual(len(resp.json()), 2)


class AuthVersioningTests(TransactionTestCase):
    """Verify both /api/ and /api/v1/ routes work."""

    def setUp(self):
        self.client = APIClient()

    def test_csrf_unversioned(self):
        resp = self.client.get("/api/auth/csrf/")
        self.assertEqual(resp.status_code, 200)

    def test_v1_families_requires_auth(self):
        resp = self.client.get("/api/v1/families/")
        self.assertEqual(resp.status_code, 403)

    def test_unversioned_families_requires_auth(self):
        resp = self.client.get("/api/families/")
        self.assertEqual(resp.status_code, 403)


@override_settings(
    REST_FRAMEWORK={
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
            "login": "2/minute",
        },
        "EXCEPTION_HANDLER": "config.exception_handler.custom_exception_handler",
    }
)
class LoginThrottleTests(TransactionTestCase):
    """Verify login endpoint is throttled."""

    def setUp(self):
        self.client = APIClient()
        self._email = f"throttle-{_uid()}@test.org"
        User.objects.create_user(email=self._email, password="pass")

    def test_login_throttled_after_limit(self):
        for _ in range(2):
            self.client.post("/api/auth/login/", {
                "email": self._email, "password": "wrong",
            }, format="json")

        resp = self.client.post("/api/auth/login/", {
            "email": self._email, "password": "wrong",
        }, format="json")
        self.assertEqual(resp.status_code, 429)
