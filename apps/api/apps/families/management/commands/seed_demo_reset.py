"""
Full demo reset: wipe all data and reseed with realistic, plausible data.

Usage:
    python manage.py seed_demo_reset

Creates:
    - 2 users (admin + agent)
    - 10 aid types with proper labels
    - 15 realistic Tunisian families with varied profiles
    - 25+ visits with realistic aid distributions and notes
    - 5 complaints with varied categories
    - Beneficiary cards for recent visits
"""

import random
import secrets
import string
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.accounts.models import User
from apps.aids.models import AidType
from apps.audit.models import AuditLog
from apps.cards.models import BeneficiaryCard
from apps.complaints.models import Complaint, ComplaintMessage
from apps.emergencies.models import EmergencyIncident, EmergencyAction
from apps.families.models import Family
from apps.visits.models import Visit, VisitAid


PASSWORD = "dev12345"

USERS = [
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
    {
        "email": "karim@omnia.org",
        "first_name": "Karim",
        "last_name": "Bouzid",
        "role": "agent",
        "is_staff": False,
        "is_superuser": False,
    },
]

AID_TYPES = [
    ("food_parcel", "Colis alimentaire (5kg)", "طرد غذائي (5 كغ)"),
    ("medicines", "Médicaments essentiels", "أدوية أساسية"),
    ("hygiene", "Kit hygiène (savon, dentifrice…)", "مستلزمات نظافة (صابون، معجون أسنان…)"),
    ("clothes_blankets", "Vêtements / couvertures", "ملابس / أغطية"),
    ("baby", "Kit bébé (lait, couches, biberon)", "مستلزمات رضيع (حليب، حفاضات، رضّاعة)"),
    ("school", "Kit scolaire (cahiers, stylos, cartable)", "مستلزمات مدرسية (دفاتر، أقلام، محفظة)"),
    ("transport", "Bon de transport", "قسيمة نقل"),
    ("housing", "Aide au loyer (mois)", "مساعدة إيجار (شهر)"),
    ("financial", "Aide financière directe (DT)", "مساعدة مالية مباشرة (د.ت)"),
    ("specific_other", "Aide spécifique (sur mesure)", "مساعدة خاصة (حسب الحاجة)"),
]

