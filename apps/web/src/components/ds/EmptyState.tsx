"use client";

import { cn } from "@/lib/utils";
import { SearchX } from "lucide-react";
import type { ReactNode } from "react";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export default function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-12 px-4 text-center", className)}>
      <div className="text-[var(--text-tertiary)] mb-3">
        {icon || <SearchX size={48} aria-hidden="true" />}
      </div>
      <h3 className="text-lg font-medium text-[var(--text-primary)] mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-[var(--text-secondary)] mb-4 max-w-xs">{description}</p>
      )}
      {action}
    </div>
  );
}
