"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/i18n";
import { useAuth } from "@/lib/auth-context";
import { MOCK_FAMILIES, MOCK_VISITS, MOCK_AIDS, type Family, type Priority } from "@/lib/mock-data";
import { USE_API, apiGetFamilies, apiFamilyToFamily, apiGetVisits, apiVisitAidLabels } from "@/lib/api";
import { useOffline } from "@/lib/offline-context";
import { getCachedFamilies, getCachedVisits, cacheVisits, type OutboxEntry } from "@/lib/offline-db";
import { MapListLayout, Input, Chip, Badge, EmptyState, Button, EmergencyFAB, EmergencyTriggerSheet, EmergencyJournal, type BadgeVariant } from "@/components/ds";
import { CardSkeleton } from "@/components/ds/Skeleton";
import MapViewDynamic from "@/components/MapViewDynamic";
import RoutePlanner from "@/components/ds/RoutePlanner";
import { Search, ChevronRight, Users, Calendar, PlusCircle, WifiOff, Route } from "lucide-react";

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
    <div className="flex flex-col h-full overflow-hidden">
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
        <ul role="list" aria-label={t("list")} className="flex-1 overflow-y-auto">
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
                <p className="a11y-tertiary text-xs text-[var(--text-tertiary)] mb-1">ID: {family.id.substring(0, 8)}</p>
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
          icon={<Route size={20} />}
          onClick={() => setShowRoutePlanner(true)}
        >
          {t("planRoute")}
        </Button>
        <Button
          variant="primary"
          size="md"
          icon={<PlusCircle size={20} />}
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
    </>
  );
}

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

  return (
    <div className="fixed inset-0 z-[var(--z-overlay)] flex justify-end sm:items-stretch">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div className="relative w-full max-w-md bg-[var(--surface-raised)] shadow-[var(--elevation-5)] flex flex-col overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-[var(--surface-raised)] border-b border-[var(--border-default)] p-[var(--space-4)] flex items-center justify-between z-10">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">
            {t("family")} {family.name}
          </h2>
          <button
            onClick={onClose}
            aria-label={t("close")}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)] cursor-pointer min-w-[var(--touch-target-min)] min-h-[var(--touch-target-min)]"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="p-[var(--space-4)] space-y-[var(--space-4)] flex-1">
          <Badge variant={PRIORITY_BADGE[family.priority]}>{t(family.priority)}</Badge>

          <dl className="grid grid-cols-2 gap-y-[var(--space-3)] gap-x-[var(--space-4)] text-sm">
            <dt className="text-[var(--text-tertiary)]">{t("familyId")}</dt>
            <dd className="text-[var(--text-primary)] font-medium">{family.id.substring(0, 8)}</dd>

            <dt className="text-[var(--text-tertiary)]">{t("address")}</dt>
            <dd className="text-[var(--text-primary)]">{family.address}</dd>

            <dt className="text-[var(--text-tertiary)]">{t("phone")}</dt>
            <dd className="text-[var(--text-primary)]">{family.phone}</dd>

            <dt className="text-[var(--text-tertiary)]">{t("members")}</dt>
            <dd className="text-[var(--text-primary)]">{family.membersCount}</dd>

            <dt className="text-[var(--text-tertiary)]">{t("lastVisit")}</dt>
            <dd className="text-[var(--text-primary)]">{family.lastVisit}</dd>

            <dt className="text-[var(--text-tertiary)]">{t("zone")}</dt>
            <dd className="text-[var(--text-primary)]">{family.zone}</dd>
          </dl>

          {/* Visit history */}
          <div>
            <h3 className="text-base font-medium text-[var(--text-primary)] mb-[var(--space-3)]">
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

        {/* Footer CTA */}
        <div className="sticky bottom-0 p-[var(--space-4)] border-t border-[var(--border-default)] bg-[var(--surface-raised)]">
          <Button
            variant="primary"
            size="md"
            icon={<PlusCircle size={20} />}
            className="w-full"
            onClick={onNewVisit}
          >
            {t("newVisit")}
          </Button>
        </div>
      </div>
    </div>
  );
}
