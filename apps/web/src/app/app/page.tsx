"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/i18n";
import { useAuth } from "@/lib/auth-context";
import { MOCK_FAMILIES, MOCK_VISITS, MOCK_AIDS, type Family, type Priority } from "@/lib/mock-data";
import {
  USE_API, apiGetFamilies, apiFamilyToFamily, apiGetVisits, apiVisitAidLabels,
  apiCreateFamily, type CreateFamilyPayload,
} from "@/lib/api";
import { useOffline } from "@/lib/offline-context";
import { getCachedFamilies, getCachedVisits, cacheVisits, type OutboxEntry } from "@/lib/offline-db";
import { MapListLayout, Input, Chip, Badge, EmptyState, Button, Modal, EmergencyFAB, EmergencyTriggerSheet, EmergencyJournal, type BadgeVariant } from "@/components/ds";
import { CardSkeleton } from "@/components/ds/Skeleton";
import MapViewDynamic from "@/components/MapViewDynamic";
import RoutePlanner from "@/components/ds/RoutePlanner";
import {
  Search, ChevronRight, Users, Calendar, PlusCircle, WifiOff, Route,
  Phone, Navigation2, Edit3, X, UserPlus, MapPin, Loader2, Check,
} from "lucide-react";

const PRIORITY_ORDER: Record<Priority, number> = { overdue: 0, urgent: 1, normal: 2 };
const PRIORITY_BADGE: Record<Priority, BadgeVariant> = { overdue: "critical", urgent: "warning", normal: "neutral" };

type FilterId = "overdue" | "urgent" | "myFamilies" | "today" | "zoneNord";

