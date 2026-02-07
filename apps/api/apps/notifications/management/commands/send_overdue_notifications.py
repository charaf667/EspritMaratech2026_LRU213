"""
Management command: send_overdue_notifications

Finds all overdue families (next_due_at < now) and sends a notification
to the assigned agent (or all admins if unassigned).

Usage:
    python manage.py send_overdue_notifications
    python manage.py send_overdue_notifications --channel email
    python manage.py send_overdue_notifications --dry-run
"""

from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.families.models import Family
from apps.notifications.models import NotificationLog, NotificationTemplate
from apps.notifications.services import dispatch_notification, render_template


class Command(BaseCommand):
    help = "Send notifications for overdue families to assigned agents"

    def add_arguments(self, parser):
        parser.add_argument(
            "--channel",
            default="email",
            choices=["email", "sms"],
            help="Notification channel (default: email)",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Print what would be sent without actually sending",
        )
        parser.add_argument(
            "--template-key",
            default="overdue_reminder",
            help="Template key to use (default: overdue_reminder)",
        )

    def handle(self, *args, **options):
        channel = options["channel"]
        dry_run = options["dry_run"]
        template_key = options["template_key"]
        now = timezone.now()

        # Get template
        try:
            template = NotificationTemplate.objects.get(
                key=template_key,
                channel=channel,
                is_active=True,
            )
        except NotificationTemplate.DoesNotExist:
            self.stderr.write(
                self.style.ERROR(
                    f"No active template found with key='{template_key}', channel='{channel}'. "
                    "Create one in the admin or via seed data."
                )
            )
            return

        # Find overdue families with assigned agents
        overdue_families = (
            Family.objects.filter(
                next_due_at__lt=now,
                assigned_to__isnull=False,
            )
            .select_related("assigned_to")
            .order_by("next_due_at")
        )

        sent_count = 0
        failed_count = 0

        for family in overdue_families:
            agent = family.assigned_to
            days_overdue = (now - family.next_due_at).days if family.next_due_at else 0

            # Determine recipient address
            recipient_address = agent.email if channel == "email" else ""
            if not recipient_address:
                self.stdout.write(
                    self.style.WARNING(
                        f"Skipping {family.head_name}: no {channel} address for agent {agent.email}"
                    )
                )
                continue

            # Check if already notified today for this family
            already_sent = NotificationLog.objects.filter(
                family=family,
                recipient_user=agent,
                channel=channel,
                status=NotificationLog.Status.SENT,
                sent_at__date=now.date(),
            ).exists()

            if already_sent:
                continue

            # Render template
            context = {
                "family_name": family.head_name,
                "agent_name": f"{agent.first_name} {agent.last_name}".strip() or agent.email,
                "due_date": family.next_due_at.strftime("%d/%m/%Y") if family.next_due_at else "N/A",
                "days_overdue": days_overdue,
            }
            subject, body = render_template(template, context)

            if dry_run:
                self.stdout.write(
                    f"[DRY RUN] Would send {channel} to {recipient_address}: "
                    f"{subject} | Family: {family.head_name} ({days_overdue}d overdue)"
                )
                sent_count += 1
                continue

            # Create log entry
            log = NotificationLog.objects.create(
                template=template,
                recipient_user=agent,
                recipient_address=recipient_address,
                channel=channel,
                subject=subject,
                body=body,
                family=family,
            )

            # Dispatch
            success = dispatch_notification(log)
            if success:
                sent_count += 1
            else:
                failed_count += 1

        action = "Would send" if dry_run else "Sent"
        self.stdout.write(
            self.style.SUCCESS(
                f"{action} {sent_count} notifications, {failed_count} failed "
                f"({overdue_families.count()} overdue families total)"
            )
        )
