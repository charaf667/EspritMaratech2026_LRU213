"use client";

import { useI18n } from "@/i18n";
import { Languages } from "lucide-react";

export default function LanguageSwitcher() {
  const { t, toggleLocale } = useI18n();
  return (
    <button
      onClick={toggleLocale}
      aria-label="Switch language"
      className="inline-flex items-center gap-1.5 px-3 h-9 border border-[var(--border-default)] rounded-[var(--radius-md)] bg-[var(--secondary)] text-[var(--text-primary)] text-sm font-medium hover:bg-[var(--secondary-hover)] cursor-pointer transition-colors min-h-[var(--touch-target-min)]"
    >
      <Languages size={16} />
      {t("switchLang")}
    </button>
  );
}
