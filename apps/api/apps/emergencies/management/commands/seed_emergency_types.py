"""
Idempotent seed command for EmergencyType reference rows.

Usage:
    python manage.py seed_emergency_types
"""

from django.core.management.base import BaseCommand

from apps.emergencies.models import EmergencyType

# (key, label_fr, label_ar, severity_level, is_agent_safety)
EMERGENCY_TYPES = [
    ("medical", "Urgence médicale", "\u0637\u0648\u0627\u0631\u0626 \u0637\u0628\u064a\u0629", 5, False),
    ("abuse", "Maltraitance / abus", "\u0633\u0648\u0621 \u0645\u0639\u0627\u0645\u0644\u0629", 5, False),
    ("unsafe_housing", "Logement dangereux", "\u0633\u0643\u0646 \u063a\u064a\u0631 \u0622\u0645\u0646", 4, False),
    ("agent_threat", "Menace envers l'agent", "\u062a\u0647\u062f\u064a\u062f \u0644\u0644\u0639\u0627\u0645\u0644", 5, True),
    ("fall_injury", "Chute / blessure", "\u0633\u0642\u0648\u0637 / \u0625\u0635\u0627\u0628\u0629", 4, False),
    ("other", "Autre urgence", "\u0637\u0648\u0627\u0631\u0626 \u0623\u062e\u0631\u0649", 3, False),
]


class Command(BaseCommand):
    help = "Seed EmergencyType reference rows (idempotent)."

    def handle(self, *args, **options):
        created_count = 0
        updated_count = 0

        for key, label_fr, label_ar, severity, is_agent_safety in EMERGENCY_TYPES:
            obj, created = EmergencyType.objects.get_or_create(
                key=key,
                defaults={
                    "label_fr": label_fr,
                    "label_ar": label_ar,
                    "severity_level": severity,
                    "is_agent_safety": is_agent_safety,
                },
            )
            if created:
                created_count += 1
            else:
                changed = False
                for attr, val in [
                    ("label_fr", label_fr),
                    ("label_ar", label_ar),
                    ("severity_level", severity),
                    ("is_agent_safety", is_agent_safety),
                ]:
                    if getattr(obj, attr) != val:
                        setattr(obj, attr, val)
                        changed = True
                if changed:
                    obj.save()
                    updated_count += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"EmergencyType seed done: {created_count} created, {updated_count} updated, "
                f"{len(EMERGENCY_TYPES) - created_count - updated_count} unchanged."
            )
        )
