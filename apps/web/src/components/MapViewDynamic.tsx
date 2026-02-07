"use client";

import dynamic from "next/dynamic";
import type { Family } from "@/lib/mock-data";
import type { RouteData } from "./MapView";

const MapView = dynamic(() => import("./MapView"), {
  ssr: false,
  loading: () => (
    <div className="h-full flex items-center justify-center bg-[var(--bg-tertiary)] text-[var(--text-tertiary)]">
      Loading map...
    </div>
  ),
});

interface Props {
  items: Family[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  route?: RouteData | null;
  onClusterModeChange?: (isClustered: boolean) => void;
}

export default function MapViewDynamic(props: Props) {
  return <MapView {...props} />;
}
