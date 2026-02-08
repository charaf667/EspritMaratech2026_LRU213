"use client";

import { cn } from "@/lib/utils";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

export interface BottomSheetProps {
  children: ReactNode;
  /** Snap points in px from bottom. Default: [120, 50vh, 90vh] */
  snapPoints?: number[];
  /** Index of default snap point (0-indexed). Default: 1 (mid) */
  defaultSnap?: number;
  /** Called when snap index changes */
  onSnapChange?: (index: number) => void;
  /** Extra class on the sheet container */
  className?: string;
  /** Whether to show drag handle */
  dragHandle?: boolean;
}

const DRAG_THRESHOLD = 20;

export default function BottomSheet({
  children,
  snapPoints: snapPointsProp,
  defaultSnap = 1,
  onSnapChange,
  className,
  dragHandle = true,
}: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef<number | null>(null);
  const dragStartHeight = useRef<number>(0);
  const [currentSnap, setCurrentSnap] = useState(defaultSnap);
  const [isDragging, setIsDragging] = useState(false);
  const [dragHeight, setDragHeight] = useState<number | null>(null);

  // Compute snap points in px (resolve vh units at render time)
  const getSnapHeights = useCallback(() => {
    if (typeof window === "undefined") return [120, 400, 700];
    const vh = window.innerHeight;
    if (snapPointsProp) return snapPointsProp;
    return [120, Math.round(vh * 0.5), Math.round(vh * 0.88)];
  }, [snapPointsProp]);

  const [snapHeights, setSnapHeights] = useState<number[]>(() => getSnapHeights());

  useEffect(() => {
    const update = () => setSnapHeights(getSnapHeights());
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [getSnapHeights]);

  const currentHeight = isDragging && dragHeight !== null ? dragHeight : snapHeights[currentSnap] ?? snapHeights[1];

  const snapTo = useCallback(
    (index: number) => {
      const clamped = Math.max(0, Math.min(index, snapHeights.length - 1));
      setCurrentSnap(clamped);
      onSnapChange?.(clamped);
    },
    [snapHeights.length, onSnapChange]
  );

  // Find nearest snap point
  const findNearestSnap = useCallback(
    (height: number) => {
      let nearest = 0;
      let minDist = Math.abs(snapHeights[0] - height);
      for (let i = 1; i < snapHeights.length; i++) {
        const dist = Math.abs(snapHeights[i] - height);
        if (dist < minDist) {
          minDist = dist;
          nearest = i;
        }
      }
      return nearest;
    },
    [snapHeights]
  );

  // Touch handlers
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      dragStartY.current = e.touches[0].clientY;
      dragStartHeight.current = snapHeights[currentSnap] ?? snapHeights[1];
    },
    [currentSnap, snapHeights]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (dragStartY.current === null) return;
      const deltaY = dragStartY.current - e.touches[0].clientY;
      const newHeight = dragStartHeight.current + deltaY;

      if (!isDragging && Math.abs(deltaY) > DRAG_THRESHOLD) {
        setIsDragging(true);
      }
      if (isDragging || Math.abs(deltaY) > DRAG_THRESHOLD) {
        const minH = snapHeights[0] * 0.5;
        const maxH = snapHeights[snapHeights.length - 1] * 1.05;
        setDragHeight(Math.max(minH, Math.min(maxH, newHeight)));
      }
    },
    [isDragging, snapHeights]
  );

  const handleTouchEnd = useCallback(() => {
    if (isDragging && dragHeight !== null) {
      const nearest = findNearestSnap(dragHeight);
      snapTo(nearest);
    }
    dragStartY.current = null;
    setIsDragging(false);
    setDragHeight(null);
  }, [isDragging, dragHeight, findNearestSnap, snapTo]);

  // Pointer handlers (mouse fallback for desktop testing)
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.pointerType === "touch") return; // handled by touch events
      dragStartY.current = e.clientY;
      dragStartHeight.current = snapHeights[currentSnap] ?? snapHeights[1];
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [currentSnap, snapHeights]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (e.pointerType === "touch" || dragStartY.current === null) return;
      const deltaY = dragStartY.current - e.clientY;
      const newHeight = dragStartHeight.current + deltaY;
      if (!isDragging && Math.abs(deltaY) > DRAG_THRESHOLD) {
        setIsDragging(true);
      }
      if (isDragging || Math.abs(deltaY) > DRAG_THRESHOLD) {
        const minH = snapHeights[0] * 0.5;
        const maxH = snapHeights[snapHeights.length - 1] * 1.05;
        setDragHeight(Math.max(minH, Math.min(maxH, newHeight)));
      }
    },
    [isDragging, snapHeights]
  );

  const handlePointerUp = useCallback(() => {
    if (isDragging && dragHeight !== null) {
      const nearest = findNearestSnap(dragHeight);
      snapTo(nearest);
    }
    dragStartY.current = null;
    setIsDragging(false);
    setDragHeight(null);
  }, [isDragging, dragHeight, findNearestSnap, snapTo]);

  return (
    <div
      ref={sheetRef}
      role="region"
      aria-label="Bottom sheet"
      className={cn(
        "absolute bottom-0 left-0 right-0 z-[var(--z-overlay)] bg-[var(--surface-raised)] rounded-t-2xl shadow-[var(--elevation-5)] flex flex-col overflow-hidden",
        !isDragging && "transition-[height] duration-300 ease-out",
        className
      )}
      style={{
        height: `${currentHeight}px`,
        maxHeight: "92vh",
        touchAction: "none",
      }}
    >
      {/* Drag handle */}
      {dragHandle && (
        <div
          className="flex justify-center pt-2 pb-1 cursor-grab active:cursor-grabbing shrink-0"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          role="slider"
          aria-label="Drag to resize"
          aria-valuemin={0}
          aria-valuemax={snapHeights.length - 1}
          aria-valuenow={currentSnap}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "ArrowUp") snapTo(Math.min(currentSnap + 1, snapHeights.length - 1));
            if (e.key === "ArrowDown") snapTo(Math.max(currentSnap - 1, 0));
          }}
        >
          <div className="w-10 h-1 rounded-full bg-[var(--border-default)]" />
        </div>
      )}

      {/* Sheet content */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain">
        {children}
      </div>
    </div>
  );
}
