"use client";

import { cn } from "@/lib/utils";
import { X, CheckCircle, AlertTriangle, Info, XCircle } from "lucide-react";
import { useEffect, type ReactNode } from "react";

export type ToastVariant = "success" | "warning" | "critical" | "info";

const icons: Record<ToastVariant, ReactNode> = {
  success: <CheckCircle size={20} />,
  warning: <AlertTriangle size={20} />,
  critical: <XCircle size={20} />,
  info: <Info size={20} />,
};

const variantStyles: Record<ToastVariant, string> = {
  success: "border-[var(--success)] text-[var(--success)]",
  warning: "border-[var(--warning)] text-[var(--warning)]",
  critical: "border-[var(--critical)] text-[var(--critical)]",
  info: "border-[var(--info)] text-[var(--info)]",
};

interface ToastProps {
  variant: ToastVariant;
  message: string;
  onDismiss?: () => void;
  autoDismiss?: number;
}

export default function Toast({ variant, message, onDismiss, autoDismiss = 5000 }: ToastProps) {
  useEffect(() => {
    if (autoDismiss && onDismiss) {
      const timer = setTimeout(onDismiss, autoDismiss);
      return () => clearTimeout(timer);
    }
  }, [autoDismiss, onDismiss]);

  return (
    <div
      role={variant === "critical" ? "alert" : "status"}
      aria-live={variant === "critical" ? "assertive" : "polite"}
      className={cn(
        "fixed bottom-4 start-4 end-4 sm:start-auto sm:end-4 sm:w-96 z-[var(--z-toast)]",
        "flex items-center gap-3 p-4 rounded-[var(--radius-lg)] bg-[var(--surface-raised)] border-l-4 shadow-[var(--elevation-4)]",
        variantStyles[variant]
      )}
    >
      <span className="shrink-0">{icons[variant]}</span>
      <p className="flex-1 text-sm text-[var(--text-primary)]">{message}</p>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Fermer"
          className="shrink-0 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] cursor-pointer min-w-[var(--touch-target-min)] min-h-[var(--touch-target-min)] flex items-center justify-center"
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
}
