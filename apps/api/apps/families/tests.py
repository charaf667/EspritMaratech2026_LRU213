"""
Unit tests for families app: model, serializers, views, bbox filtering, map endpoint.

Run with: python manage.py test apps.families --settings=config.settings_test --keepdb
"""

import uuid
from datetime import timedelta

from django.test import TransactionTestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import User

from .models import Family
from .serializers import FamilyListSerializer


def _uid():
    return uuid.uuid4().hex[:8]


class FamilyModelTests(TransactionTestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email=f"agent-{_uid()}@test.org", password="pass", role="agent",
        )

    def test_create_family(self):
        f = Family.objects.create(
            head_name="Test Family",
            household_size=4,
            lat=36.8065,
            lng=10.1815,
            created_by=self.user,
        )
        self.assertIsNotNone(f.id)
        self.assertEqual(str(f), "Test Family (4)")

    def test_priority_override_choices(self):
        f = Family.objects.create(
            head_name="Urgent Family",
            household_size=2,
            lat=36.80,
            lng=10.18,
            priority_override="urgent",
            created_by=self.user,
        )
        self.assertEqual(f.priority_override, "urgent")


class FamilySerializerTests(TransactionTestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email=f"agent-{_uid()}@test.org", password="pass", role="agent",
        )
        self.now = timezone.now()

    def test_priority_overdue(self):
        f = Family.objects.create(
            head_name="Overdue",
            household_size=3,
            lat=36.80,
            lng=10.18,
            next_due_at=self.now - timedelta(days=5),
            created_by=self.user,
        )
        data = FamilyListSerializer(f).data
        self.assertEqual(data["priority"], "overdue")

    def test_priority_urgent(self):
        f = Family.objects.create(
            head_name="Urgent",
            household_size=3,
            lat=36.80,
            lng=10.18,
            priority_override="urgent",
            next_due_at=self.now + timedelta(days=5),
            created_by=self.user,
        )
        data = FamilyListSerializer(f).data
        self.assertEqual(data["priority"], "urgent")

    def test_priority_normal(self):
        f = Family.objects.create(
            head_name="Normal",
            household_size=3,
            lat=36.80,
            lng=10.18,
            next_due_at=self.now + timedelta(days=30),
            created_by=self.user,
        )
        data = FamilyListSerializer(f).data
        self.assertEqual(data["priority"], "normal")

    def test_serializer_fields(self):
        f = Family.objects.create(
            head_name="Fields",
            household_size=5,
            lat=36.80,
            lng=10.18,
            zone_label="Zone Nord",
            created_by=self.user,
        )
        data = FamilyListSerializer(f).data
        expected_fields = {
            "id", "head_name", "household_size", "phone", "address_text",
            "zone_label", "lat", "lng", "last_visit_at", "next_due_at",
            "priority", "priority_override", "assigned_to_id", "created_by_id",
            "vulnerability_tags", "has_accessibility_need", "accessibility_types",
            "accessibility_verification", "vulnerability_notes", "ocr_used",
            "created_at", "updated_at",
        }
        self.assertEqual(set(data.keys()), expected_fields)


