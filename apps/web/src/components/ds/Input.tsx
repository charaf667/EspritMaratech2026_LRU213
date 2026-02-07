"use client";

import { cn } from "@/lib/utils";
import type { InputHTMLAttributes, ReactNode } from "react";
import { forwardRef, useId } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: ReactNode;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, icon, className, id, ...props }, ref) => {
    const autoId = useId();
    const inputId = id || props.name || autoId;
    const errorId = `${inputId}-error`;
    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label htmlFor={inputId} className="text-[var(--text-sm)] font-medium text-[var(--text-primary)]">
            {label}
          </label>
        )}
        <div className="relative">
          {icon && (
            <span className="absolute inset-y-0 start-0 flex items-center ps-3 text-[var(--text-tertiary)] pointer-events-none">
              {icon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            className={cn(
              "w-full h-[var(--height-input)] px-3 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-primary)] text-[var(--text-primary)] text-base placeholder:text-[var(--text-tertiary)]",
              "focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)] focus:border-transparent",
              "transition-colors duration-[var(--transition-fast)]",
              icon && "ps-10",
              error && "border-[var(--critical)] focus:ring-[var(--critical)]",
              className
            )}
            {...props}
          />
        </div>
        {error && (
          <p id={errorId} className="text-[var(--text-sm)] text-[var(--critical)]" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";
export default Input;