FAMILIES = [
    {
        "head_name": "Fatima Ben Ali",
        "household_size": 5,
        "phone": "+216 71 234 567",
        "address_text": "12 Rue de la Liberté, Cité El Khadra, Tunis",
        "zone_label": "Tunis Nord",
        "lat": 36.8065,
        "lng": 10.1815,
        "priority_override": None,
        "next_due_days_ago": 5,
        "vulnerability_notes": "Mère seule avec 4 enfants scolarisés. Revenus irréguliers.",
    },
    {
        "head_name": "Ahmed Mansouri",
        "household_size": 3,
        "phone": "+216 98 456 789",
        "address_text": "45 Avenue Habib Bourguiba, Tunis Centre",
        "zone_label": "Tunis Centre",
        "lat": 36.7990,
        "lng": 10.1700,
        "priority_override": "urgent",
        "next_due_days_ago": -2,
        "vulnerability_notes": "Chef de famille diabétique, ne peut plus travailler. Besoin médicaments mensuels.",
    },
    {
        "head_name": "Khadija El Amri",
        "household_size": 7,
        "phone": "+216 55 112 233",
        "address_text": "8 Rue Ibn Khaldoun, La Marsa",
        "zone_label": "La Marsa",
        "lat": 36.8785,
        "lng": 10.3235,
        "priority_override": None,
        "next_due_days_ago": -10,
        "vulnerability_notes": "Grande famille, 5 enfants dont 2 en bas âge. Logement précaire.",
    },
    {
        "head_name": "Mohamed Trabelsi",
        "household_size": 4,
        "phone": "+216 22 789 012",
        "address_text": "23 Rue de Carthage, Sidi Bou Saïd",
        "zone_label": "Carthage",
        "lat": 36.8528,
        "lng": 10.3233,
        "priority_override": None,
        "next_due_days_ago": 15,
        "vulnerability_notes": "Père au chômage depuis 6 mois. 2 enfants au lycée.",
    },
    {
        "head_name": "Amina Bouazizi",
        "household_size": 6,
        "phone": "+216 50 345 678",
        "address_text": "67 Avenue Mohamed V, Ariana",
        "zone_label": "Ariana",
        "lat": 36.8625,
        "lng": 10.1935,
        "priority_override": "urgent",
        "next_due_days_ago": 1,
        "vulnerability_notes": "Veuve avec 5 enfants. Bébé de 3 mois nécessitant suivi nutritionnel.",
    },
    {
        "head_name": "Youssef Gharbi",
        "household_size": 2,
        "phone": "",
        "address_text": "15 Rue de Marseille, Bab El Khadra, Tunis",
        "zone_label": "Tunis Centre",
        "lat": 36.7945,
        "lng": 10.1780,
        "priority_override": None,
        "next_due_days_ago": -20,
        "vulnerability_notes": "Personne âgée vivant seule avec petit-fils. Mobilité réduite.",
    },
    {
        "head_name": "Salma Hamdi",
        "household_size": 8,
        "phone": "+216 29 567 890",
        "address_text": "3 Rue Farhat Hached, Manouba",
        "zone_label": "Manouba",
        "lat": 36.8100,
        "lng": 10.0970,
        "priority_override": None,
        "next_due_days_ago": 8,
        "vulnerability_notes": "Famille nombreuse, 6 enfants. Père ouvrier journalier, revenus très variables.",
    },
    {
        "head_name": "Rachid Nasr",
        "household_size": 4,
        "phone": "+216 97 123 456",
        "address_text": "10 Rue Ali Bach Hamba, Le Bardo",
        "zone_label": "Le Bardo",
        "lat": 36.8090,
        "lng": 10.1345,
        "priority_override": None,
        "next_due_days_ago": -5,
        "vulnerability_notes": "Famille réfugiée, en attente de régularisation. 2 enfants non scolarisés.",
    },
    {
        "head_name": "Nour Jebali",
        "household_size": 3,
        "phone": "+216 53 890 123",
        "address_text": "42 Rue de Palestine, El Menzah 6, Tunis",
        "zone_label": "Tunis Nord",
        "lat": 36.8320,
        "lng": 10.1860,
        "priority_override": None,
        "next_due_days_ago": -15,
        "vulnerability_notes": "Mère célibataire avec 2 filles. Travaille comme aide-ménagère.",
    },
    {
        "head_name": "Hassan Riahi",
        "household_size": 5,
        "phone": "+216 20 456 789",
        "address_text": "27 Avenue Taieb Mhiri, Den Den",
        "zone_label": "Manouba",
        "lat": 36.8180,
        "lng": 10.0880,
        "priority_override": "urgent",
        "next_due_days_ago": 3,
        "vulnerability_notes": "Chef de famille hospitalisé suite à accident de travail. Famille sans revenus.",
    },
    {
        "head_name": "Leila Brahim",
        "household_size": 4,
        "phone": "+216 25 678 901",
        "address_text": "5 Rue du Lac Biwa, Les Berges du Lac",
        "zone_label": "Tunis Nord",
        "lat": 36.8350,
        "lng": 10.2290,
        "priority_override": None,
        "next_due_days_ago": -8,
        "vulnerability_notes": "Famille en situation de surendettement. Risque d'expulsion du logement.",
    },
    {
        "head_name": "Mourad Sassi",
        "household_size": 6,
        "phone": "+216 58 234 567",
        "address_text": "18 Rue Mongi Slim, Ezzouhour, Tunis",
        "zone_label": "Tunis Centre",
        "lat": 36.7880,
        "lng": 10.1650,
        "priority_override": None,
        "next_due_days_ago": 12,
        "vulnerability_notes": "3 enfants handicapés nécessitant soins spécialisés. Mère au foyer.",
    },
    {
        "head_name": "Sonia Meddeb",
        "household_size": 3,
        "phone": "+216 92 345 678",
        "address_text": "31 Rue de l'Usine, Megrine",
        "zone_label": "Ben Arous",
        "lat": 36.7670,
        "lng": 10.2310,
        "priority_override": None,
        "next_due_days_ago": -3,
        "vulnerability_notes": "Femme enceinte (7 mois) avec un enfant en bas âge. Suivi prénatal nécessaire.",
    },
    {
        "head_name": "Tarek Khemiri",
        "household_size": 5,
        "phone": "+216 26 789 012",
        "address_text": "9 Avenue de la République, Hammam Lif",
        "zone_label": "Ben Arous",
        "lat": 36.7330,
        "lng": 10.3420,
        "priority_override": None,
        "next_due_days_ago": 20,
        "vulnerability_notes": "Père au chômage, mère malade chronique. 3 enfants dont 1 bébé.",
    },
    {
        "head_name": "Ines Mejri",
        "household_size": 2,
        "phone": "+216 54 567 890",
        "address_text": "14 Rue Hédi Chaker, Soukra",
        "zone_label": "Ariana",
        "lat": 36.8530,
        "lng": 10.2150,
        "priority_override": None,
        "next_due_days_ago": -25,
        "vulnerability_notes": "Personne âgée (78 ans) vivant avec sa fille handicapée.",
    },
]

