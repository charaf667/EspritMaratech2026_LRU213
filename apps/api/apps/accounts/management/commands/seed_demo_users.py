"""
Idempotent seed command for demo users (dev only).

Usage:
    python manage.py seed_demo_users
"""

from django.core.management.base import BaseCommand

from apps.accounts.models import User

DEMO_USERS = [
    {
        "email": "admin@omnia.org",
        "first_name": "Nadia",
        "last_name": "Hadj",
        "role": "admin",
        "is_staff": True,
        "is_superuser": True,
    },
    {
        "email": "sara@omnia.org",
        "first_name": "Sara",
        "last_name": "Mansouri",
        "role": "agent",
        "is_staff": False,
        "is_superuser": False,
    },
]

PASSWORD = "dev12345"


class Command(BaseCommand):
    help = "Create demo users for local development (idempotent)."

    def handle(self, *args, **options):
        created_count = 0

        for data in DEMO_USERS:
            email = data["email"]
            user, created = User.objects.get_or_create(
                email=email,
                defaults={
                    "first_name": data["first_name"],
                    "last_name": data["last_name"],
                    "role": data["role"],
                    "is_staff": data["is_staff"],
                    "is_superuser": data["is_superuser"],
                },
            )
            if created:
                user.set_password(PASSWORD)
                user.save(update_fields=["password"])
                created_count += 1
                self.stdout.write(f"  Created {email} (role={data['role']})")
            else:
                self.stdout.write(f"  Already exists: {email}")

        self.stdout.write(
            self.style.SUCCESS(
                f"Demo users seed done: {created_count} created, "
                f"{len(DEMO_USERS) - created_count} already existed."
            )
        )
        if created_count:
            self.stdout.write(f"  Password for new users: {PASSWORD}")
