"use client";

import { cn } from "@/lib/utils";
import { AlertTriangle, Clock, CheckCircle, Info, Circle } from "lucide-react";
import type { ReactNode } from "react";

export type BadgeVariant = "critical" | "warning" | "success" | "info" | "neutral";

const variantStyles: Record<BadgeVariant, string> = {
  critical: "bg-[var(--critical)] text-[var(--on-critical)] border border-[var(--critical)]",
  warning: "bg-[var(--warning)] text-[var(--on-warning)] border border-[var(--warning)]",
  success: "bg-[var(--success)] text-[var(--on-success)] border border-[var(--success)]",
  info: "bg-[var(--info)] text-[var(--on-info)] border border-[var(--info)]",
  neutral: "bg-[var(--bg-secondary)] text-[var(--text-primary)] border border-[var(--border-default)]",
};

const variantIcons: Record<BadgeVariant, ReactNode> = {
  critical: <Clock size={14} aria-hidden="true" />,
  warning: <AlertTriangle size={14} aria-hidden="true" />,
  success: <CheckCircle size={14} aria-hidden="true" />,
  info: <Info size={14} aria-hidden="true" />,
  neutral: <Circle size={14} aria-hidden="true" />,
};

interface BadgeProps {
  variant: BadgeVariant;
  children: ReactNode;
  className?: string;
}

export default function Badge({ variant, children, className }: BadgeProps) {
  return (
    <span
      role="status"
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap",
        variantStyles[variant],
        className
      )}
    >
      {variantIcons[variant]}
      {children}
    </span>
  );
}
