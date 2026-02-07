"use client";

import { cn } from "@/lib/utils";
import { AlertTriangle } from "lucide-react";
import { useI18n } from "@/i18n";

interface EmergencyFABProps {
  onClick: () => void;
  className?: string;
}

export default function EmergencyFAB({ onClick, className }: EmergencyFABProps) {
  const { t } = useI18n();

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={t("emergencyFab")}
      className={cn(
        "fixed z-[var(--z-fab)] flex items-center gap-2 px-4 py-3",
        "bg-[var(--critical)] text-[var(--on-critical)]",
        "rounded-full shadow-[var(--elevation-4)]",
        "hover:bg-[var(--critical-hover)] active:bg-[var(--critical-active)]",
        "transition-colors duration-[var(--transition-fast)]",
        "min-h-[var(--touch-target-min)] cursor-pointer",
        "bottom-[calc(var(--space-4)+env(safe-area-inset-bottom,0px))] end-[var(--space-4)]",
        "sm:bottom-[var(--space-6)] sm:end-[var(--space-6)]",
        className
      )}
    >
      <AlertTriangle size={20} aria-hidden="true" />
      <span className="font-semibold text-sm">{t("emergencyFab")}</span>
    </button>
  );
}
