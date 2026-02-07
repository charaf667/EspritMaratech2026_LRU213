"use client";

import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

interface StepperProps {
  steps: string[];
  currentStep: number;
  className?: string;
}

export default function Stepper({ steps, currentStep, className }: StepperProps) {
  return (
    <nav aria-label="Progress" className={cn("flex items-center justify-center gap-2", className)}>
      {steps.map((label, i) => {
        const isCompleted = i < currentStep;
        const isCurrent = i === currentStep;
        return (
          <div key={label} className="flex items-center gap-2">
            {i > 0 && (
              <div
                className={cn(
                  "w-8 h-0.5 rounded-full",
                  isCompleted ? "bg-[var(--primary)]" : "bg-[var(--border-default)]"
                )}
              />
            )}
            <div className="flex items-center gap-1.5">
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold shrink-0",
                  isCompleted && "bg-[var(--primary)] text-[var(--on-primary)]",
                  isCurrent && "bg-[var(--primary)] text-[var(--on-primary)] ring-2 ring-[var(--primary)] ring-offset-2 ring-offset-[var(--bg-primary)]",
                  !isCompleted && !isCurrent && "bg-[var(--bg-tertiary)] text-[var(--text-tertiary)]"
                )}
                aria-current={isCurrent ? "step" : undefined}
              >
                {isCompleted ? <Check size={16} /> : i + 1}
              </div>
              <span
                className={cn(
                  "text-sm hidden sm:inline",
                  isCurrent ? "font-semibold text-[var(--text-primary)]" : "text-[var(--text-secondary)]"
                )}
              >
                {label}
              </span>
            </div>
          </div>
        );
      })}
    </nav>
  );
}
