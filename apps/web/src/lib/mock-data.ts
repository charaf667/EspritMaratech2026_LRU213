/**
 * Mock data fixtures for OMNIA Charity Tracking.
 * Used when USE_API=false (default for dev without backend).
 */

// ─── Types ──────────────────────────────────────────────────

export type Priority = "overdue" | "urgent" | "normal";
export type Role = "agent" | "admin";
export type VisitStatus = "planned" | "in_progress" | "completed" | "cancelled";
export type ComplaintStatus = "open" | "in_progress" | "resolved" | "closed";

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  zone: string;
  avatar?: string;
}

export interface Family {
  id: string;
  name: string;
  address: string;
  phone: string;
  priority: Priority;
  lat: number;
  lng: number;
  membersCount: number;
  lastVisit: string;
  assignedAgent?: string;
  zone: string;
  notes?: string;
}

export interface AidItem {
  id: string;
  label: string;
  labelAr: string;
  category: string;
  maxQty: number;
}

export interface VisitAid {
  aidId: string;
  quantity: number;
}

export interface Attachment {
  id: string;
  filename: string;
  type: string;
  size: number;
}

export interface Visit {
  id: string;
  familyId: string;
  agentId: string;
  date: string;
  status: VisitStatus;
  aids: VisitAid[];
  notes: string;
  attachments: Attachment[];
  feelingToken?: string;
  feelingCode?: string;
  omniaRef?: string;
}

export interface Complaint {
  id: string;
  familyId: string;
  agentId: string;
  date: string;
  status: ComplaintStatus;
  priority: Priority;
  description: string;
}

export interface DashboardKPIs {
  overdue: number;
  overdueTrend: number;
  urgent: number;
  urgentTrend: number;
  visitsLast7d: number;
  visitsTrend: number;
  newFamilies7d: number;
  newFamiliesTrend: number;
}

export interface AidDistribution {
  aidId: string;
  label: string;
  count: number;
}

export interface DataQuality {
  globalScore: number;
  suspectedDuplicates: number;
  duplicates: { familyA: string; familyB: string; similarity: number; reason: string }[];
}

// ─── Legacy alias ───────────────────────────────────────────
export type FieldItem = Family;

// ─── Mock Users ─────────────────────────────────────────────

export const MOCK_USERS: User[] = [
  { id: "u1", email: "sara@omnia.org", firstName: "Sara", lastName: "Mansouri", role: "agent", zone: "Zone Nord" },
  { id: "u2", email: "karim@omnia.org", firstName: "Karim", lastName: "Belkacem", role: "agent", zone: "Zone Sud" },
  { id: "u3", email: "admin@omnia.org", firstName: "Nadia", lastName: "Hadj", role: "admin", zone: "Toutes" },
];

// ─── Mock Families ──────────────────────────────────────────

export const MOCK_FAMILIES: Family[] = [
  {
    id: "FAM-001", name: "Benali", address: "12 Rue des Oliviers, Alger", phone: "+213 555 0101",
    priority: "overdue", lat: 36.753, lng: 3.058, membersCount: 6, lastVisit: "2026-01-15", assignedAgent: "u1", zone: "Zone Nord",
  },
  {
    id: "FAM-002", name: "Khedira", address: "45 Bd Mohamed V, Oran", phone: "+213 555 0202",
    priority: "urgent", lat: 35.697, lng: -0.633, membersCount: 4, lastVisit: "2026-01-28", assignedAgent: "u1", zone: "Zone Nord",
  },
  {
    id: "FAM-003", name: "Amrani", address: "8 Rue Didouche Mourad, Alger", phone: "+213 555 0303",
    priority: "normal", lat: 36.764, lng: 3.059, membersCount: 3, lastVisit: "2026-02-01", assignedAgent: "u2", zone: "Zone Sud",
  },
  {
    id: "FAM-004", name: "Haddad", address: "23 Rue Larbi Ben Mhidi, Constantine", phone: "+213 555 0404",
    priority: "urgent", lat: 36.365, lng: 6.615, membersCount: 7, lastVisit: "2026-01-20", assignedAgent: "u2", zone: "Zone Sud",
  },
  {
    id: "FAM-005", name: "Boudiaf", address: "7 Place Emir, Blida", phone: "+213 555 0505",
    priority: "normal", lat: 36.47, lng: 2.828, membersCount: 5, lastVisit: "2026-02-03", assignedAgent: "u1", zone: "Zone Nord",
  },
  {
    id: "FAM-006", name: "Mebarki", address: "14 Rue Hassiba, Alger", phone: "+213 555 0606",
    priority: "overdue", lat: 36.748, lng: 3.062, membersCount: 8, lastVisit: "2026-01-05", assignedAgent: "u1", zone: "Zone Nord",
  },
  {
    id: "FAM-007", name: "Zeroual", address: "31 Av. de l'ALN, Annaba", phone: "+213 555 0707",
    priority: "normal", lat: 36.897, lng: 7.765, membersCount: 2, lastVisit: "2026-02-04", zone: "Zone Est",
  },
];

// ─── Mock Aid Catalogue (max 10 per SOT) ────────────────────

