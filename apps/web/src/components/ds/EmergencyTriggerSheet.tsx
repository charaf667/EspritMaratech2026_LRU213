"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";
import { AlertTriangle, X, ChevronRight } from "lucide-react";
import { useI18n } from "@/i18n";

interface EmergencyTriggerSheetProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

const SLIDE_THRESHOLD = 0.85;

export default function EmergencyTriggerSheet({ open, onClose, onConfirm }: EmergencyTriggerSheetProps) {
  const { t } = useI18n();
  const trackRef = useRef<HTMLDivElement>(null);
  const [slideProgress, setSlideProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef(0);
  const trackWidthRef = useRef(0);

  const resetSlide = useCallback(() => {
    setSlideProgress(0);
    setIsDragging(false);
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    setIsDragging(true);
    startXRef.current = e.clientX;
    if (trackRef.current) {
      trackWidthRef.current = trackRef.current.offsetWidth - 56;
    }
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging) return;
    const isRTL = document.documentElement.dir === "rtl";
    const delta = isRTL
      ? startXRef.current - e.clientX
      : e.clientX - startXRef.current;
    const progress = Math.max(0, Math.min(1, delta / trackWidthRef.current));
    setSlideProgress(progress);
  }, [isDragging]);

  const handlePointerUp = useCallback(() => {
    if (slideProgress >= SLIDE_THRESHOLD) {
      onConfirm();
    }
    resetSlide();
  }, [slideProgress, onConfirm, resetSlide]);

  useEffect(() => {
    if (!open) resetSlide();
  }, [open, resetSlide]);

  useEffect(() => {
    if (!open) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [open, onClose]);

  if (!open) return null;

  const thumbOffset = slideProgress * (trackWidthRef.current || 200);

  return (
    <div className="fixed inset-0 z-[var(--z-modal)] flex items-end justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("emergencyFab")}
        className="relative w-full max-w-lg rounded-t-[var(--radius-xl)] bg-[var(--surface-overlay)] shadow-[var(--elevation-5)] p-6 pb-[calc(var(--space-6)+env(safe-area-inset-bottom,0px))] animate-in slide-in-from-bottom"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-[var(--critical)] flex items-center justify-center">
              <AlertTriangle size={24} className="text-[var(--on-critical)]" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[var(--text-primary)]">{t("emergency")}</h2>
              <p className="text-sm text-[var(--text-secondary)]">{t("emergencySlideToAlert")}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("emergencyCancel")}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)] cursor-pointer min-w-[var(--touch-target-min)] min-h-[var(--touch-target-min)]"
          >
            <X size={20} />
          </button>
        </div>

        {/* Slide-to-alert track */}
        <div
          ref={trackRef}
          className="relative h-16 rounded-full bg-[var(--bg-tertiary)] border-2 border-[var(--critical)] overflow-hidden select-none touch-none"
        >
          {/* Fill */}
          <div
            className="absolute inset-y-0 start-0 bg-[var(--critical)] opacity-20 transition-none rounded-full"
            style={{ width: `${slideProgress * 100}%` }}
          />

          {/* Label */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span
              className={cn(
                "text-sm font-semibold flex items-center gap-2 transition-opacity",
                slideProgress > 0.3 ? "opacity-0" : "opacity-100"
              )}
              style={{ color: "var(--critical)" }}
            >
              {t("emergencySlideToAlert")}
              <ChevronRight size={18} className="rtl:rotate-180 animate-pulse" />
            </span>
          </div>

          {/* Thumb */}
          <div
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={resetSlide}
            className={cn(
              "absolute top-1 bottom-1 start-1 w-14 rounded-full bg-[var(--critical)] flex items-center justify-center cursor-grab active:cursor-grabbing transition-none",
              slideProgress >= SLIDE_THRESHOLD && "bg-[var(--success)]"
            )}
            style={{
              transform: `translateX(${document.documentElement.dir === "rtl" ? -thumbOffset : thumbOffset}px)`,
            }}
          >
            <AlertTriangle size={22} className="text-[var(--on-critical)]" />
          </div>
        </div>

        {/* Cancel button */}
        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full text-center text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer min-h-[var(--touch-target-min)] flex items-center justify-center"
        >
          {t("emergencyCancel")}
        </button>
      </div>
    </div>
  );
}
