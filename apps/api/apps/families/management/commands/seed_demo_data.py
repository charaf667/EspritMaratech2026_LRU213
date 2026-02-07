"""
Seed demo families, visits, complaints, and beneficiary cards for testing.
Idempotent — skips if families already exist.

Usage:
    python manage.py seed_demo_data
"""

import secrets
import string
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.accounts.models import User
from apps.aids.models import AidType
from apps.cards.models import BeneficiaryCard
from apps.complaints.models import Complaint, ComplaintMessage
from apps.families.models import Family
from apps.visits.models import Visit, VisitAid


DEMO_FAMILIES = [
    {
        "head_name": "Fatima Ben Ali",
        "household_size": 5,
        "phone": "+21671000001",
        "address_text": "12 Rue de la Liberté, Tunis",
        "zone_label": "Zone Nord",
        "lat": 36.8065,
        "lng": 10.1815,
        "priority_override": None,
        "next_due_days_ago": 5,  # overdue
    },
    {
        "head_name": "Ahmed Mansouri",
        "household_size": 3,
        "phone": "+21671000002",
        "address_text": "45 Avenue Habib Bourguiba, Tunis",
        "zone_label": "Zone Sud",
        "lat": 36.7990,
        "lng": 10.1700,
        "priority_override": "urgent",
        "next_due_days_ago": -2,
    },
    {
        "head_name": "Khadija El Amri",
        "household_size": 7,
        "phone": "+21671000003",
        "address_text": "8 Rue Ibn Khaldoun, La Marsa",
        "zone_label": "Zone Nord",
        "lat": 36.8785,
        "lng": 10.3235,
        "priority_override": None,
        "next_due_days_ago": -10,  # normal, not due yet
    },
    {
        "head_name": "Mohamed Trabelsi",
        "household_size": 4,
        "phone": "+21671000004",
        "address_text": "23 Rue de Carthage, Carthage",
        "zone_label": "Zone Est",
        "lat": 36.8528,
        "lng": 10.3233,
        "priority_override": None,
        "next_due_days_ago": 15,  # overdue
    },
    {
        "head_name": "Amina Bouazizi",
        "household_size": 6,
        "phone": "+21671000005",
        "address_text": "67 Avenue Mohamed V, Ariana",
        "zone_label": "Zone Nord",
        "lat": 36.8625,
        "lng": 10.1935,
        "priority_override": "urgent",
        "next_due_days_ago": 1,
    },
    {
        "head_name": "Youssef Gharbi",
        "household_size": 2,
        "phone": "",
        "address_text": "15 Rue de Marseille, Tunis",
        "zone_label": "Zone Sud",
        "lat": 36.7945,
        "lng": 10.1780,
        "priority_override": None,
        "next_due_days_ago": -20,
    },
    {
        "head_name": "Salma Hamdi",
        "household_size": 8,
        "phone": "+21671000007",
        "address_text": "3 Rue Farhat Hached, Manouba",
        "zone_label": "Zone Est",
        "lat": 36.8100,
        "lng": 10.0970,
        "priority_override": None,
        "next_due_days_ago": 8,  # overdue
    },
]


def _short_code(length=6):
    chars = string.ascii_uppercase + string.digits
    return "".join(secrets.choice(chars) for _ in range(length))


class Command(BaseCommand):
    help = "Seed demo families, visits, complaints, and cards (idempotent)."

    def handle(self, *args, **options):
        if Family.objects.exists():
            self.stdout.write("Demo families already exist — skipping.")
            return

        # Require users + aid types to be seeded first
        try:
            agent = User.objects.get(email="sara@omnia.org")
            admin_user = User.objects.get(email="admin@omnia.org")
        except User.DoesNotExist:
            self.stderr.write(
                self.style.ERROR(
                    "Run seed_demo_users first: python manage.py seed_demo_users"
                )
            )
            return

        aid_types = list(AidType.objects.all())
        if not aid_types:
            self.stderr.write(
                self.style.ERROR(
                    "Run seed_aid_types first: python manage.py seed_aid_types"
                )
            )
            return

        now = timezone.now()

        # ── Create families ──
        families = []
        for i, data in enumerate(DEMO_FAMILIES):
            assigned = agent if i % 2 == 0 else None
            created_by = agent if i < 4 else admin_user
            next_due = now - timedelta(days=data["next_due_days_ago"])
            last_visit = now - timedelta(days=data["next_due_days_ago"] + 15)

            f = Family.objects.create(
                head_name=data["head_name"],
                household_size=data["household_size"],
                phone=data["phone"] or None,
                address_text=data["address_text"],
                zone_label=data["zone_label"],
                lat=data["lat"],
                lng=data["lng"],
                priority_override=data["priority_override"],
                next_due_at=next_due,
                last_visit_at=last_visit,
                created_by=created_by,
                assigned_to=assigned,
            )
            families.append(f)
            self.stdout.write(f"  Created family: {f.head_name}")

        # ── Create visits (2 per family) ──
        visits_created = 0
        for f in families:
            for j in range(2):
                visit_date = now - timedelta(days=15 + j * 20)
                visit = Visit.objects.create(
                    family=f,
                    created_by=agent,
                    visited_at=visit_date,
                    motive="distribution" if j == 0 else "follow_up",
                    notes=f"Visite #{j + 1} pour {f.head_name}",
                    is_urgent=f.priority_override == "urgent" and j == 0,
                    urgent_reason="Situation critique" if f.priority_override == "urgent" and j == 0 else "",
                    next_due_at=visit_date + timedelta(days=30),
                )

                # Add 2-3 aids per visit
                for k, at in enumerate(aid_types[:3]):
                    VisitAid.objects.create(
                        visit=visit,
                        aid_type=at,
                        quantity=k + 1,
                    )

                # Generate card for most recent visit
                if j == 0:
                    BeneficiaryCard.objects.create(
                        family=f,
                        visit=visit,
                        code_short=_short_code(),
                        expires_at=now + timedelta(days=7),
                    )

                visits_created += 1

        # ── Create complaints ──
        complaints_created = 0
        complaint_families = families[:3]
        for f in complaint_families:
            visit = f.visits.first()
            complaint = Complaint.objects.create(
                family=f,
                visit=visit,
                created_by=agent,
                category="missing_aid",
                priority="medium",
                status="open",
            )
            ComplaintMessage.objects.create(
                complaint=complaint,
                author=agent,
                message=f"Signalement pour la famille {f.head_name}: aide manquante lors de la dernière visite.",
            )
            complaints_created += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"\nDemo seed complete:\n"
                f"  {len(families)} families\n"
                f"  {visits_created} visits\n"
                f"  {complaints_created} complaints\n"
                f"  {len(families)} beneficiary cards"
            )
        )
