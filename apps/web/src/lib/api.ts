/**
 * API client module.
 *
 * - Requests go through Next.js rewrite proxy (/api/* → Django)
 * - All requests use credentials: "include" (sends session cookie)
 * - CSRF: unsafe methods read csrftoken cookie and send X-CSRFToken header
 */

import type {
  Family, AidItem, Visit, VisitAid, Complaint, DashboardKPIs,
  AidDistribution, DataQuality, User, Attachment,
} from "./mock-data";

export const USE_API = process.env.NEXT_PUBLIC_USE_API === "true";

/** Relative URL — requests go through Next.js rewrite proxy to Django */
const API_BASE = "";
/** Absolute URL for download links that bypass fetch (e.g. CSV/XLSX exports) */
const API_DIRECT = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

/**
 * Module-level CSRF token cache.
 * Stored from the JSON response of /api/auth/csrf/.
 */
let _csrfToken: string | null = null;

/**
 * Read a cookie value by name from document.cookie.
 * Used as a fallback when running same-origin.
 */
function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.split("=")[1]) : null;
}

/**
 * Fetch the CSRF token from the API and cache it in-memory.
 * Also sets the csrftoken cookie (used by Django for double-submit validation).
 * Call this once on app init (or before the first unsafe request).
 */
export async function fetchCsrfToken(): Promise<string | null> {
  try {
    const res = await fetch(`${API_BASE}/api/auth/csrf/`, {
      credentials: "include",
    });
    if (!res.ok) return null;
    const data = await res.json();
    _csrfToken = data.csrfToken ?? null;
    return _csrfToken;
  } catch {
    return null;
  }
}

/**
 * Generic fetch wrapper that:
 * - Prepends API_BASE
 * - Includes credentials (session cookie)
 * - Adds CSRF token header for unsafe methods
 * - Sets JSON content-type for non-FormData bodies
 */
export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {}
): Promise<{ data: T | null; error: string | null; status: number }> {
  const method = (options.method || "GET").toUpperCase();
  const headers = new Headers(options.headers);

  // For unsafe methods, attach CSRF token from cookie
  const unsafeMethods = ["POST", "PUT", "PATCH", "DELETE"];
  if (unsafeMethods.includes(method)) {
    const csrfToken = _csrfToken || getCookie("csrftoken");
    if (csrfToken) {
      headers.set("X-CSRFToken", csrfToken);
    }
  }

  // Set JSON content-type unless body is FormData
  if (options.body && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      method,
      headers,
      credentials: "include",
    });

    if (!res.ok) {
      // Detect session expiry — broadcast so AuthProvider can react
      if (res.status === 401 && !path.includes("/auth/me")) {
        window.dispatchEvent(new CustomEvent("omnia-session-expired"));
      }
      const text = await res.text();
      let detail: string;
      try {
        detail = JSON.parse(text).detail ?? text;
      } catch {
        detail = text;
      }
      return { data: null, error: detail, status: res.status };
    }

    // Handle empty responses (204, etc.)
    if (res.status === 204) {
      return { data: null, error: null, status: 204 };
    }

    const data = (await res.json()) as T;
    return { data, error: null, status: res.status };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err.message : "Network error",
      status: 0,
    };
  }
}

// ─── STT (Speech-to-Text) ───────────────────────────────────

export async function apiTranscribeAudio(blob: Blob, lang?: string) {
  const formData = new FormData();
  formData.append("audio", blob, "recording.webm");
  const qs = lang ? `?lang=${encodeURIComponent(lang)}` : "";
  return apiFetch<{ text: string; confidence: number | null; segments: unknown[]; language: string | null }>(
    `/api/stt/transcribe-segment/${qs}`,
    { method: "POST", body: formData },
  );
}

// ─── Auth ───────────────────────────────────────────────────

export interface UserInfo {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: "agent" | "admin";
}

