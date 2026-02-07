"use client";

import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import type { ReactNode } from "react";

interface ChipProps {
  children: ReactNode;
  selected?: boolean;
  onToggle?: () => void;
  onRemove?: () => void;
  icon?: ReactNode;
  className?: string;
}

export default function Chip({
  children,
  selected = false,
  onToggle,
  onRemove,
  icon,
  className,
}: ChipProps) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onClick={onToggle}
      className={cn(
        "inline-flex items-center gap-1.5 h-[var(--height-chip)] px-3 rounded-full text-sm font-medium transition-colors duration-[var(--transition-fast)] cursor-pointer border",
        "min-h-[var(--height-chip)]",
        selected
          ? "bg-[var(--primary)] text-[var(--on-primary)] border-[var(--primary)]"
          : "bg-[var(--bg-secondary)] text-[var(--text-primary)] border-[var(--border-default)] hover:bg-[var(--bg-tertiary)]",
        className
      )}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      <span>{children}</span>
      {onRemove && (
        <span
          role="button"
          aria-label="Remove"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="shrink-0 ml-0.5 hover:opacity-70"
        >
          <X size={14} />
        </span>
      )}
    </button>
  );
}
