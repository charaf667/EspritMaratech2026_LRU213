"use client";

import { useState, useCallback } from "react";
import { useI18n } from "@/i18n";
import type { Family } from "@/lib/mock-data";
import { USE_API, apiComputeRoute } from "@/lib/api";
import { Button, Badge, Card } from "@/components/ds";
import type { BadgeVariant } from "./Badge";
import type { Priority } from "@/lib/mock-data";
import { Route, MapPin, Clock, Ruler, ChevronRight, X, Loader2 } from "lucide-react";

const PRIORITY_BADGE: Record<Priority, BadgeVariant> = {
  overdue: "critical",
  urgent: "warning",
  normal: "neutral",
};

interface RoutePlannerProps {
  families: Family[];
  onClose: () => void;
  /** Callback with ordered lat/lng pairs for the map to draw a polyline */
  onRouteComputed?: (polyline: [number, number][] | null, orderedFamilies: Family[]) => void;
}

interface RouteResult {
  orderedFamilies: Family[];
  polyline: [number, number][] | null;
  distanceKm: number | null;
  durationMin: number | null;
}

export default function RoutePlanner({ families, onClose, onRouteComputed }: RoutePlannerProps) {
  const { t } = useI18n();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [computing, setComputing] = useState(false);
  const [result, setResult] = useState<RouteResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const toggleFamily = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setResult(null);
  }, []);

  const selectedFamilies = families.filter((f) => selectedIds.has(f.id));

  const handleCompute = useCallback(async () => {
    if (selectedFamilies.length < 2) return;
    setError(null);
    setComputing(true);

    const points = selectedFamilies.map((f) => ({
      lat: f.lat,
      lng: f.lng,
      label: f.name,
    }));

    if (!USE_API) {
      // Mock mode: return families in priority order with mock distance
      const ordered = [...selectedFamilies].sort((a, b) => {
        const order: Record<Priority, number> = { overdue: 0, urgent: 1, normal: 2 };
        return order[a.priority] - order[b.priority];
      });
      const polyline: [number, number][] = ordered.map((f) => [f.lat, f.lng]);
      const mockResult: RouteResult = {
        orderedFamilies: ordered,
        polyline,
        distanceKm: Math.round(ordered.length * 2.3 * 10) / 10,
        durationMin: Math.round(ordered.length * 8),
      };
      setResult(mockResult);
      onRouteComputed?.(polyline, ordered);
      setComputing(false);
      return;
    }

    const { data, error: apiError } = await apiComputeRoute(points);
    setComputing(false);

    if (data) {
      // Reorder families based on API response
      const orderedFamilies = data.points.map((p) => {
        return selectedFamilies.find((f) =>
          Math.abs(f.lat - p.lat) < 0.0001 && Math.abs(f.lng - p.lng) < 0.0001
        ) ?? selectedFamilies[0];
      });

      // Decode polyline if provided, otherwise use point order
      let polyline: [number, number][] | null = null;
      if (data.polyline) {
        polyline = decodePolyline(data.polyline);
      } else {
        polyline = orderedFamilies.map((f) => [f.lat, f.lng]);
      }

      const routeResult: RouteResult = {
        orderedFamilies,
        polyline,
        distanceKm: data.total_distance_km,
        durationMin: data.total_duration_min,
      };
      setResult(routeResult);
      onRouteComputed?.(polyline, orderedFamilies);
    } else {
      setError(apiError ?? "Erreur de calcul");
    }
  }, [selectedFamilies, onRouteComputed]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-[var(--space-4)] py-[var(--space-3)] border-b border-[var(--border-default)] bg-[var(--surface-raised)]">
        <div className="flex items-center gap-2">
          <Route size={20} className="text-[var(--primary)]" />
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">{t("planRoute")}</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("close")}
          className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)] cursor-pointer min-w-[var(--touch-target-min)] min-h-[var(--touch-target-min)]"
        >
          <X size={20} />
        </button>
      </div>

      {/* Family selection list */}
      <div className="flex-1 overflow-y-auto p-[var(--space-4)]">
        <p className="text-sm text-[var(--text-secondary)] mb-[var(--space-3)]">
          {t("routeSelectFamilies")} ({selectedIds.size} {t("families").toLowerCase()})
        </p>

        <div className="space-y-[var(--space-2)] mb-[var(--space-4)]">
          {families.map((f) => {
            const selected = selectedIds.has(f.id);
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => toggleFamily(f.id)}
                className={`w-full text-start p-[var(--space-3)] rounded-[var(--radius-md)] border cursor-pointer transition-colors min-h-[var(--touch-target-min)] flex items-center gap-[var(--space-3)] ${
                  selected
                    ? "border-[var(--primary)] bg-[color-mix(in_srgb,var(--primary)_8%,transparent)]"
                    : "border-[var(--border-subtle)] bg-[var(--surface-raised)] hover:bg-[var(--bg-secondary)]"
                }`}
              >
                <input
                  type="checkbox"
                  checked={selected}
                  readOnly
                  className="w-5 h-5 shrink-0 accent-[var(--primary)] pointer-events-none"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-[var(--text-primary)] truncate">
                      {t("family")} {f.name}
                    </span>
                    <Badge variant={PRIORITY_BADGE[f.priority]}>
                      {t(f.priority)}
                    </Badge>
                  </div>
                  <p className="a11y-secondary text-xs text-[var(--text-tertiary)] truncate">{f.address}</p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Route result */}
        {result && (
          <Card className="mb-[var(--space-4)]">
            {/* Stats */}
            <div className="flex gap-[var(--space-4)] mb-[var(--space-3)]">
              {result.distanceKm != null && (
                <div className="flex items-center gap-1.5 text-sm">
                  <Ruler size={16} className="text-[var(--primary)]" />
                  <span className="font-medium text-[var(--text-primary)]">
                    {t("routeDistance")}: {result.distanceKm} km
                  </span>
                </div>
              )}
              {result.durationMin != null && (
                <div className="flex items-center gap-1.5 text-sm">
                  <Clock size={16} className="text-[var(--primary)]" />
                  <span className="font-medium text-[var(--text-primary)]">
                    {t("routeDuration")}: {result.durationMin} min
                  </span>
                </div>
              )}
            </div>

            {/* Ordered stops */}
            <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-[var(--space-2)]">
              {t("routeStops")} ({result.orderedFamilies.length})
            </h3>
            <ol className="space-y-[var(--space-2)]">
              {result.orderedFamilies.map((f, idx) => (
                <li
                  key={f.id}
                  className="flex items-center gap-[var(--space-2)] text-sm"
                >
                  <span className="w-6 h-6 rounded-full bg-[var(--primary)] text-[var(--on-primary)] flex items-center justify-center text-xs font-bold shrink-0">
                    {idx + 1}
                  </span>
                  <MapPin size={14} className="text-[var(--text-tertiary)] shrink-0" />
                  <span className="text-[var(--text-primary)] truncate">{f.name}</span>
                  {idx < result.orderedFamilies.length - 1 && (
                    <ChevronRight size={14} className="text-[var(--text-tertiary)] shrink-0 rtl:rotate-180" />
                  )}
                </li>
              ))}
            </ol>
          </Card>
        )}

        {error && (
          <p className="text-sm text-[var(--critical)] mb-[var(--space-3)]" role="alert">{error}</p>
        )}
      </div>

      {/* Bottom action */}
      <div className="a11y-bottom-actions sticky bottom-0 p-[var(--space-4)] border-t border-[var(--border-default)] bg-[var(--surface-raised)]">
        {selectedIds.size < 2 ? (
          <p className="text-sm text-center text-[var(--text-tertiary)]">{t("routeNoSelection")}</p>
        ) : (
          <Button
            variant="primary"
            size="md"
            className="w-full"
            disabled={computing}
            onClick={handleCompute}
            icon={computing ? <Loader2 size={18} className="animate-spin" /> : <Route size={18} />}
          >
            {computing ? "..." : t("routeCompute")}
          </Button>
        )}
      </div>
    </div>
  );
}

/** Decode Google-style encoded polyline to lat/lng pairs */
function decodePolyline(encoded: string): [number, number][] {
  const result: [number, number][] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let shift = 0;
    let val = 0;
    let byte: number;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      val |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const dLat = val & 1 ? ~(val >> 1) : val >> 1;
    lat += dLat;

    shift = 0;
    val = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      val |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const dLng = val & 1 ? ~(val >> 1) : val >> 1;
    lng += dLng;

    result.push([lat / 1e5, lng / 1e5]);
  }

  return result;
}
