"use client";

import { I18nProvider } from "@/i18n";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import type { ReactNode } from "react";

export default function FeelingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-[var(--bg-secondary)]">
      {/* Simple header */}
      <header className="sticky top-0 z-[var(--z-sticky)] bg-[var(--surface-raised)] shadow-[var(--elevation-1)]">
        <div className="flex items-center justify-between px-[var(--space-4)] h-14 max-w-lg mx-auto">
          <div className="flex items-center gap-[var(--space-3)]">
            <div className="w-9 h-9 rounded-full bg-[var(--primary)] flex items-center justify-center text-[var(--on-primary)] text-sm font-bold">
              O
            </div>
            <span className="font-semibold text-[var(--text-primary)]">OMNIA</span>
          </div>
          <LanguageSwitcher />
        </div>
      </header>
      <main className="max-w-lg mx-auto p-[var(--space-4)]">
        {children}
      </main>
    </div>
  );
}