export default function AgentHomePage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const router = useRouter();

  const { isOnline } = useOffline();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeFilters, setActiveFilters] = useState<Set<FilterId>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [families, setFamilies] = useState<Family[]>([]);
  const [showRoutePlanner, setShowRoutePlanner] = useState(false);
  const [routePolyline, setRoutePolyline] = useState<[number, number][] | null>(null);
  const [isClustered, setIsClustered] = useState(false);
  const [emergencySheetOpen, setEmergencySheetOpen] = useState(false);
  const [emergencyJournalOpen, setEmergencyJournalOpen] = useState(false);
  const [showCreateFamily, setShowCreateFamily] = useState(false);

  // Fetch families
  useEffect(() => {
    if (!USE_API) {
      setFamilies(MOCK_FAMILIES);
      return;
    }

    setIsLoading(true);

    // Build query params from filters
    const params: Record<string, string> = {};
    if (searchQuery.trim()) params.search = searchQuery.trim();
    if (activeFilters.has("overdue")) params.priority = "overdue";
    if (activeFilters.has("urgent")) params.priority = "urgent";
    if (activeFilters.has("myFamilies")) params.assigned_to = "me";
    if (activeFilters.has("today")) params.today = "true";
    if (activeFilters.has("zoneNord")) params.zone = "Zone Nord";

    if (!isOnline) {
      // Offline: load from IndexedDB cache
      getCachedFamilies().then((cached) => {
        if (cached.length > 0) {
          setFamilies((cached as { id: string }[]).map((f: any) => apiFamilyToFamily(f)));
        }
        setIsLoading(false);
      });
      return;
    }

    apiGetFamilies(params).then(({ data }) => {
      if (data?.results) {
        setFamilies(data.results.map(apiFamilyToFamily));
      }
      setIsLoading(false);
    });
  }, [searchQuery, activeFilters, isOnline]);

  const toggleFilter = useCallback((id: FilterId) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const filteredFamilies = useMemo(() => {
    if (USE_API) return families; // Already filtered server-side

    let result = [...families];

    // Client-side search (mock mode)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (f) =>
          f.name.toLowerCase().includes(q) ||
          f.address.toLowerCase().includes(q) ||
          f.id.toLowerCase().includes(q)
      );
    }

    // Client-side filters (mock mode)
    if (activeFilters.has("overdue")) result = result.filter((f) => f.priority === "overdue");
    if (activeFilters.has("urgent")) result = result.filter((f) => f.priority === "urgent");
    if (activeFilters.has("myFamilies")) result = result.filter((f) => f.assignedAgent === user?.id);
    if (activeFilters.has("zoneNord")) result = result.filter((f) => f.zone === "Zone Nord");

    // Sort by priority
    result.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);

    return result;
  }, [families, searchQuery, activeFilters, user]);

  const selectedFamily = filteredFamilies.find((f) => f.id === selectedId);

  const filters: { id: FilterId; label: string }[] = [
    { id: "overdue", label: t("chipOverdue") },
    { id: "urgent", label: t("chipUrgent") },
    { id: "myFamilies", label: t("chipMyFamilies") },
    { id: "today", label: t("chipToday") },
    { id: "zoneNord", label: t("chipZoneNord") },
  ];

  const handleFamilyClick = (family: Family) => {
    setSelectedId(family.id);
  };

  const listPanel = (
    <div className="flex flex-col sm:h-full sm:overflow-hidden">
      {/* Offline banner */}
      {!isOnline && (
        <div role="status" aria-live="polite" className="flex items-center gap-2 px-[var(--space-3)] py-[var(--space-2)] bg-[var(--warning)] text-[var(--on-warning)] text-sm">
          <WifiOff size={16} />
          {t("offlineMessage")}
        </div>
      )}

      {/* Search */}
      <div className="p-[var(--space-3)]">
        <Input
          placeholder={t("searchFamily")}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          icon={<Search size={18} />}
        />
      </div>

      {/* Filter chips */}
      <div className="flex gap-2 px-[var(--space-3)] pb-[var(--space-3)] overflow-x-auto scrollbar-none">
        {filters.map((f) => (
          <Chip key={f.id} selected={activeFilters.has(f.id)} onToggle={() => toggleFilter(f.id)}>
            {f.label}
          </Chip>
        ))}
      </div>

      {/* Cluster mode a11y notice */}
      {isClustered && (
        <p role="status" aria-live="polite" className="px-[var(--space-3)] py-[var(--space-2)] text-xs text-[var(--text-tertiary)] bg-[var(--bg-tertiary)]">
          {t("map")}: clustered view
        </p>
      )}

      {/* Family list */}
      {isLoading ? (
        <div className="flex flex-col gap-3 p-[var(--space-3)]">
          {[1, 2, 3].map((i) => <CardSkeleton key={i} />)}
        </div>
      ) : filteredFamilies.length === 0 ? (
        <EmptyState
          title={t("emptyFamilies")}
          description={t("noResults")}
          action={
            activeFilters.size > 0 ? (
              <Button variant="ghost" size="sm" onClick={() => setActiveFilters(new Set())}>
                {t("clearFilters")}
              </Button>
            ) : undefined
          }
        />
      ) : (
        <ul role="list" aria-label={t("list")} className="flex-1 sm:overflow-y-auto">
          {filteredFamilies.map((family) => (
            <li key={family.id}>
              <button
                type="button"
                onClick={() => handleFamilyClick(family)}
                aria-current={selectedId === family.id ? "true" : undefined}
                className={`w-full text-start px-[var(--space-4)] py-[var(--space-3)] border-b border-[var(--border-subtle)] cursor-pointer transition-colors duration-[var(--transition-fast)] min-h-[var(--touch-target-min)] ${
                  selectedId === family.id
                    ? "bg-[color-mix(in_srgb,var(--primary)_8%,transparent)]"
                    : "hover:bg-[var(--bg-secondary)]"
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="font-semibold text-[var(--text-primary)]">
                    {t("family")} {family.name}
                  </span>
                  <Badge variant={PRIORITY_BADGE[family.priority]}>
                    {t(family.priority)}
                  </Badge>
                </div>
                <p className="a11y-tertiary text-xs text-[var(--text-tertiary)] mb-1">ID: {(family.id ?? "").substring(0, 8)}</p>
                <p className="a11y-secondary text-sm text-[var(--text-secondary)]">{family.address}</p>
                <p className="a11y-tertiary text-sm text-[var(--text-secondary)]">{family.phone}</p>
                <div className="a11y-secondary flex items-center justify-between mt-2 text-xs text-[var(--text-tertiary)]">
                  <span className="flex items-center gap-1">
                    <Users size={14} /> {family.membersCount} {t("members")}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar size={14} /> {family.lastVisit}
                  </span>
                  <ChevronRight size={16} className="rtl:rotate-180 text-[var(--text-tertiary)]" />
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Floating actions (mobile) */}
      <div className="a11y-bottom-actions sm:hidden p-[var(--space-3)] border-t border-[var(--border-default)] flex gap-2">
        <Button
          variant="secondary"
          size="md"
          icon={<UserPlus size={18} />}
          onClick={() => setShowCreateFamily(true)}
        >
          {t("addFamily")}
        </Button>
        <Button
          variant="primary"
          size="md"
          icon={<PlusCircle size={18} />}
          className="flex-1"
          onClick={() => router.push("/app/new-visit")}
        >
          {t("newVisit")}
        </Button>
      </div>
    </div>
  );

  const mapPanel = (
    <MapViewDynamic
      items={filteredFamilies}
      selectedId={selectedId}
      onSelect={setSelectedId}
      onClusterModeChange={setIsClustered}
    />
  );

  return (
    <>
      <MapListLayout
        listPanel={listPanel}
        mapPanel={mapPanel}
        listLabel={t("list")}
        mapLabel={t("map")}
      />

      {/* Route planner slide-over */}
      {showRoutePlanner && (
        <div className="fixed inset-0 z-[var(--z-overlay)] flex justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowRoutePlanner(false)} aria-hidden="true" />
          <div className="relative w-full max-w-md bg-[var(--surface-raised)] shadow-[var(--elevation-5)] flex flex-col overflow-hidden">
            <RoutePlanner
              families={filteredFamilies}
              onClose={() => setShowRoutePlanner(false)}
              onRouteComputed={(polyline) => {
                setRoutePolyline(polyline);
                setShowRoutePlanner(false);
              }}
            />
          </div>
        </div>
      )}

      {/* Family detail slide-over */}
      {selectedFamily && (
        <FamilyDetail
          family={selectedFamily}
          onClose={() => setSelectedId(null)}
          onNewVisit={() => router.push(`/app/new-visit?familyId=${selectedFamily.id}`)}
        />
      )}

      {/* Emergency UX */}
      {!emergencySheetOpen && !emergencyJournalOpen && (
        <EmergencyFAB onClick={() => setEmergencySheetOpen(true)} />
      )}
      <EmergencyTriggerSheet
        open={emergencySheetOpen}
        onClose={() => setEmergencySheetOpen(false)}
        onConfirm={() => {
          setEmergencySheetOpen(false);
          setEmergencyJournalOpen(true);
        }}
      />
      <EmergencyJournal
        open={emergencyJournalOpen}
        onClose={() => setEmergencyJournalOpen(false)}
      />

      {/* Create Family Modal */}
      <CreateFamilyModal
        open={showCreateFamily}
        onClose={() => setShowCreateFamily(false)}
        onCreated={(f) => {
          setFamilies((prev) => [f, ...prev]);
          setShowCreateFamily(false);
        }}
      />
    </>
  );
}

// ─── Create Family Modal ───────────────────────────────────

function CreateFamilyModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (family: Family) => void;
}) {
  const { t } = useI18n();
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState("");
  const [headName, setHeadName] = useState("");
  const [householdSize, setHouseholdSize] = useState("1");
  const [formPhone, setFormPhone] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formZone, setFormZone] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");

  const resetForm = () => {
    setHeadName(""); setHouseholdSize("1"); setFormPhone(""); setFormAddress("");
    setFormZone(""); setLat(""); setLng(""); setFormError("");
  };

  const handleGeolocate = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => { setLat(pos.coords.latitude.toFixed(6)); setLng(pos.coords.longitude.toFixed(6)); },
      () => {},
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const handleCreate = async () => {
    if (!headName.trim()) return;
    setCreating(true);
    setFormError("");

    const payload: CreateFamilyPayload = {
      head_name: headName.trim(),
      household_size: Math.max(1, parseInt(householdSize) || 1),
      phone: formPhone.trim() || undefined,
      address_text: formAddress.trim() || undefined,
      zone_label: formZone.trim() || undefined,
      lat: parseFloat(lat) || 36.8,
      lng: parseFloat(lng) || 10.18,
    };

    if (USE_API) {
      const { data, error } = await apiCreateFamily(payload);
      if (data) {
        onCreated(apiFamilyToFamily(data));
        resetForm();
      } else {
        setFormError(t("familyCreateError"));
      }
    } else {
      const mockFamily: Family = {
        id: `FAM-${Date.now()}`,
        name: payload.head_name,
        address: payload.address_text ?? "",
        phone: payload.phone ?? "",
        priority: "normal",
        lat: payload.lat,
        lng: payload.lng,
        membersCount: payload.household_size,
        lastVisit: "",
        zone: payload.zone_label ?? "",
      };
      onCreated(mockFamily);
      resetForm();
    }
    setCreating(false);
  };

  return (
    <Modal open={open} onClose={() => { onClose(); resetForm(); }} title={t("addFamily")}>
      <div className="space-y-[var(--space-3)]">
        <div>
          <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">{t("headName")} *</label>
          <Input value={headName} onChange={(e) => setHeadName(e.target.value)} placeholder={t("headName")} />
        </div>
        <div>
          <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">{t("householdSize")}</label>
          <Input type="number" value={householdSize} onChange={(e) => setHouseholdSize(e.target.value)} min="1" />
        </div>
        <div>
          <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">{t("phone")}</label>
          <Input value={formPhone} onChange={(e) => setFormPhone(e.target.value)} placeholder={t("phone")} />
        </div>
        <div>
          <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">{t("addressText")}</label>
          <Input value={formAddress} onChange={(e) => setFormAddress(e.target.value)} placeholder={t("addressText")} />
        </div>
        <div>
          <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">{t("zoneLabel")}</label>
          <Input value={formZone} onChange={(e) => setFormZone(e.target.value)} placeholder={t("zoneLabel")} />
        </div>
        <Button variant="secondary" size="sm" icon={<MapPin size={16} />} onClick={handleGeolocate} className="w-full">
          {t("useMyLocation")}
        </Button>
        {formError && <p className="text-sm text-[var(--critical)]">{formError}</p>}
        <Button
          variant="primary" size="md" className="w-full"
          disabled={!headName.trim() || creating}
          icon={creating ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
          onClick={handleCreate}
        >
          {creating ? t("loading") : t("createFamily")}
        </Button>
      </div>
    </Modal>
  );
}

// ─── Family Bottom Sheet ───────────────────────────────────

function FamilyDetail({
  family,
  onClose,
  onNewVisit,
}: {
  family: Family;
  onClose: () => void;
  onNewVisit: () => void;
}) {
  const { t } = useI18n();
  const { isOnline } = useOffline();
  const [visits, setVisits] = useState<{ id: string; date: string; status: string; aidsLabels: string[] }[]>([]);

  useEffect(() => {
    if (!USE_API) {
      // Mock mode
      const { MOCK_VISITS, MOCK_AIDS } = require("@/lib/mock-data");
      const mockVisits = MOCK_VISITS
        .filter((v: { familyId: string }) => v.familyId === family.id)
        .map((v: { aids: { aidId: string; quantity: number }[]; [k: string]: unknown }) => ({
          ...v,
          aidsLabels: v.aids.map(
            (a: { aidId: string; quantity: number }) =>
              MOCK_AIDS.find((aid: { id: string }) => aid.id === a.aidId)?.label ?? a.aidId
          ),
        }));
      setVisits(mockVisits);
      return;
    }

    if (!isOnline) {
      // Offline: load from IndexedDB cache
      getCachedVisits(family.id).then((cached) => {
        if (cached.length > 0) {
          setVisits(
            (cached as any[]).map((v) => ({
              id: v.id,
              date: v.visited_at.split("T")[0],
              status: "completed",
              aidsLabels: v.aids.map((a: any) => a.label_fr),
            }))
          );
        }
      });
      return;
    }

    // API mode — fetch and cache for offline use
    apiGetVisits(family.id).then(({ data }) => {
      if (data) {
        cacheVisits(family.id, data).catch(() => {});
        setVisits(
          data.map((v) => ({
            id: v.id,
            date: v.visited_at.split("T")[0],
            status: "completed",
            aidsLabels: v.aids.map((a) => a.label_fr),
          }))
        );
      }
    });
  }, [family.id, isOnline]);

  const handleCall = () => {
    if (family.phone) window.open(`tel:${family.phone}`, "_self");
  };

  const handleNavigate = () => {
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${family.lat},${family.lng}`, "_blank");
  };

  return (
    <div className="fixed inset-0 z-[var(--z-overlay)] flex sm:justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />

      {/* Bottom sheet (mobile) / Side panel (desktop) */}
      <div
        role="dialog"
        aria-label={`${t("family")} ${family.name}`}
        className="relative w-full sm:max-w-md bg-[var(--surface-raised)] shadow-[var(--elevation-5)] flex flex-col overflow-y-auto
          mt-auto sm:mt-0 max-h-[85vh] sm:max-h-full rounded-t-2xl sm:rounded-none
          animate-slide-up sm:animate-none"
      >
        {/* Drag handle (mobile) */}
        <div className="sm:hidden flex justify-center pt-2 pb-1">
          <div className="w-10 h-1 rounded-full bg-[var(--border-default)]" />
        </div>

        {/* Header */}
        <div className="px-[var(--space-4)] py-[var(--space-3)] flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">
              {family.name}
            </h2>
            <p className="text-xs text-[var(--text-tertiary)]">{family.address}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={PRIORITY_BADGE[family.priority]}>{t(family.priority)}</Badge>
            <button
              onClick={onClose}
              aria-label={t("close")}
              className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)] cursor-pointer min-w-[var(--touch-target-min)] min-h-[var(--touch-target-min)]"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Quick Actions Row */}
        <div className="px-[var(--space-4)] pb-[var(--space-3)] flex gap-2">
          <button
            type="button"
            onClick={handleCall}
            disabled={!family.phone}
            className="flex-1 flex flex-col items-center gap-1 py-[var(--space-3)] rounded-[var(--radius-lg)] bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] disabled:opacity-40 cursor-pointer transition-colors min-h-[var(--touch-target-min)]"
          >
            <Phone size={20} className="text-[var(--success)]" />
            <span className="text-xs font-medium text-[var(--text-primary)]">{t("call")}</span>
          </button>
          <button
            type="button"
            onClick={handleNavigate}
            className="flex-1 flex flex-col items-center gap-1 py-[var(--space-3)] rounded-[var(--radius-lg)] bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] cursor-pointer transition-colors min-h-[var(--touch-target-min)]"
          >
            <Navigation2 size={20} className="text-[var(--primary)]" />
            <span className="text-xs font-medium text-[var(--text-primary)]">{t("navigate")}</span>
          </button>
          <button
            type="button"
            onClick={onNewVisit}
            className="flex-1 flex flex-col items-center gap-1 py-[var(--space-3)] rounded-[var(--radius-lg)] bg-[color-mix(in_srgb,var(--primary)_10%,transparent)] hover:bg-[color-mix(in_srgb,var(--primary)_15%,transparent)] cursor-pointer transition-colors min-h-[var(--touch-target-min)]"
          >
            <PlusCircle size={20} className="text-[var(--primary)]" />
            <span className="text-xs font-medium text-[var(--primary)]">{t("addVisit")}</span>
          </button>
        </div>

        {/* Info Grid */}
        <div className="px-[var(--space-4)] pb-[var(--space-3)]">
          <div className="grid grid-cols-3 gap-[var(--space-3)] text-center">
            <div className="p-[var(--space-2)] rounded-[var(--radius-md)] bg-[var(--bg-secondary)]">
              <p className="text-lg font-bold text-[var(--text-primary)]">{family.membersCount}</p>
              <p className="text-xs text-[var(--text-tertiary)]">{t("members")}</p>
            </div>
            <div className="p-[var(--space-2)] rounded-[var(--radius-md)] bg-[var(--bg-secondary)]">
              <p className="text-sm font-medium text-[var(--text-primary)]">{family.lastVisit || "—"}</p>
              <p className="text-xs text-[var(--text-tertiary)]">{t("lastVisit")}</p>
            </div>
            <div className="p-[var(--space-2)] rounded-[var(--radius-md)] bg-[var(--bg-secondary)]">
              <p className="text-sm font-medium text-[var(--text-primary)]">{family.zone || "—"}</p>
              <p className="text-xs text-[var(--text-tertiary)]">{t("zone")}</p>
            </div>
          </div>
        </div>

        {/* Visit history */}
        <div className="px-[var(--space-4)] pb-[var(--space-4)] flex-1">
          <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-[var(--space-2)]">
            {t("visitHistory")}
          </h3>
          {visits.length === 0 ? (
            <p className="text-sm text-[var(--text-tertiary)]">{t("noVisits")}</p>
          ) : (
            <div className="space-y-2">
              {visits.map((v) => (
                <div
                  key={v.id}
                  className="p-[var(--space-3)] rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-secondary)]"
                >
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{v.date}</span>
                    <span className="text-[var(--text-tertiary)]">{v.status}</span>
                  </div>
                  <p className="text-xs text-[var(--text-secondary)] mt-1">
                    {v.aidsLabels.join(", ")}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
