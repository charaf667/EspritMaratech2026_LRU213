"""
Idempotent seed command for the 10 AidType reference rows.

Usage:
    python manage.py seed_aid_types
"""

from django.core.management.base import BaseCommand

from apps.aids.models import AidType

AID_TYPES = [
    ("food_parcel", "Colis alimentaire", "\u0637\u0631\u062f \u063a\u0630\u0627\u0626\u064a"),
    ("medicines", "M\u00e9dicaments", "\u0623\u062f\u0648\u064a\u0629"),
    ("hygiene", "Hygi\u00e8ne", "\u0646\u0638\u0627\u0641\u0629"),
    ("clothes_blankets", "V\u00eatements / couvertures", "\u0645\u0644\u0627\u0628\u0633 / \u0623\u063a\u0637\u064a\u0629"),
    ("baby", "B\u00e9b\u00e9 (lait/couches)", "\u0631\u0636\u064a\u0639 (\u062d\u0644\u064a\u0628/\u062d\u0641\u0627\u0636\u0627\u062a)"),
    ("school", "Scolaire", "\u0645\u062f\u0631\u0633\u064a"),
    ("transport", "Transport", "\u0646\u0642\u0644"),
    ("housing", "Logement (loyer/h\u00e9bergement)", "\u0633\u0643\u0646 (\u0625\u064a\u062c\u0627\u0631/\u0625\u064a\u0648\u0627\u0621)"),
    ("financial", "Aide financi\u00e8re", "\u0645\u0633\u0627\u0639\u062f\u0629 \u0645\u0627\u0644\u064a\u0629"),
    ("specific_other", "Aide sp\u00e9cifique (Autre)", "\u0645\u0633\u0627\u0639\u062f\u0629 \u062e\u0627\u0635\u0629 (\u0623\u062e\u0631\u0649)"),
]


class Command(BaseCommand):
    help = "Seed the 10 AidType reference rows (idempotent)."

    def handle(self, *args, **options):
        created_count = 0
        updated_count = 0

        for key, label_fr, label_ar in AID_TYPES:
            obj, created = AidType.objects.get_or_create(
                key=key,
                defaults={"label_fr": label_fr, "label_ar": label_ar},
            )
            if created:
                created_count += 1
            else:
                changed = False
                if obj.label_fr != label_fr:
                    obj.label_fr = label_fr
                    changed = True
                if obj.label_ar != label_ar:
                    obj.label_ar = label_ar
                    changed = True
                if changed:
                    obj.save(update_fields=["label_fr", "label_ar"])
                    updated_count += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"AidType seed done: {created_count} created, {updated_count} updated, "
                f"{len(AID_TYPES) - created_count - updated_count} unchanged."
            )
        )