export const MOCK_AIDS: AidItem[] = [
  { id: "food_parcel", label: "Colis alimentaire (5kg)", labelAr: "طرد غذائي (5 كغ)", category: "Alimentaire", maxQty: 5 },
  { id: "medicines", label: "Médicaments essentiels", labelAr: "أدوية أساسية", category: "Santé", maxQty: 3 },
  { id: "hygiene", label: "Kit hygiène (savon, dentifrice…)", labelAr: "مستلزمات نظافة (صابون، معجون أسنان…)", category: "Hygiène", maxQty: 3 },
  { id: "clothes_blankets", label: "Vêtements / couvertures", labelAr: "ملابس / أغطية", category: "Vêtements", maxQty: 5 },
  { id: "baby", label: "Kit bébé (lait, couches, biberon)", labelAr: "مستلزمات رضيع (حليب، حفاضات، رضّاعة)", category: "Bébé", maxQty: 3 },
  { id: "school", label: "Kit scolaire (cahiers, stylos, cartable)", labelAr: "مستلزمات مدرسية (دفاتر، أقلام، محفظة)", category: "Éducation", maxQty: 3 },
  { id: "transport", label: "Bon de transport", labelAr: "قسيمة نقل", category: "Transport", maxQty: 2 },
  { id: "housing", label: "Aide au loyer (mois)", labelAr: "مساعدة إيجار (شهر)", category: "Logement", maxQty: 1 },
  { id: "financial", label: "Aide financière directe (DT)", labelAr: "مساعدة مالية مباشرة (د.ت)", category: "Financier", maxQty: 1 },
  { id: "specific_other", label: "Aide spécifique (sur mesure)", labelAr: "مساعدة خاصة (حسب الحاجة)", category: "Autre", maxQty: 3 },
];

// ─── Mock Visits ────────────────────────────────────────────

export const MOCK_VISITS: Visit[] = [
  {
    id: "VIS-001", familyId: "FAM-001", agentId: "u1", date: "2026-01-15", status: "completed",
    aids: [{ aidId: "food_parcel", quantity: 2 }, { aidId: "hygiene", quantity: 1 }],
    notes: "Famille en situation difficile, besoin de suivi rapproché.", attachments: [],
    feelingToken: "tk_abc123",
  },
  {
    id: "VIS-002", familyId: "FAM-003", agentId: "u2", date: "2026-02-01", status: "completed",
    aids: [{ aidId: "food_parcel", quantity: 1 }, { aidId: "school", quantity: 1 }],
    notes: "Enfants scolarisés, besoin de fournitures.", attachments: [{ id: "att-1", filename: "photo_visite.jpg", type: "image/jpeg", size: 245000 }],
    feelingToken: "tk_def456",
  },
  {
    id: "VIS-003", familyId: "FAM-002", agentId: "u1", date: "2026-01-28", status: "completed",
    aids: [{ aidId: "clothes_blankets", quantity: 2 }, { aidId: "medicines", quantity: 1 }],
    notes: "", attachments: [],
  },
];

// ─── Mock Complaints ────────────────────────────────────────

export const MOCK_COMPLAINTS: Complaint[] = [
  { id: "CPL-001", familyId: "FAM-001", agentId: "u1", date: "2026-01-16", status: "open", priority: "urgent", description: "Colis alimentaire incomplet, manque de riz." },
  { id: "CPL-002", familyId: "FAM-004", agentId: "u2", date: "2026-01-22", status: "in_progress", priority: "normal", description: "Demande de visite de suivi médical." },
  { id: "CPL-003", familyId: "FAM-006", agentId: "u1", date: "2026-02-01", status: "open", priority: "overdue", description: "Aucune visite depuis plus de 30 jours." },
];

// ─── Mock Dashboard KPIs ────────────────────────────────────

export const MOCK_KPIS: DashboardKPIs = {
  overdue: 2, overdueTrend: +1,
  urgent: 2, urgentTrend: -1,
  visitsLast7d: 5, visitsTrend: +2,
  newFamilies7d: 1, newFamiliesTrend: 0,
};

export const MOCK_AID_DISTRIBUTION: AidDistribution[] = [
  { aidId: "aid-1", label: "Colis alimentaire", count: 42 },
  { aidId: "aid-2", label: "Kit d'hygiène", count: 28 },
  { aidId: "aid-3", label: "Couvertures", count: 19 },
  { aidId: "aid-8", label: "Eau potable", count: 15 },
  { aidId: "aid-7", label: "Fournitures scolaires", count: 11 },
];

export const MOCK_DATA_QUALITY: DataQuality = {
  globalScore: 87,
  suspectedDuplicates: 1,
  duplicates: [
    { familyA: "FAM-001", familyB: "FAM-006", similarity: 78, reason: "Adresses proches, noms similaires" },
  ],
};

// ─── Legacy compat (for existing field page) ────────────────
export const MOCK_ITEMS: Family[] = MOCK_FAMILIES;

/** Default map center (Algiers) */
export const MAP_CENTER: [number, number] = [36.753, 3.058];
export const MAP_ZOOM = 10;

// ─── Allowed attachment types (PRD) ─────────────────────────
export const ALLOWED_ATTACHMENT_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
export const MAX_ATTACHMENTS = 3;
export const MAX_ATTACHMENT_SIZE = 5 * 1024 * 1024; // 5 MB
