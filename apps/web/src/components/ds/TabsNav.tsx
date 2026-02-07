"use client";

import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export interface Tab {
  id: string;
  label: string;
  icon?: ReactNode;
}

interface TabsNavProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (id: string) => void;
  className?: string;
}

export default function TabsNav({ tabs, activeTab, onTabChange, className }: TabsNavProps) {
  return (
    <nav
      role="tablist"
      className={cn(
        "flex overflow-x-auto scrollbar-none gap-0 border-b border-[var(--border-default)]",
        className
      )}
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={activeTab === tab.id}
          onClick={() => onTabChange(tab.id)}
          className={cn(
            "flex items-center gap-2 h-[var(--height-tab)] px-4 text-sm font-medium whitespace-nowrap cursor-pointer transition-colors duration-[var(--transition-fast)] border-b-2 -mb-px",
            "min-h-[var(--touch-target-min)]",
            activeTab === tab.id
              ? "border-[var(--primary)] text-[var(--primary)]"
              : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)]"
          )}
        >
          {tab.icon && <span className="shrink-0">{tab.icon}</span>}
          {tab.label}
        </button>
      ))}
    </nav>
  );
}