# Realistic visit scenarios: (aid_keys, quantities, note)
VISIT_SCENARIOS = [
    {
        "aids": [("food_parcel", 2), ("hygiene", 1)],
        "note": "Distribution régulière effectuée. Famille en situation stable. Enfants présents et en bonne santé.",
        "motive": "distribution",
    },
    {
        "aids": [("food_parcel", 1), ("medicines", 1), ("baby", 2)],
        "note": "Bébé de 3 mois en bonne santé. Mère fatiguée mais positive. Lait maternisé + couches fournis pour 2 semaines.",
        "motive": "distribution",
    },
    {
        "aids": [("school", 3), ("clothes_blankets", 2)],
        "note": "Rentrée scolaire: fournitures pour 3 enfants (CP, CE2, 5ème). Vêtements d'hiver distribués.",
        "motive": "distribution",
    },
    {
        "aids": [("food_parcel", 3), ("hygiene", 2), ("clothes_blankets", 1)],
        "note": "Famille nombreuse. Colis alimentaire renforcé. Conditions de logement précaires mais propres.",
        "motive": "distribution",
    },
    {
        "aids": [("medicines", 2), ("transport", 1)],
        "note": "Suivi médical: médicaments pour diabète et hypertension. Bon de transport pour RDV hôpital Charles Nicolle.",
        "motive": "follow_up",
    },
    {
        "aids": [("housing", 1), ("financial", 1)],
        "note": "Aide au loyer du mois de janvier (350 DT). Aide financière complémentaire (150 DT) pour factures eau/électricité.",
        "motive": "assessment",
    },
    {
        "aids": [("food_parcel", 1), ("baby", 1), ("medicines", 1)],
        "note": "Suivi post-natal: mère et bébé en bonne santé. Vitamines + lait maternisé fournis.",
        "motive": "follow_up",
    },
    {
        "aids": [("food_parcel", 2), ("specific_other", 1)],
        "note": "Distribution + matelas et couverture supplémentaire (hiver). Famille signale des fuites d'eau dans le toit.",
        "motive": "distribution",
    },
    {
        "aids": [("financial", 1), ("transport", 2)],
        "note": "Aide financière d'urgence (200 DT). 2 bons de transport pour démarches administratives (CNSS, municipalité).",
        "motive": "emergency",
    },
    {
        "aids": [("food_parcel", 1), ("school", 2), ("hygiene", 1)],
        "note": "Distribution standard + kit scolaire pour 2 enfants. Famille coopérative, situation en amélioration.",
        "motive": "distribution",
    },
    {
        "aids": [("clothes_blankets", 3), ("hygiene", 1)],
        "note": "Vêtements chauds pour 3 enfants. Kit hygiène complet. Prochaine visite prévue dans 3 semaines.",
        "motive": "distribution",
    },
    {
        "aids": [("medicines", 1)],
        "note": "Visite de suivi: renouvellement ordonnance. Patient stable sous traitement.",
        "motive": "follow_up",
    },
]

COMPLAINT_DATA = [
    {
        "family_idx": 0,
        "category": "missing_aid",
        "priority": "high",
        "status": "open",
        "message": "La famille signale ne pas avoir reçu le colis alimentaire prévu lors de la dernière visite du 20 janvier. Vérifier avec l'entrepôt.",
    },
    {
        "family_idx": 3,
        "category": "delay",
        "priority": "medium",
        "status": "open",
        "message": "Retard de 2 semaines sur la visite planifiée. La famille a appelé pour demander quand l'agent passerait.",
    },
    {
        "family_idx": 4,
        "category": "visit_report",
        "priority": "urgent",
        "status": "in_progress",
        "message": "Bébé de 3 mois présente des signes de malnutrition. Orientation urgente vers le centre de santé de base d'Ariana.",
    },
    {
        "family_idx": 9,
        "category": "data_error",
        "priority": "low",
        "status": "open",
        "message": "Numéro de téléphone incorrect dans le dossier. Le nouveau numéro est +216 20 999 888.",
    },
    {
        "family_idx": 11,
        "category": "other",
        "priority": "medium",
        "status": "open",
        "message": "Famille signale des difficultés avec le propriétaire qui menace d'expulsion. Besoin d'orientation vers assistance juridique.",
    },
]


def _short_code(length=6):
    chars = string.ascii_uppercase + string.digits
    return "".join(secrets.choice(chars) for _ in range(length))