export async function apiLogin(email: string, password: string) {
  return apiFetch<UserInfo>("/api/auth/login/", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function apiLogout() {
  return apiFetch("/api/auth/logout/", { method: "POST" });
}

export async function apiGetMe() {
  return apiFetch<UserInfo>("/api/auth/me/");
}

/** Transform API user response → frontend User type */
export function apiUserToUser(u: UserInfo): User {
  return {
    id: String(u.id),
    email: u.email,
    firstName: u.first_name,
    lastName: u.last_name,
    role: u.role,
    zone: "",
  };
}

// ─── Aid Types ──────────────────────────────────────────────

interface ApiAidType {
  id: string;
  key: string;
  label_fr: string;
  label_ar: string;
}

export async function apiGetAidTypes() {
  return apiFetch<ApiAidType[]>("/api/aid-types/");
}

/** Transform API aid type → frontend AidItem type */
export function apiAidToAidItem(a: ApiAidType): AidItem {
  return {
    id: a.key,
    label: a.label_fr,
    labelAr: a.label_ar,
    category: "",
    maxQty: 5,
  };
}

// ─── Families ───────────────────────────────────────────────

interface ApiFamilyResult {
  count: number;
  next: string | null;
  previous: string | null;
  results: ApiFamily[];
}

interface ApiFamily {
  id: string;
  head_name: string;
  household_size: number;
  phone: string | null;
  address_text: string | null;
  zone_label: string | null;
  lat: number;
  lng: number;
  last_visit_at: string | null;
  next_due_at: string | null;
  priority: string;
  priority_override: string | null;
  assigned_to_id: string | null;
  created_by_id: string;
  vulnerability_tags: { id: string; key: string; label_fr: string; label_ar: string }[];
  has_accessibility_need: boolean;
  accessibility_types: string[] | null;
  accessibility_verification: string;
  vulnerability_notes: string | null;
  ocr_used: boolean;
  created_at: string;
  updated_at: string;
}

export async function apiGetFamilies(params?: Record<string, string>) {
  const qs = params ? "?" + new URLSearchParams(params).toString() : "";
  return apiFetch<ApiFamilyResult>(`/api/families/${qs}`);
}

export async function apiGetFamily(id: string) {
  return apiFetch<ApiFamily>(`/api/families/${id}/`);
}

/** Transform API family → frontend Family type */
export function apiFamilyToFamily(f: ApiFamily): Family {
  return {
    id: f.id,
    name: f.head_name,
    address: f.address_text ?? "",
    phone: f.phone ?? "",
    priority: f.priority as Family["priority"],
    lat: f.lat,
    lng: f.lng,
    membersCount: f.household_size,
    lastVisit: f.last_visit_at ? f.last_visit_at.split("T")[0] : "",
    assignedAgent: f.assigned_to_id ?? undefined,
    zone: f.zone_label ?? "",
  };
}

// ─── Create Family ──────────────────────────────────────────

export interface CreateFamilyPayload {
  head_name: string;
  household_size: number;
  phone?: string;
  address_text?: string;
  zone_label?: string;
  lat: number;
  lng: number;
}

export async function apiCreateFamily(payload: CreateFamilyPayload) {
  return apiFetch<ApiFamily>("/api/families/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// ─── Visits ─────────────────────────────────────────────────

interface ApiVisitAid {
  id: string;
  aid_type_id: string;
  aid_type_key: string;
  label_fr: string;
  label_ar: string;
  quantity: number;
  note_short: string | null;
  is_urgent: boolean | null;
}

interface ApiVisit {
  id: string;
  family_id: string;
  created_by_id: string;
  visited_at: string;
  motive: string;
  visit_lat: number | null;
  visit_lng: number | null;
  is_urgent: boolean;
  urgent_reason: string;
  notes: string | null;
  next_due_at: string | null;
  aids: ApiVisitAid[];
  feeling_token: string | null;
  created_at: string;
}

export async function apiGetVisits(familyId: string) {
  return apiFetch<ApiVisit[]>(`/api/visits/?family_id=${familyId}`);
}

export interface CreateVisitPayload {
  family_id: string;
  motive?: string;
  notes?: string;
  is_urgent?: boolean;
  urgent_reason?: string;
  aids: { aid_type_key: string; qty: number; note_short?: string }[];
  complaint_text?: string;
}

export async function apiCreateVisit(payload: CreateVisitPayload) {
  return apiFetch<ApiVisit>("/api/visits/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/** Transform API visit → frontend Visit type */
export function apiVisitToVisit(v: ApiVisit): Visit {
  return {
    id: v.id,
    familyId: v.family_id,
    agentId: v.created_by_id,
    date: v.visited_at.split("T")[0],
    status: "completed",
    aids: v.aids.map((a) => ({ aidId: a.aid_type_key, quantity: a.quantity })),
    notes: v.notes ?? "",
    attachments: [],
    feelingToken: v.feeling_token ?? undefined,
  };
}

/** For visit detail: get aid labels from API visit aids directly */
export function apiVisitAidLabels(v: ApiVisit, locale: string): string[] {
  return v.aids.map((a) => locale === "ar" ? a.label_ar : a.label_fr);
}

// ─── Attachments ────────────────────────────────────────────

export async function apiUploadAttachment(file: File, ownerType: string, ownerId: string) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("owner_type", ownerType);
  formData.append("owner_id", ownerId);

  return apiFetch<{
    id: string;
    owner_type: string;
    owner_id: string;
    mime_type: string;
    original_filename: string;
    size_bytes: number;
    created_at: string;
  }>("/api/attachments/", {
    method: "POST",
    body: formData,
  });
}

export async function apiDeleteAttachment(id: string) {
  return apiFetch(`/api/attachments/${id}/`, { method: "DELETE" });
}

export function apiDownloadAttachmentUrl(id: string): string {
  return `${API_DIRECT}/api/attachments/${id}/download/`;
}

// ─── Feeling Portal ─────────────────────────────────────────

export async function apiRedeemFeeling(codeShort: string) {
  return apiFetch<{ token: string; family_name: string }>("/api/feeling/redeem/", {
    method: "POST",
    body: JSON.stringify({ code_short: codeShort }),
  });
}

interface ApiFeelingCard {
  family_name: string;
  family_id: string;
  phone: string | null;
  visit_date: string | null;
  aids: ApiVisitAid[];
  next_action: string;
  code_short: string;
}

export async function apiGetFeelingCard(token: string) {
  return apiFetch<ApiFeelingCard>(`/api/feeling/card/${token}/`);
}

// ─── Dashboard ──────────────────────────────────────────────

interface ApiDashboard {
  kpis: {
    families_total: number;
    visits_30d: number;
    visits_7d: number;
    visits_trend: number;
    overdue: number;
    overdue_trend: number;
    urgent: number;
    urgent_trend: number;
    new_families_7d: number;
    new_families_trend: number;
  };
  top_aids_30d: { aid_type_key: string; label: string; count: number }[];
  critical_queue: {
    id: string;
    head_name: string;
    zone_label: string;
    priority: string;
    next_due_at: string | null;
    last_visit_at: string | null;
    phone: string | null;
  }[];
  complaints_summary: Record<string, number>;
  data_quality: {
    global_score: number;
    missing_phone: number;
    missing_location: number;
    overdue_without_visit: number;
  };
  per_agent_workload: {
    agent_id: string;
    agent_name: string;
    families_count: number;
    overdue_count: number;
  }[];
  sla_pct: number;
  suspected_duplicates: {
    family_a: string;
    family_a_name: string;
    family_b: string;
    family_b_name: string;
    similarity: number;
    reason: string;
  }[];
}

export async function apiGetDashboard() {
  return apiFetch<ApiDashboard>("/api/dashboard/");
}

/** Transform API dashboard → frontend types */
export function apiDashboardToKPIs(d: ApiDashboard): DashboardKPIs {
  return {
    overdue: d.kpis.overdue,
    overdueTrend: d.kpis.overdue_trend,
    urgent: d.kpis.urgent,
    urgentTrend: d.kpis.urgent_trend,
    visitsLast7d: d.kpis.visits_7d,
    visitsTrend: d.kpis.visits_trend,
    newFamilies7d: d.kpis.new_families_7d,
    newFamiliesTrend: d.kpis.new_families_trend,
  };
}

export function apiDashboardToAidDistribution(d: ApiDashboard): AidDistribution[] {
  return d.top_aids_30d.map((a) => ({
    aidId: a.aid_type_key,
    label: a.label,
    count: a.count,
  }));
}

export function apiDashboardToCriticalQueue(d: ApiDashboard): Family[] {
  return d.critical_queue.map((f) => ({
    id: f.id,
    name: f.head_name,
    address: "",
    phone: f.phone ?? "",
    priority: f.priority as Family["priority"],
    lat: 0,
    lng: 0,
    membersCount: 0,
    lastVisit: f.last_visit_at ? f.last_visit_at.split("T")[0] : "",
    zone: f.zone_label ?? "",
  }));
}

export function apiDashboardToDataQuality(d: ApiDashboard): DataQuality {
  const dupes = d.suspected_duplicates ?? [];
  return {
    globalScore: d.data_quality.global_score,
    suspectedDuplicates: dupes.length,
    duplicates: dupes.map((dup) => ({
      familyA: dup.family_a,
      familyB: dup.family_b,
      similarity: dup.similarity,
      reason: dup.reason,
    })),
  };
}

export function apiDashboardToWorkload(d: ApiDashboard) {
  return d.per_agent_workload ?? [];
}

export function apiDashboardToSLA(d: ApiDashboard): number {
  return d.sla_pct ?? 100;
}

// ─── Complaints ─────────────────────────────────────────────

interface ApiComplaint {
  id: string;
  family: string;
  family_name: string;
  visit: string | null;
  created_by: string;
  created_by_name: string;
  category: string;
  priority: string;
  status: string;
  messages: { id: string; author: string; author_name: string; message: string; created_at: string }[];
  created_at: string;
  updated_at: string;
}

export async function apiGetComplaints(statusFilter?: string) {
  const qs = statusFilter ? `?status=${statusFilter}` : "";
  return apiFetch<{ count: number; results: ApiComplaint[] }>(`/api/complaints/${qs}`);
}

export function apiComplaintToComplaint(c: ApiComplaint): Complaint {
  return {
    id: c.id,
    familyId: c.family,
    agentId: c.created_by,
    date: c.created_at.split("T")[0],
    status: c.status as Complaint["status"],
    priority: c.priority as Complaint["priority"],
    description: c.messages.length > 0 ? c.messages[0].message : c.category,
  };
}

// ─── Routing ────────────────────────────────────────────────

interface RoutePoint {
  lat: number;
  lng: number;
  label?: string;
}

interface ApiRouteResponse {
  points: RoutePoint[];
  optimized: boolean;
  polyline: string | null;
  total_distance_km: number | null;
  total_duration_min: number | null;
}

export async function apiComputeRoute(points: RoutePoint[]) {
  return apiFetch<ApiRouteResponse>("/api/routing/compute/", {
    method: "POST",
    body: JSON.stringify({ points }),
  });
}

// ─── OCR CIN ─────────────────────────────────────────────────

export async function apiExtractCIN(imageFile: File) {
  const formData = new FormData();
  formData.append("image", imageFile);
  return apiFetch<{
    raw_text: string;
    fields: {
      nin?: string;
      last_name?: string;
      first_name?: string;
      date_of_birth?: string;
      place_of_birth?: string;
      address?: string;
      candidates?: string[];
    };
  }>("/api/ocr/extract-cin/", {
    method: "POST",
    body: formData,
  });
}

// ─── Family Assignment ───────────────────────────────────────

export async function apiAssignFamily(familyId: string, userId: string | null) {
  return apiFetch<{ id: string; assigned_to_id: string | null }>(
    `/api/families/${familyId}/assign/`,
    {
      method: "POST",
      body: JSON.stringify({ user_id: userId }),
    },
  );
}

// ─── Users ──────────────────────────────────────────────────

export async function apiGetUsers() {
  return apiFetch<UserInfo[]>("/api/auth/users/");
}

// ─── Complaints Management ──────────────────────────────────

export async function apiUpdateComplaintStatus(
  complaintId: string,
  statusVal: string,
  resolutionNotes?: string,
) {
  return apiFetch<ApiComplaint>(`/api/complaints/${complaintId}/`, {
    method: "PATCH",
    body: JSON.stringify({
      status: statusVal,
      ...(resolutionNotes ? { resolution_notes: resolutionNotes } : {}),
    }),
  });
}

export async function apiAssignComplaint(complaintId: string, userId: string | null) {
  return apiFetch<ApiComplaint>(`/api/complaints/${complaintId}/`, {
    method: "PATCH",
    body: JSON.stringify({ assigned_to: userId }),
  });
}

export async function apiAddComplaintMessage(complaintId: string, message: string) {
  return apiFetch<{ id: string; message: string; created_at: string }>(
    `/api/complaints/${complaintId}/add_message/`,
    {
      method: "POST",
      body: JSON.stringify({ message }),
    },
  );
}

// ─── Exports ─────────────────────────────────────────────────

export function exportFamiliesCsvUrl(): string {
  return `${API_DIRECT}/api/exports/families/csv/`;
}

export function exportFamiliesXlsxUrl(): string {
  return `${API_DIRECT}/api/exports/families/xlsx/`;
}

export function exportVisitsCsvUrl(): string {
  return `${API_DIRECT}/api/exports/visits/csv/`;
}

export function exportVisitsXlsxUrl(): string {
  return `${API_DIRECT}/api/exports/visits/xlsx/`;
}

// ─── Emergencies ────────────────────────────────────────────

export interface EmergencyType {
  id: string;
  key: string;
  label_fr: string;
  label_ar: string;
}

export interface EmergencyIncident {
  id: string;
  client_id: string | null;
  emergency_type: string;
  emergency_type_label: string;
  status: "open" | "acknowledged" | "in_progress" | "resolved";
  summary: string | null;
  details: string | null;
  lat: number | null;
  lng: number | null;
  triggered_by: string;
  triggered_by_name: string;
  assigned_to: string | null;
  assigned_to_name: string | null;
  created_at: string;
  updated_at: string;
  timeline: EmergencyTimelineEntry[];
}

export interface EmergencyTimelineEntry {
  id: string;
  action: string;
  actor_name: string;
  note: string | null;
  created_at: string;
}

export interface TriggerEmergencyPayload {
  client_id: string;
  emergency_type: string;
  summary?: string;
  details?: string;
  lat?: number | null;
  lng?: number | null;
}

export async function apiGetEmergencyTypes() {
  return apiFetch<EmergencyType[]>("/api/v1/emergencies/types/");
}

export async function apiTriggerEmergency(payload: TriggerEmergencyPayload) {
  return apiFetch<EmergencyIncident>("/api/v1/emergencies/trigger/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function apiListEmergencies(statusFilter?: string) {
  const qs = statusFilter ? `?status=${statusFilter}` : "";
  return apiFetch<EmergencyIncident[]>(`/api/v1/emergencies/${qs}`);
}

export async function apiAcknowledgeEmergency(id: string) {
  return apiFetch<EmergencyIncident>(`/api/v1/emergencies/${id}/acknowledge/`, {
    method: "POST",
  });
}

export async function apiSetEmergencyStatus(id: string, status: string) {
  return apiFetch<EmergencyIncident>(`/api/v1/emergencies/${id}/status/`, {
    method: "POST",
    body: JSON.stringify({ status }),
  });
}

export async function apiAddEmergencyNote(id: string, note: string) {
  return apiFetch<EmergencyTimelineEntry>(`/api/v1/emergencies/${id}/actions/`, {
    method: "POST",
    body: JSON.stringify({ note }),
  });
}

export async function apiAssignEmergency(id: string, userId: string) {
  return apiFetch<EmergencyIncident>(`/api/v1/emergencies/${id}/assign/`, {
    method: "POST",
    body: JSON.stringify({ user_id: userId }),
  });
}

// ─── Family Merge ───────────────────────────────────────────

export async function apiMergeFamily(targetId: string, sourceId: string) {
  return apiFetch<Record<string, unknown>>(`/api/families/${targetId}/merge/`, {
    method: "POST",
    body: JSON.stringify({ source_id: sourceId }),
  });
}

// ─── WebAuthn (Passkeys) ────────────────────────────────────

/**
 * Convert a base64url string to an ArrayBuffer.
 */
export function base64urlToBuffer(base64url: string): ArrayBuffer {
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const pad = base64.length % 4 === 0 ? "" : "=".repeat(4 - (base64.length % 4));
  const binary = atob(base64 + pad);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Convert an ArrayBuffer to a base64url string.
 */
export function bufferToBase64url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export interface WebAuthnCredentialInfo {
  id: string;
  credential_id: string;
  sign_count: number;
  transports: string[] | null;
  aaguid: string | null;
  created_at: string;
  last_used_at: string | null;
}

export async function apiWebAuthnRegisterOptions() {
  return apiFetch<string>("/api/auth/webauthn/register/options/", {
    method: "POST",
  });
}

export async function apiWebAuthnRegisterVerify(attestationJSON: string) {
  const csrfToken = getCookie("csrftoken");
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (csrfToken) headers["X-CSRFToken"] = csrfToken;

  const res = await fetch(`${API_BASE}/api/auth/webauthn/register/verify/`, {
    method: "POST",
    headers,
    credentials: "include",
    body: attestationJSON,
  });
  if (!res.ok) {
    const text = await res.text();
    let detail: string;
    try { detail = JSON.parse(text).detail ?? text; } catch { detail = text; }
    return { data: null, error: detail, status: res.status };
  }
  const data = await res.json();
  return { data, error: null, status: res.status };
}

export async function apiWebAuthnLoginOptions(email: string) {
  return apiFetch<string>("/api/auth/webauthn/login/options/", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function apiWebAuthnLoginVerify(assertionJSON: string) {
  const csrfToken = getCookie("csrftoken");
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (csrfToken) headers["X-CSRFToken"] = csrfToken;

  const res = await fetch(`${API_BASE}/api/auth/webauthn/login/verify/`, {
    method: "POST",
    headers,
    credentials: "include",
    body: assertionJSON,
  });
  if (!res.ok) {
    const text = await res.text();
    let detail: string;
    try { detail = JSON.parse(text).detail ?? text; } catch { detail = text; }
    return { data: null, error: detail, status: res.status };
  }
  const data = await res.json();
  return { data, error: null, status: res.status };
}

export async function apiWebAuthnCredentialsList() {
  return apiFetch<WebAuthnCredentialInfo[]>("/api/auth/webauthn/credentials/");
}

export async function apiWebAuthnCredentialDelete(id: string) {
  return apiFetch<{ detail: string }>(`/api/auth/webauthn/credentials/${id}/`, {
    method: "DELETE",
  });
}

// ─── Attestations (Sign on Glass) ───────────────────────────

export interface VisitAttestation {
  id: string;
  visit: string;
  status: "signed" | "cannot_sign";
  signature_svg: string | null;
  cannot_sign_reason: string | null;
  cannot_sign_detail: string | null;
  witness_name: string | null;
  assisted: boolean;
  signed_at: string | null;
  created_at: string;
}

export interface SubmitAttestationPayload {
  client_id: string;
  status: "signed" | "cannot_sign";
  signature_svg?: string;
  cannot_sign_reason?: string;
  cannot_sign_detail?: string;
  witness_name?: string;
  assisted?: boolean;
}

export async function apiGetVisitAttestation(visitId: string) {
  return apiFetch<VisitAttestation>(`/api/v1/visits/${visitId}/attestation/`);
}

export async function apiSubmitVisitAttestation(visitId: string, payload: SubmitAttestationPayload) {
  return apiFetch<VisitAttestation>(`/api/v1/visits/${visitId}/attestation/`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// ─── Ops Brief (AI) ────────────────────────────────────────

export interface OpsBriefInputItem {
  id: string;
  label: string;
  priority: string;
  target_url: string;
  evidence: string;
  timestamp: string;
}

export interface OpsBriefInput {
  meta: {
    schema_version: string;
    generated_at: string;
    window_hours: number;
    lang: string;
    data_missing: string[];
  };
  kpis: {
    overdue_count: number;
    urgent_count: number;
    open_complaints_count: number;
    suspected_duplicates_count: number;
    visits_last_24h: number;
    families_total: number;
  };
  top_overdue: OpsBriefInputItem[];
  top_urgent: OpsBriefInputItem[];
  open_complaints: OpsBriefInputItem[];
  suspected_duplicates: OpsBriefInputItem[];
  workload_by_agent: OpsBriefInputItem[];
}

export interface OpsBriefBullet {
  text: string;
  severity: "critical" | "warning" | "info";
  citations: string[];
}

export interface OpsBriefSection {
  title: string;
  bullets: OpsBriefBullet[];
}

export interface OpsBriefAction {
  title: string;
  why: string;
  priority: number;
  target_url: string;
  citations: string[];
}

export interface OpsBriefAlert {
  level: "critical" | "warning" | "info";
  message: string;
  citations: string[];
}

export interface OpsBriefOutput {
  meta: {
    generated_at: string;
    window_hours: number;
    lang: string;
    model: string;
  };
  summary: string;
  sections: OpsBriefSection[];
  actions: OpsBriefAction[];
  alerts: OpsBriefAlert[];
}

export interface OpsBriefGenerateResponse {
  success: boolean;
  output: OpsBriefOutput | null;
  fallback: boolean;
  error: string | null;
  timing_ms?: number;
}

export async function apiGetOpsBriefInput(windowHours = 24, lang = "fr") {
  return apiFetch<OpsBriefInput>(
    `/api/admin/ops-brief-input/?window=${windowHours}h&lang=${lang}`
  );
}

export async function apiGenerateOpsBrief(windowHours = 24, lang = "fr") {
  return apiFetch<OpsBriefGenerateResponse>("/api/admin/ops-brief-generate/", {
    method: "POST",
    body: JSON.stringify({ window_hours: windowHours, lang }),
  });
}
