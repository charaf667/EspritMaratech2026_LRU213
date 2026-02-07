"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import Supercluster from "supercluster";
import type { Family } from "@/lib/mock-data";
import { MAP_CENTER, MAP_ZOOM } from "@/lib/mock-data";
type FieldItem = Family;

const CLUSTER_THRESHOLD = 150;

// Fix Leaflet default icon paths (broken in bundlers by default)
import "leaflet/dist/leaflet.css";

const defaultIcon = new L.Icon({
  iconUrl: "/leaflet/marker-icon.png",
  iconRetinaUrl: "/leaflet/marker-icon-2x.png",
  shadowUrl: "/leaflet/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

L.Marker.prototype.options.icon = defaultIcon;

/**
 * Create a numbered circle icon for route waypoints.
 */
function createNumberedIcon(num: number): L.DivIcon {
  return new L.DivIcon({
    html: `<div style="
      width: 28px; height: 28px;
      background: var(--primary); color: var(--on-primary);
      border-radius: 50%; border: 2px solid white;
      display: flex; align-items: center; justify-content: center;
      font-size: 13px; font-weight: bold;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
    ">${num}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14],
    className: "",
  });
}

function FlyToSelected({
  item,
}: {
  item: FieldItem | undefined;
}) {
  const map = useMap();
  useEffect(() => {
    if (item) {
      map.flyTo([item.lat, item.lng], 14, { duration: 0.5 });
    }
  }, [item, map]);
  return null;
}

/**
 * Create a circle DivIcon for cluster markers showing the point count.
 */
function createClusterIcon(count: number): L.DivIcon {
  const size = count < 10 ? 34 : count < 100 ? 40 : 48;
  return new L.DivIcon({
    html: `<div style="
      width: ${size}px; height: ${size}px;
      background: var(--primary); color: var(--on-primary);
      border-radius: 50%; border: 3px solid var(--bg-primary);
      display: flex; align-items: center; justify-content: center;
      font-size: 13px; font-weight: bold;
      box-shadow: 0 2px 8px rgba(0,0,0,0.25);
    ">${count}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    className: "",
  });
}

interface ClusterLayerProps {
  items: FieldItem[];
  onSelect: (id: string) => void;
}

/**
 * Renders markers via supercluster. Recomputes visible clusters on map
 * move/zoom using the current bounding box.
 */
function ClusterLayer({ items, onSelect }: ClusterLayerProps) {
  const map = useMap();
  type PointProps = { id: string; name: string; address: string };
  type ClusterOrPoint = GeoJSON.Feature<GeoJSON.Point, any>;
  const [clusters, setClusters] = useState<ClusterOrPoint[]>([]);

  const indexRef = useRef<Supercluster<{ id: string; name: string; address: string }> | null>(null);

  // Build the supercluster index when items change
  useMemo(() => {
    const index = new Supercluster<{ id: string; name: string; address: string }>({
      radius: 60,
      maxZoom: 17,
    });
    const points: Supercluster.PointFeature<{ id: string; name: string; address: string }>[] =
      items.map((item) => ({
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: [item.lng, item.lat] },
        properties: { id: item.id, name: item.name, address: item.address },
      }));
    index.load(points);
    indexRef.current = index;
  }, [items]);

  const updateClusters = useCallback(() => {
    const idx = indexRef.current;
    if (!idx) return;
    const bounds = map.getBounds();
    const bbox: [number, number, number, number] = [
      bounds.getWest(),
      bounds.getSouth(),
      bounds.getEast(),
      bounds.getNorth(),
    ];
    const zoom = map.getZoom();
    setClusters(idx.getClusters(bbox, Math.floor(zoom)));
  }, [map]);

  // Recompute on mount and on every move/zoom
  useEffect(() => {
    updateClusters();
  }, [updateClusters, items]);

  useMapEvents({
    moveend: updateClusters,
    zoomend: updateClusters,
  });

  return (
    <>
      {clusters.map((feature) => {
        const [lng, lat] = feature.geometry.coordinates;
        const props = feature.properties;

        if ((props as any).cluster) {
          const clusterId = (props as any).cluster_id as number;
          const count = (props as any).point_count as number;
          return (
            <Marker
              key={`cluster-${clusterId}`}
              position={[lat, lng]}
              icon={createClusterIcon(count)}
              eventHandlers={{
                click: () => {
                  const idx = indexRef.current;
                  if (!idx) return;
                  const expansionZoom = Math.min(idx.getClusterExpansionZoom(clusterId), 18);
                  map.flyTo([lat, lng], expansionZoom, { duration: 0.4 });
                },
              }}
            />
          );
        }

        // Single point
        const p = props as { id: string; name: string; address: string };
        return (
          <Marker
            key={p.id}
            position={[lat, lng]}
            eventHandlers={{ click: () => onSelect(p.id) }}
          >
            <Popup>
              <strong>{p.name}</strong>
              <br />
              {p.address}
            </Popup>
          </Marker>
        );
      })}
    </>
  );
}

export interface RouteData {
  points: { lat: number; lng: number }[];
  polyline?: string | null;
  totalDistanceKm?: number | null;
  totalDurationMin?: number | null;
}

interface MapViewProps {
  items: FieldItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  route?: RouteData | null;
  onClusterModeChange?: (isClustered: boolean) => void;
}

/**
 * Decode an encoded polyline string (Google's encoding) to lat/lng pairs.
 */
function decodePolyline(encoded: string): [number, number][] {
  const points: [number, number][] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte: number;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const dlat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const dlng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    points.push([lat / 1e5, lng / 1e5]);
  }

  return points;
}

