"use client";

import { cn } from "@/lib/utils";
import type { HTMLAttributes, ReactNode } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  elevated?: boolean;
  interactive?: boolean;
}

export default function Card({
  children,
  elevated = true,
  interactive = false,
  className,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-lg)] bg-[var(--surface-raised)] border border-[var(--border-subtle)] p-[var(--space-4)]",
        elevated && "shadow-[var(--elevation-2)]",
        interactive &&
          "cursor-pointer hover:shadow-[var(--elevation-3)] transition-shadow duration-[var(--transition-fast)]",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between mb-[var(--space-3)]", className)}>
      {children}
    </div>
  );
}

export function CardContent({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("", className)}>{children}</div>;
}