class Command(BaseCommand):
    help = "Full demo reset: wipe and reseed with realistic data."

    def add_arguments(self, parser):
        parser.add_argument(
            "--force",
            action="store_true",
            help="Skip confirmation prompt",
        )

    def handle(self, *args, **options):
        if not options["force"]:
            self.stdout.write(self.style.WARNING(
                "This will DELETE all existing data and reseed. Use --force to confirm."
            ))
            return

        now = timezone.now()

        # ── Wipe (order matters for FK constraints) ──
        self.stdout.write("Wiping existing data...")
        AuditLog.objects.all().delete()
        EmergencyAction.objects.all().delete()
        EmergencyIncident.objects.all().delete()
        ComplaintMessage.objects.all().delete()
        Complaint.objects.all().delete()
        BeneficiaryCard.objects.all().delete()
        VisitAid.objects.all().delete()
        Visit.objects.all().delete()
        Family.objects.all().delete()
        AidType.objects.all().delete()
        User.objects.all().delete()

        # ── Users ──
        users = {}
        for data in USERS:
            u = User.objects.create_user(
                email=data["email"],
                password=PASSWORD,
                first_name=data["first_name"],
                last_name=data["last_name"],
                role=data["role"],
                is_staff=data["is_staff"],
                is_superuser=data["is_superuser"],
            )
            users[data["email"]] = u
            self.stdout.write(f"  User: {data['email']} ({data['role']})")

        sara = users["sara@omnia.org"]
        karim = users["karim@omnia.org"]
        admin_user = users["admin@omnia.org"]
        agents = [sara, karim]

        # ── Aid Types ──
        aid_map = {}
        for key, label_fr, label_ar in AID_TYPES:
            at = AidType.objects.create(key=key, label_fr=label_fr, label_ar=label_ar)
            aid_map[key] = at
        self.stdout.write(f"  {len(AID_TYPES)} aid types created")

        # ── Families ──
        families = []
        for i, data in enumerate(FAMILIES):
            agent = agents[i % len(agents)]
            created_by = agent if i < 10 else admin_user
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
                vulnerability_notes=data["vulnerability_notes"],
                created_by=created_by,
                assigned_to=agent,
            )
            families.append(f)

        self.stdout.write(f"  {len(families)} families created")

        # ── Visits ──
        visits_created = 0
        random.seed(42)  # deterministic for demo reproducibility
        for fi, f in enumerate(families):
            # 2 visits per family, with varied scenarios
            num_visits = 2 if fi < 10 else 1
            for j in range(num_visits):
                scenario = VISIT_SCENARIOS[(fi * 2 + j) % len(VISIT_SCENARIOS)]
                days_ago = 10 + j * 25 + fi * 2
                visit_date = now - timedelta(days=days_ago)
                agent = agents[fi % len(agents)]

                visit = Visit.objects.create(
                    family=f,
                    created_by=agent,
                    visited_at=visit_date,
                    visit_lat=f.lat + random.uniform(-0.001, 0.001),
                    visit_lng=f.lng + random.uniform(-0.001, 0.001),
                    motive=scenario["motive"],
                    notes=scenario["note"],
                    is_urgent=f.priority_override == "urgent" and j == 0,
                    urgent_reason="Situation critique nécessitant intervention rapide" if f.priority_override == "urgent" and j == 0 else "",
                    next_due_at=visit_date + timedelta(days=30),
                )

                for aid_key, qty in scenario["aids"]:
                    if aid_key in aid_map:
                        VisitAid.objects.create(
                            visit=visit,
                            aid_type=aid_map[aid_key],
                            quantity=qty,
                        )

                # Card for most recent visit only
                if j == 0:
                    BeneficiaryCard.objects.create(
                        family=f,
                        visit=visit,
                        code_short=_short_code(),
                        expires_at=now + timedelta(days=7),
                    )

                visits_created += 1

        self.stdout.write(f"  {visits_created} visits created")

        # ── Complaints ──
        for cd in COMPLAINT_DATA:
            f = families[cd["family_idx"]]
            visit = f.visits.first()
            complaint = Complaint.objects.create(
                family=f,
                visit=visit,
                created_by=sara,
                category=cd["category"],
                priority=cd["priority"],
                status=cd["status"],
            )
            ComplaintMessage.objects.create(
                complaint=complaint,
                author=sara,
                message=cd["message"],
            )

        self.stdout.write(f"  {len(COMPLAINT_DATA)} complaints created")

        self.stdout.write(self.style.SUCCESS(
            f"\n✓ Demo reset complete:\n"
            f"  {len(USERS)} users (password: {PASSWORD})\n"
            f"  {len(AID_TYPES)} aid types\n"
            f"  {len(families)} families\n"
            f"  {visits_created} visits\n"
            f"  {len(COMPLAINT_DATA)} complaints"
        ))
