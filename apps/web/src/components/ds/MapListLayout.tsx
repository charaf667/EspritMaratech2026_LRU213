"use client";

import { cn } from "@/lib/utils";
import { Map, List } from "lucide-react";
import { useCallback, useState, type ReactNode } from "react";
import BottomSheet from "./BottomSheet";

interface MapListLayoutProps {
  mapPanel: ReactNode;
  listPanel: ReactNode;
  mapLabel?: string;
  listLabel?: string;
  className?: string;
}

export default function MapListLayout({
  mapPanel,
  listPanel,
  mapLabel = "Carte",
  listLabel = "Liste",
  className,
}: MapListLayoutProps) {
  // Mobile: 0=peek (map dominant), 1=mid, 2=full (list dominant)
  const [sheetSnap, setSheetSnap] = useState(1);

  const handleToggleList = useCallback(() => setSheetSnap(2), []);
  const handleToggleMap = useCallback(() => setSheetSnap(0), []);

  return (
    <div className={cn("flex flex-col flex-1 overflow-hidden", className)}>
      {/* ═══ MOBILE: map base + bottom sheet overlay ═══ */}
      <div className="flex flex-col flex-1 sm:hidden relative overflow-hidden">
        {/* Mobile toggle bar */}
        <div className="flex border-b border-[var(--border-default)] bg-[var(--surface-raised)] z-10 relative">
          <button
            type="button"
            onClick={handleToggleList}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 h-[var(--height-tab)] text-sm font-medium cursor-pointer transition-colors border-b-2 -mb-px",
              sheetSnap === 2
                ? "border-[var(--primary)] text-[var(--primary)]"
                : "border-transparent text-[var(--text-secondary)]"
            )}
          >
            <List size={18} />
            {listLabel}
          </button>
          <button
            type="button"
            onClick={handleToggleMap}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 h-[var(--height-tab)] text-sm font-medium cursor-pointer transition-colors border-b-2 -mb-px",
              sheetSnap === 0
                ? "border-[var(--primary)] text-[var(--primary)]"
                : "border-transparent text-[var(--text-secondary)]"
            )}
          >
            <Map size={18} />
            {mapLabel}
          </button>
        </div>

        {/* Map — always visible as base layer */}
        <section aria-label={mapLabel} className="flex-1 relative">
          {mapPanel}
        </section>

        {/* Bottom sheet with list content */}
        <BottomSheet
          defaultSnap={1}
          onSnapChange={setSheetSnap}
          snapPoints={undefined}
        >
          <div className="flex flex-col min-h-0">
            {listPanel}
          </div>
        </BottomSheet>
      </div>

      {/* ═══ DESKTOP / TABLET: side-by-side (unchanged) ═══ */}
      <div className="hidden sm:flex flex-1 overflow-hidden">
        <section
          aria-label={listLabel}
          className="flex flex-col border-e border-[var(--border-default)] bg-[var(--surface-raised)] overflow-hidden w-[clamp(280px,35%,420px)]"
        >
          {listPanel}
        </section>
        <section aria-label={mapLabel} className="flex-1 relative overflow-hidden">
          {mapPanel}
        </section>
      </div>
    </div>
  );
}
