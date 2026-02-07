"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";
import { type Locale, type TranslationKey, isRTL, t } from "./translations";

interface I18nContextValue {
  locale: Locale;
  dir: "ltr" | "rtl";
  t: (key: TranslationKey) => string;
  setLocale: (locale: Locale) => void;
  toggleLocale: () => void;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({
  children,
  defaultLocale = "fr",
}: {
  children: ReactNode;
  defaultLocale?: Locale;
}) {
  const [locale, setLocaleState] = useState<Locale>(defaultLocale);
  const dir: "ltr" | "rtl" = isRTL(locale) ? "rtl" : "ltr";

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    document.documentElement.lang = l;
    document.documentElement.dir = isRTL(l) ? "rtl" : "ltr";
  }, []);

  const toggleLocale = useCallback(() => {
    const order: Locale[] = ["fr", "tn", "ar"];
    const idx = order.indexOf(locale);
    setLocale(order[(idx + 1) % order.length]);
  }, [locale, setLocale]);

  const translate = useCallback(
    (key: TranslationKey) => t(locale, key),
    [locale]
  );

  const value = useMemo(
    () => ({ locale, dir, t: translate, setLocale, toggleLocale }),
    [locale, dir, translate, setLocale, toggleLocale]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
