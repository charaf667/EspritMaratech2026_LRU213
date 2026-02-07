"""Seed default notification templates (idempotent)."""

from django.core.management.base import BaseCommand

from apps.notifications.models import NotificationTemplate


TEMPLATES = [
    {
        "key": "overdue_reminder",
        "channel": "email",
        "subject_template": "[OMNIA] Famille en retard : {family_name}",
        "body_template": (
            "Bonjour {agent_name},\n\n"
            "La famille {family_name} est en retard de {days_overdue} jour(s) "
            "(échéance : {due_date}).\n\n"
            "Merci de planifier une visite dès que possible.\n\n"
            "— OMNIA"
        ),
    },
    {
        "key": "overdue_reminder",
        "channel": "sms",
        "subject_template": "",
        "body_template": (
            "OMNIA: Famille {family_name} en retard ({days_overdue}j). "
            "Échéance: {due_date}. Planifiez une visite SVP."
        ),
    },
    {
        "key": "assignment_notification",
        "channel": "email",
        "subject_template": "[OMNIA] Nouvelle famille assignée : {family_name}",
        "body_template": (
            "Bonjour {agent_name},\n\n"
            "La famille {family_name} vous a été assignée.\n\n"
            "Merci de consulter le dossier dans l'application.\n\n"
            "— OMNIA"
        ),
    },
]


class Command(BaseCommand):
    help = "Seed default notification templates"

    def handle(self, *args, **options):
        created = 0
        for tmpl_data in TEMPLATES:
            _, was_created = NotificationTemplate.objects.get_or_create(
                key=tmpl_data["key"],
                channel=tmpl_data["channel"],
                defaults={
                    "subject_template": tmpl_data["subject_template"],
                    "body_template": tmpl_data["body_template"],
                },
            )
            if was_created:
                created += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Seeded {created} notification templates "
                f"({len(TEMPLATES)} total, {len(TEMPLATES) - created} already existed)"
            )
        )