class FamilyViewTests(TransactionTestCase):
    def setUp(self):
        self.client = APIClient()
        self._tag = _uid()
        self.agent = User.objects.create_user(
            email=f"agent-{self._tag}@test.org", password="pass", role="agent",
        )
        self.admin = User.objects.create_user(
            email=f"admin-{self._tag}@test.org", password="pass", role="admin",
        )
        self.now = timezone.now()

        # Record count before our additions
        self._pre_count = Family.objects.count()

        # Create 5 test families with a unique tag in name for filtering
        self._families = []
        for i in range(5):
            f = Family.objects.create(
                head_name=f"TF-{self._tag}-{i}",
                household_size=i + 2,
                lat=36.80 + i * 0.01,
                lng=10.18 + i * 0.01,
                zone_label="Zone TestN" if i < 3 else "Zone TestS",
                created_by=self.agent,
                assigned_to=self.agent if i < 3 else None,
                next_due_at=self.now - timedelta(days=i),
            )
            self._families.append(f)

    def test_list_requires_auth(self):
        resp = self.client.get("/api/families/")
        self.assertEqual(resp.status_code, 403)

    def test_list_as_admin_includes_our_families(self):
        self.client.force_authenticate(user=self.admin)
        resp = self.client.get(f"/api/families/?search=TF-{self._tag}")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["count"], 5)

    def test_list_as_agent_rbac(self):
        self.client.force_authenticate(user=self.agent)
        resp = self.client.get(f"/api/families/?search=TF-{self._tag}")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["count"], 5)

    def test_search(self):
        self.client.force_authenticate(user=self.admin)
        target = self._families[0].head_name
        resp = self.client.get(f"/api/families/?search={target}")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["count"], 1)

    def test_zone_filter(self):
        self.client.force_authenticate(user=self.admin)
        resp = self.client.get("/api/families/?zone=Zone TestN")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["count"], 3)

    def test_bbox_filter(self):
        self.client.force_authenticate(user=self.admin)
        resp = self.client.get("/api/families/?bbox=10.17,36.79,10.20,36.82")
        self.assertEqual(resp.status_code, 200)
        self.assertGreater(resp.json()["count"], 0)

    def test_bbox_invalid_ignored(self):
        self.client.force_authenticate(user=self.admin)
        resp = self.client.get(f"/api/families/?bbox=invalid&search=TF-{self._tag}")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["count"], 5)

    def test_v1_endpoint(self):
        self.client.force_authenticate(user=self.admin)
        resp = self.client.get(f"/api/v1/families/?search=TF-{self._tag}")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["count"], 5)

    def test_pagination(self):
        self.client.force_authenticate(user=self.admin)
        resp = self.client.get(f"/api/families/?page_size=2&search=TF-{self._tag}")
        data = resp.json()
        self.assertEqual(len(data["results"]), 2)
        self.assertIsNotNone(data["next"])


class FamilyMapViewTests(TransactionTestCase):
    def setUp(self):
        self.client = APIClient()
        self._tag = _uid()
        self.admin = User.objects.create_user(
            email=f"admin-{self._tag}@test.org", password="pass", role="admin",
        )
        self.other_agent = User.objects.create_user(
            email=f"other-{self._tag}@test.org", password="pass", role="agent",
        )

        # Families in a very specific lat/lng range no seed data uses
        for i in range(3):
            Family.objects.create(
                head_name=f"MapF-{self._tag}-{i}",
                household_size=3,
                lat=10.00 + i * 0.02,
                lng=20.00 + i * 0.02,
                created_by=self.admin,
            )

    def test_map_requires_auth(self):
        resp = self.client.get("/api/families/map/")
        self.assertEqual(resp.status_code, 403)

    def test_map_returns_flat_array(self):
        self.client.force_authenticate(user=self.admin)
        resp = self.client.get("/api/families/map/")
        self.assertEqual(resp.status_code, 200)
        self.assertIsInstance(resp.json(), list)

    def test_map_minimal_fields(self):
        self.client.force_authenticate(user=self.admin)
        resp = self.client.get("/api/families/map/")
        data = resp.json()
        self.assertGreater(len(data), 0)
        expected_keys = {"id", "head_name", "lat", "lng", "zone_label", "priority", "next_due_at", "last_visit_at"}
        self.assertEqual(set(data[0].keys()), expected_keys)

    def test_map_bbox_filter(self):
        self.client.force_authenticate(user=self.admin)
        # Tight bbox around our specific test families (lat~10, lng~20)
        resp = self.client.get("/api/families/map/?bbox=19.99,9.99,20.05,10.05")
        data = resp.json()
        self.assertIsInstance(data, list)
        self.assertGreater(len(data), 0)
        self.assertLessEqual(len(data), 3)

    def test_map_v1_endpoint(self):
        self.client.force_authenticate(user=self.admin)
        resp = self.client.get("/api/v1/families/map/")
        self.assertEqual(resp.status_code, 200)

    def test_map_agent_rbac(self):
        self.client.force_authenticate(user=self.other_agent)
        # Tight bbox — agent sees 0 because families were created by admin
        resp = self.client.get("/api/families/map/?bbox=19.99,9.99,20.05,10.05")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.json()), 0)
