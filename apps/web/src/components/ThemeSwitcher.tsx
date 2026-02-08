"use client";

import { useTheme } from "@/lib/theme-context";
import { useI18n } from "@/i18n";
import { Sun, Moon } from "lucide-react";

export default function ThemeSwitcher() {
  const { theme, toggleTheme } = useTheme();
  const { t } = useI18n();
  const isDark = theme === "dark";

  return (
    <button
      onClick={toggleTheme}
      aria-label={isDark ? t("lightMode") : t("darkMode")}
      className="inline-flex items-center justify-center w-10 h-10 rounded-full hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)] cursor-pointer transition-colors min-w-[var(--touch-target-min)] min-h-[var(--touch-target-min)]"
    >
      {isDark ? <Sun size={20} /> : <Moon size={20} />}
    </button>
  );
}
