"""
Seed stress-test data designed to trigger every dashboard KPI, Ops Brief section,
and edge-case scenario during a demo.

Creates:
  - 20 families (overdue, urgent, duplicates, missing data, accessibility needs)
  - 35+ visits (varied motives, some very old, some today)
  - 8 complaints (all priorities/statuses, some stale 20+ days)
  - 3 emergency incidents (open, acknowledged, in_progress)
  - Unbalanced agent workload (Sara: 14 families, Youssef: 4, Amina: 2)
  - Beneficiary cards for recent visits

NOT idempotent — meant to be run on a clean DB after seed_demo_users + seed_aid_types.

Usage:
    python manage.py seed_demo_stress
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
from apps.emergencies.models import EmergencyAction, EmergencyIncident, EmergencyType
from apps.families.models import Family
from apps.visits.models import Visit, VisitAid


def _code(length=6):
    return "".join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(length))


# ── Tunis area coordinates ──────────────────────────────────────
# Spread across different zones for realistic map display
STRESS_FAMILIES = [
    # ── GROUP 1: Heavily overdue (triggers Retards & Suivis en Souffrance) ──
    {
        "head_name": "Saida Bennani",
        "household_size": 6,
        "phone": "+21670100001",
        "address_text": "14 Rue de la Kasbah, Tunis",
        "zone_label": "Zone Nord",
        "lat": 36.8002, "lng": 10.1710,
        "priority_override": None,
        "next_due_days_ago": 32,     # 32 days overdue — critical
        "assigned_to": "sara",
        "accessibility": True,
        "accessibility_types": ["mobilite_reduite", "malvoyant"],
    },
    {
        "head_name": "Rachid Gharbi",
        "household_size": 4,
        "phone": "+21670100002",
        "address_text": "27 Rue du Pacha, Tunis",
        "zone_label": "Zone Nord",
        "lat": 36.8035, "lng": 10.1690,
        "priority_override": None,
        "next_due_days_ago": 18,     # 18 days overdue
        "assigned_to": "sara",
    },
    {
        "head_name": "Halima Mansouri",
        "household_size": 7,
        "phone": "+21670100003",
        "address_text": "5 Impasse des Jasmins, La Marsa",
        "zone_label": "Zone Est",
        "lat": 36.8780, "lng": 10.3240,
        "priority_override": None,
        "next_due_days_ago": 45,     # 45 days overdue — extreme
        "assigned_to": "sara",
    },

    # ── GROUP 2: Urgent cases (triggers Cas Urgents & Prioritaires) ──
    {
        "head_name": "Nadia Alaoui",
        "household_size": 5,
        "phone": "+21670100004",
        "address_text": "88 Avenue de Carthage, Tunis",
        "zone_label": "Zone Sud",
        "lat": 36.7955, "lng": 10.1800,
        "priority_override": "urgent",
        "next_due_days_ago": 3,
        "assigned_to": "sara",
        "urgent_reason": "Enfant de 3 ans avec malnutrition sévère — nécessite aide alimentaire immédiate",
    },
    {
        "head_name": "Omar Zouari",
        "household_size": 3,
        "phone": "+21670100005",
        "address_text": "12 Rue Farhat Hached, Manouba",
        "zone_label": "Zone Ouest",
        "lat": 36.8080, "lng": 10.0930,
        "priority_override": "urgent",
        "next_due_days_ago": 1,
        "assigned_to": "sara",
        "urgent_reason": "Avis d'expulsion reçu — famille risque de se retrouver sans domicile dans 48h",
    },
    {
        "head_name": "Leila Dridi",
        "household_size": 9,
        "phone": "+21670100006",
        "address_text": "3 Rue Ibn Khaldoun, Ariana",
        "zone_label": "Zone Nord",
        "lat": 36.8620, "lng": 10.1940,
        "priority_override": "urgent",
        "next_due_days_ago": 7,
        "assigned_to": "sara",
        "urgent_reason": "Chef de famille hospitalisé — 8 enfants sans supervision",
        "accessibility": True,
        "accessibility_types": ["personne_agee"],
    },

    # ── GROUP 3: Near-duplicate names (triggers Doublons suspectés) ──
    {
        "head_name": "Saïda Ben Nani",       # ~duplicate of "Saida Bennani"
        "household_size": 4,
        "phone": "+21670100007",
        "address_text": "16 Rue de la Kasbah, Tunis",
        "zone_label": "Zone Nord",
        "lat": 36.8005, "lng": 10.1715,
        "priority_override": None,
        "next_due_days_ago": -5,
        "assigned_to": "youssef",
    },
    {
        "head_name": "Halima El Mansouri",    # ~duplicate of "Halima Mansouri"
        "household_size": 7,
        "phone": "+21670100008",
        "address_text": "7 Impasse des Jasmins, La Marsa",
        "zone_label": "Zone Est",
        "lat": 36.8782, "lng": 10.3245,
        "priority_override": None,
        "next_due_days_ago": -8,
        "assigned_to": "youssef",
    },

    # ── GROUP 4: Missing data (triggers Qualité des Données) ──
    {
        "head_name": "Mohamed Ben Salah",
        "household_size": 5,
        "phone": "",                        # no phone
        "address_text": "",
        "zone_label": "Zone Sud",
        "lat": 36.7900, "lng": 10.1650,
        "priority_override": None,
        "next_due_days_ago": 10,
        "assigned_to": "sara",
        "no_visits": True,                  # never visited — SLA violation
    },
    {
        "head_name": "Aicha Ferchichi",
        "household_size": 3,
        "phone": "",                        # no phone
        "address_text": "Adresse inconnue",
        "zone_label": "",
        "lat": 36.7800, "lng": 10.1500,
        "priority_override": None,
        "next_due_days_ago": 5,
        "assigned_to": "sara",
        "no_visits": True,
    },
    {
        "head_name": "Khaled Trabelsi",
        "household_size": 2,
        "phone": "+21670100011",
        "address_text": "45 Rue de Marseille, Tunis",
        "zone_label": "Zone Sud",
        "lat": 36.7940, "lng": 10.1770,
        "priority_override": None,
        "next_due_days_ago": -15,           # not due yet
        "assigned_to": "sara",
    },

    # ── GROUP 5: Normal / on-time families (for contrast & SLA) ──
    {
        "head_name": "Fatima Bouazizi",
        "household_size": 6,
        "phone": "+21670100012",
        "address_text": "67 Avenue Mohamed V, Ariana",
        "zone_label": "Zone Nord",
        "lat": 36.8630, "lng": 10.1930,
        "priority_override": None,
        "next_due_days_ago": -20,
        "assigned_to": "sara",
    },
    {
        "head_name": "Youssef Hamdi",
        "household_size": 4,
        "phone": "+21670100013",
        "address_text": "9 Rue Farhat Hached, Manouba",
        "zone_label": "Zone Ouest",
        "lat": 36.8100, "lng": 10.0960,
        "priority_override": None,
        "next_due_days_ago": -12,
        "assigned_to": "youssef",
    },
    {
        "head_name": "Amira Chabane",
        "household_size": 5,
        "phone": "+21670100014",
        "address_text": "22 Rue du Lac, Les Berges du Lac",
        "zone_label": "Zone Est",
        "lat": 36.8350, "lng": 10.2300,
        "priority_override": None,
        "next_due_days_ago": -7,
        "assigned_to": "youssef",
    },
    {
        "head_name": "Slim Bouzid",
        "household_size": 3,
        "phone": "+21670100015",
        "address_text": "31 Avenue Habib Bourguiba, Tunis",
        "zone_label": "Zone Sud",
        "lat": 36.7995, "lng": 10.1700,
        "priority_override": None,
        "next_due_days_ago": -25,
        "assigned_to": "amina",
    },
    {
        "head_name": "Meryem Jaziri",
        "household_size": 8,
        "phone": "+21670100016",
        "address_text": "55 Rue de Palestine, Tunis",
        "zone_label": "Zone Nord",
        "lat": 36.8100, "lng": 10.1800,
        "priority_override": None,
        "next_due_days_ago": -3,
        "assigned_to": "amina",
        "accessibility": True,
        "accessibility_types": ["malentendant"],
    },

    # ── GROUP 6: Stale overdue — no agent assigned (worst case) ──
    {
        "head_name": "Abdelkader Sassi",
        "household_size": 2,
        "phone": "+21670100017",
        "address_text": "Zone rurale, Sidi Bou Said",
        "zone_label": "Zone Est",
        "lat": 36.8690, "lng": 10.3490,
        "priority_override": None,
        "next_due_days_ago": 60,     # 60 days overdue, no agent!
        "assigned_to": None,
        "no_visits": True,
    },
    {
        "head_name": "Zohra Khelifi",
        "household_size": 10,
        "phone": "+21670100018",
        "address_text": "Quartier informel, Ettadhamen",
        "zone_label": "Zone Ouest",
        "lat": 36.8300, "lng": 10.1100,
        "priority_override": "urgent",
        "next_due_days_ago": 14,
        "assigned_to": None,           # urgent + no agent = critical gap
        "urgent_reason": "10 personnes dont 6 enfants en bas âge, aucun suivi depuis 2 mois",
        "accessibility": True,
        "accessibility_types": ["mobilite_reduite", "malvoyant", "personne_agee"],
    },
    {
        "head_name": "Tarek Mejri",
        "household_size": 1,
        "phone": "",
        "address_text": "SDF — sans domicile fixe",
        "zone_label": "",
        "lat": 36.8010, "lng": 10.1660,
        "priority_override": "urgent",
        "next_due_days_ago": 25,
        "assigned_to": "sara",
        "urgent_reason": "Personne isolée sans abri, problèmes de santé mentale signalés",
        "no_visits": True,
    },
]

# ── Complaints covering all priorities and statuses ──
STRESS_COMPLAINTS = [
    # (family_index, category, priority, status, days_ago, message)
    (0, "missing_aid", "urgent", "open", 20,
     "Famille Bennani n'a reçu aucune aide alimentaire depuis plus de 30 jours malgré 3 relances. Situation critique avec enfants en bas âge."),
    (3, "delay", "high", "open", 8,
     "Aide médicale promise pour l'enfant malnutri toujours non livrée. Le médecin a prescrit un suivi hebdomadaire non respecté."),
    (4, "agent_behavior", "high", "in_progress", 12,
     "La famille signale que l'agent n'est pas venu lors du dernier rendez-vous prévu. Troisième absence consécutive."),
    (2, "missing_aid", "medium", "open", 5,
     "Kit d'hygiène non inclus dans la dernière distribution. La famille a des besoins spécifiques liés à une personne alitée."),
    (5, "other", "urgent", "open", 2,
     "Famille avec chef hospitalisé demande une aide d'urgence pour les 8 enfants restés seuls à domicile."),
    (9, "delay", "low", "resolved", 15,
     "Retard de livraison de couvertures signalé et résolu après intervention du coordinateur."),
    (10, "data_error", "medium", "in_progress", 6,
     "Erreur dans le montant d'aide enregistré lors de la dernière visite. Le système affiche 50 DT au lieu de 150 DT."),
    (17, "missing_aid", "urgent", "open", 1,
     "Famille de 10 personnes dont 6 enfants sans aucune aide depuis 2 mois. Situation humanitaire alarmante."),
]


class Command(BaseCommand):
    help = (
        "Seed stress-test data: 20 families, 35+ visits, 8 complaints, "
        "3 emergencies, unbalanced workload, duplicates, missing data."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--force",
            action="store_true",
            help="Run even if families already exist (adds on top).",
        )

    def handle(self, *args, **options):
        if Family.objects.exists() and not options["force"]:
            self.stderr.write(
                self.style.WARNING(
                    "Families already exist. Use --force to add stress data on top, "
                    "or reset DB first: python manage.py flush --no-input"
                )
            )
            return

        # ── Resolve users ──
        try:
            admin_user = User.objects.get(email="admin@omnia.org")
            sara = User.objects.get(email="sara@omnia.org")
        except User.DoesNotExist:
            self.stderr.write(self.style.ERROR("Run seed_demo_users first."))
            return

        # Create extra agents for workload imbalance
        youssef, _ = User.objects.get_or_create(
            email="youssef@omnia.org",
            defaults={
                "first_name": "Youssef",
                "last_name": "Mejri",
                "role": "agent",
                "is_active": True,
            },
        )
        if _:
            youssef.set_password("dev12345")
            youssef.save()
            self.stdout.write("  Created agent: youssef@omnia.org")

        amina, _ = User.objects.get_or_create(
            email="amina@omnia.org",
            defaults={
                "first_name": "Amina",
                "last_name": "Khediri",
                "role": "agent",
                "is_active": True,
            },
        )
        if _:
            amina.set_password("dev12345")
            amina.save()
            self.stdout.write("  Created agent: amina@omnia.org")

        agent_map = {"sara": sara, "youssef": youssef, "amina": amina}

        aid_types = list(AidType.objects.all())
        if not aid_types:
            self.stderr.write(self.style.ERROR("Run seed_aid_types first."))
            return

        now = timezone.now()

        # ── Create families ──
        families = []
        for data in STRESS_FAMILIES:
            next_due = now - timedelta(days=data["next_due_days_ago"])
            last_visit = None if data.get("no_visits") else now - timedelta(
                days=data["next_due_days_ago"] + 15
            )
            assigned = agent_map.get(data.get("assigned_to"))

            f = Family.objects.create(
                head_name=data["head_name"],
                household_size=data["household_size"],
                phone=data["phone"] or None,
                address_text=data["address_text"] or None,
                zone_label=data["zone_label"] or None,
                lat=data["lat"],
                lng=data["lng"],
                priority_override=data["priority_override"],
                next_due_at=next_due,
                last_visit_at=last_visit,
                created_by=sara if assigned == sara else admin_user,
                assigned_to=assigned,
                has_accessibility_need=data.get("accessibility", False),
                accessibility_types=data.get("accessibility_types"),
            )
            families.append(f)
            marker = ""
            if data["next_due_days_ago"] > 0:
                marker = f" [OVERDUE {data['next_due_days_ago']}j]"
            if data["priority_override"] == "urgent":
                marker += " [URGENT]"
            if data.get("no_visits"):
                marker += " [NEVER VISITED]"
            if not data["phone"]:
                marker += " [NO PHONE]"
            self.stdout.write(f"  Family: {f.head_name}{marker}")

        # ── Create visits ──
        visits_created = 0
        for i, f in enumerate(families):
            if STRESS_FAMILIES[i].get("no_visits"):
                continue

            # Varied visit count: urgent get 3, normal get 2, some get 1
            n_visits = 3 if f.priority_override == "urgent" else 2
            if i > 14:
                n_visits = 1

            for j in range(n_visits):
                days_back = 15 + j * 25  # spread visits over time
                visit_date = now - timedelta(days=days_back)
                motives = ["distribution", "follow_up", "assessment", "emergency"]
                motive = motives[j % len(motives)]
                is_urg = (motive == "emergency") or (
                    f.priority_override == "urgent" and j == 0
                )

                visit = Visit.objects.create(
                    family=f,
                    created_by=f.assigned_to or sara,
                    visited_at=visit_date,
                    motive=motive,
                    notes=f"Visite {j + 1}/{n_visits} — {f.head_name}. "
                    + (STRESS_FAMILIES[i].get("urgent_reason", "") if is_urg else "RAS"),
                    is_urgent=is_urg,
                    urgent_reason=STRESS_FAMILIES[i].get("urgent_reason", "") if is_urg else "",
                    next_due_at=visit_date + timedelta(days=30),
                    visit_lat=f.lat + (j * 0.0001),
                    visit_lng=f.lng + (j * 0.0001),
                )

                # Distribute varied aid types
                for k in range(min(2 + j, len(aid_types))):
                    aid_idx = (i + j + k) % len(aid_types)
                    VisitAid.objects.create(
                        visit=visit,
                        aid_type=aid_types[aid_idx],
                        quantity=(k + 1) * (2 if is_urg else 1),
                    )

                # Card for most recent visit
                if j == 0:
                    BeneficiaryCard.objects.create(
                        family=f,
                        visit=visit,
                        code_short=_code(),
                        expires_at=now + timedelta(days=7),
                    )

                visits_created += 1

        # ── Create complaints ──
        complaints_created = 0
        for fam_idx, category, priority, status, days_ago, message in STRESS_COMPLAINTS:
            f = families[fam_idx]
            visit = f.visits.first()  # may be None for never-visited
            resolved_at = now - timedelta(days=1) if status == "resolved" else None

            complaint = Complaint.objects.create(
                family=f,
                visit=visit,
                created_by=f.assigned_to or admin_user,
                assigned_to=admin_user if status == "in_progress" else None,
                category=category,
                priority=priority,
                status=status,
                resolved_at=resolved_at,
                resolution_notes="Résolu par le coordinateur." if resolved_at else "",
            )
            # Backdate created_at
            Complaint.objects.filter(pk=complaint.pk).update(
                created_at=now - timedelta(days=days_ago)
            )

            ComplaintMessage.objects.create(
                complaint=complaint,
                author=f.assigned_to or admin_user,
                message=message,
            )
            # Add admin reply on in_progress complaints
            if status == "in_progress":
                ComplaintMessage.objects.create(
                    complaint=complaint,
                    author=admin_user,
                    message="Pris en charge. Investigation en cours, mise à jour prévue sous 48h.",
                )

            complaints_created += 1

        # ── Create emergency incidents ──
        emergencies_created = 0
        emergency_types = list(EmergencyType.objects.all())
        if emergency_types:
            emergency_scenarios = [
                # (family_idx, type_key, status, summary, days_ago)
                (3, "medical", "open",
                 "Enfant de 3 ans en état de malnutrition sévère. Voisins alertent que l'état se dégrade.", 0),
                (4, "unsafe_housing", "acknowledged",
                 "Avis d'expulsion imminent. Famille de 3 personnes dont un nourrisson.", 1),
                (17, "agent_threat", "in_progress",
                 "Quartier signalé comme dangereux. Agent Sara a reçu des menaces lors de la dernière visite.", 2),
            ]

            type_map = {et.key: et for et in emergency_types}

            for fam_idx, type_key, status, summary, days_ago in emergency_scenarios:
                etype = type_map.get(type_key)
                if not etype:
                    continue

                f = families[fam_idx]
                incident = EmergencyIncident.objects.create(
                    created_by=sara,
                    family=f,
                    type=etype,
                    status=status,
                    severity_level=etype.severity_level,
                    summary=summary,
                    details=f"Incident signalé pour {f.head_name}. {summary}",
                    trigger_method="slide",
                    lat=f.lat,
                    lng=f.lng,
                    assigned_admin=admin_user if status != "open" else None,
                    acknowledged_at=now - timedelta(hours=2) if status in ("acknowledged", "in_progress") else None,
                )
                # Backdate
                EmergencyIncident.objects.filter(pk=incident.pk).update(
                    created_at=now - timedelta(days=days_ago)
                )

                # Timeline actions
                EmergencyAction.objects.create(
                    incident=incident,
                    actor=sara,
                    action_type="created",
                    message=f"Urgence déclenchée: {summary}",
                )
                if status in ("acknowledged", "in_progress"):
                    EmergencyAction.objects.create(
                        incident=incident,
                        actor=admin_user,
                        action_type="status_change",
                        message=f"Statut changé à: {status}. Prise en charge par le coordinateur.",
                    )
                if status == "in_progress":
                    EmergencyAction.objects.create(
                        incident=incident,
                        actor=admin_user,
                        action_type="note",
                        message="Coordination avec les autorités locales en cours. Agent retiré de la zone.",
                    )

                emergencies_created += 1
        else:
            self.stdout.write(
                self.style.WARNING(
                    "  No EmergencyType found — run seed_emergency_types for emergencies."
                )
            )

        # ── Summary ──
        overdue = sum(1 for d in STRESS_FAMILIES if d["next_due_days_ago"] > 0)
        urgent = sum(1 for d in STRESS_FAMILIES if d["priority_override"] == "urgent")
        never_visited = sum(1 for d in STRESS_FAMILIES if d.get("no_visits"))
        no_phone = sum(1 for d in STRESS_FAMILIES if not d["phone"])
        duplicates = 2  # intentional near-duplicates

        self.stdout.write(
            self.style.SUCCESS(
                f"\n{'=' * 55}\n"
                f"  STRESS SEED COMPLETE\n"
                f"{'=' * 55}\n"
                f"  {len(families):>3} families ({overdue} overdue, {urgent} urgent)\n"
                f"  {visits_created:>3} visits\n"
                f"  {complaints_created:>3} complaints (all priorities/statuses)\n"
                f"  {emergencies_created:>3} emergency incidents\n"
                f"  {never_visited:>3} families never visited (SLA violation)\n"
                f"  {no_phone:>3} families missing phone (data quality)\n"
                f"  {duplicates:>3} near-duplicate name pairs\n"
                f"{'=' * 55}\n"
                f"\n  Agents: Sara (14 families), Youssef (4), Amina (2)\n"
                f"  Demo users: admin/sara/youssef/amina@omnia.org (pw: dev12345)\n"
                f"\n  Dashboard KPIs affected:\n"
                f"    - overdue_count: {overdue}+\n"
                f"    - urgent_count: {urgent}\n"
                f"    - SLA compliance: LOW (never-visited families)\n"
                f"    - data_quality: LOW (missing phone/address)\n"
                f"    - suspected_duplicates: {duplicates}+ pairs\n"
                f"    - complaints_open: {sum(1 for c in STRESS_COMPLAINTS if c[3] == 'open')}\n"
                f"    - emergencies_active: {emergencies_created}\n"
            )
        )
