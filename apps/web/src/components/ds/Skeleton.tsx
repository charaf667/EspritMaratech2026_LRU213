"use client";

import { cn } from "@/lib/utils";

interface SkeletonProps {
  className?: string;
  variant?: "text" | "circular" | "rectangular";
  width?: string | number;
  height?: string | number;
}

export default function Skeleton({
  className,
  variant = "text",
  width,
  height,
}: SkeletonProps) {
  return (
    <div
      className={cn(
        "animate-pulse bg-[var(--bg-tertiary)]",
        variant === "text" && "h-4 rounded-[var(--radius-sm)]",
        variant === "circular" && "rounded-full",
        variant === "rectangular" && "rounded-[var(--radius-md)]",
        className
      )}
      style={{ width, height }}
      aria-hidden="true"
    />
  );
}

export function CardSkeleton() {
  return (
    <div className="p-4 border border-[var(--border-subtle)] rounded-[var(--radius-lg)] space-y-3">
      <div className="flex items-center justify-between">
        <Skeleton width="60%" />
        <Skeleton width={60} height={22} variant="rectangular" className="rounded-full" />
      </div>
      <Skeleton width="40%" />
      <Skeleton width="80%" />
    </div>
  );
}