export default function MapView({ items, selectedId, onSelect, route, onClusterModeChange }: MapViewProps) {
  const selected = items.find((i) => i.id === selectedId);
  const useClusters = !route && items.length >= CLUSTER_THRESHOLD;

  // Notify parent when cluster mode changes
  useEffect(() => {
    onClusterModeChange?.(useClusters);
  }, [useClusters, onClusterModeChange]);

  // Build polyline positions from route data
  const routePositions: [number, number][] = route?.polyline
    ? decodePolyline(route.polyline)
    : route?.points
    ? route.points.map((p) => [p.lat, p.lng] as [number, number])
    : [];

  return (
    <MapContainer
      center={MAP_CENTER}
      zoom={MAP_ZOOM}
      style={{ height: "100%", width: "100%" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FlyToSelected item={selected} />

      {/* Regular markers (small dataset, no route) */}
      {!route && !useClusters &&
        items.map((item) => (
          <Marker
            key={item.id}
            position={[item.lat, item.lng]}
            eventHandlers={{ click: () => onSelect(item.id) }}
          >
            <Popup>
              <strong>{item.name}</strong>
              <br />
              {item.address}
            </Popup>
          </Marker>
        ))}

      {/* Clustered markers (large dataset, no route) */}
      {useClusters && <ClusterLayer items={items} onSelect={onSelect} />}

      {/* Numbered markers (when route is active) */}
      {route &&
        route.points.map((p, i) => {
          const family = items.find(
            (f) => Math.abs(f.lat - p.lat) < 0.001 && Math.abs(f.lng - p.lng) < 0.001
          );
          return (
            <Marker
              key={`route-${i}`}
              position={[p.lat, p.lng]}
              icon={createNumberedIcon(i + 1)}
              eventHandlers={family ? { click: () => onSelect(family.id) } : {}}
            >
              <Popup>
                <strong>#{i + 1}</strong>
                {family && (
                  <>
                    <br />
                    {family.name} — {family.address}
                  </>
                )}
              </Popup>
            </Marker>
          );
        })}

      {/* Route polyline */}
      {routePositions.length > 1 && (
        <Polyline
          positions={routePositions}
          pathOptions={{
            color: "var(--primary)",
            weight: 4,
            opacity: 0.8,
            dashArray: "8 4",
          }}
        />
      )}
    </MapContainer>
  );
}
