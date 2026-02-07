"use client";

import { cn } from "@/lib/utils";
import { Map, List } from "lucide-react";
import { useState, type ReactNode } from "react";

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
  const [mobileView, setMobileView] = useState<"list" | "map">("list");

  return (
    <div className={cn("flex flex-col flex-1 overflow-hidden", className)}>
      {/* Mobile toggle */}
      <div className="flex sm:hidden border-b border-[var(--border-default)]">
        <button
          type="button"
          onClick={() => setMobileView("list")}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 h-[var(--height-tab)] text-sm font-medium cursor-pointer transition-colors border-b-2 -mb-px",
            mobileView === "list"
              ? "border-[var(--primary)] text-[var(--primary)]"
              : "border-transparent text-[var(--text-secondary)]"
          )}
        >
          <List size={18} />
          {listLabel}
        </button>
        <button
          type="button"
          onClick={() => setMobileView("map")}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 h-[var(--height-tab)] text-sm font-medium cursor-pointer transition-colors border-b-2 -mb-px",
            mobileView === "map"
              ? "border-[var(--primary)] text-[var(--primary)]"
              : "border-transparent text-[var(--text-secondary)]"
          )}
        >
          <Map size={18} />
          {mapLabel}
        </button>
      </div>

      {/* Desktop: side by side / Mobile: toggle */}
      <div className="flex flex-1 overflow-hidden">
        <section
          aria-label={listLabel}
          className={cn(
            "flex flex-col border-e border-[var(--border-default)] bg-[var(--surface-raised)] overflow-hidden",
            "w-full sm:w-[clamp(280px,35%,420px)]",
            mobileView !== "list" && "hidden sm:flex"
          )}
        >
          {listPanel}
        </section>

        <section
          aria-label={mapLabel}
          className={cn(
            "flex-1 relative overflow-hidden",
            mobileView !== "map" && "hidden sm:block"
          )}
        >
          {mapPanel}
        </section>
      </div>
    </div>
  );
}
