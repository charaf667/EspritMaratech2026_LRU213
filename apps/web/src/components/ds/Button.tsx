"use client";

import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "critical" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-[var(--primary)] text-[var(--on-primary)] hover:bg-[var(--primary-hover)] active:bg-[var(--primary-active)] disabled:bg-[var(--primary-disabled)]",
  secondary:
    "bg-[var(--secondary)] text-[var(--on-secondary)] border border-[var(--border-default)] hover:bg-[var(--secondary-hover)] active:bg-[var(--secondary-active)] disabled:bg-[var(--secondary-disabled)]",
  critical:
    "bg-[var(--critical)] text-[var(--on-critical)] hover:bg-[var(--critical-hover)] active:bg-[var(--critical-active)] disabled:bg-[var(--critical-disabled)]",
  ghost:
    "bg-transparent text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] active:bg-[var(--bg-tertiary)]",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "h-9 px-3 text-sm gap-1.5",
  md: "h-[var(--height-button)] px-4 text-base gap-2",
  lg: "h-14 px-6 text-lg gap-2.5",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  children?: ReactNode;
  /** Keyboard shortcut hint shown on focus-visible (e.g. "Enter", "Tab", "Esc") */
  kbdHint?: string;
}

export default function Button({
  variant = "primary",
  size = "md",
  icon,
  children,
  className,
  disabled,
  kbdHint,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center font-medium rounded-[var(--radius-md)] cursor-pointer transition-colors duration-[var(--transition-fast)] disabled:cursor-not-allowed disabled:opacity-60",
        "min-w-[var(--touch-target-min)]",
        kbdHint && "relative group",
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      disabled={disabled}
      {...props}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      {children}
      {kbdHint && (
        <kbd className="kbd-hint hidden group-focus-visible:inline-block absolute -bottom-1 right-0 translate-y-full px-1.5 py-0.5 text-[10px] font-mono leading-none rounded bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] border border-[var(--border-subtle)] shadow-sm pointer-events-none z-10">
          {kbdHint}
        </kbd>
      )}
    </button>
  );
}
