"use client";

import {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
  type ReactNode,
} from "react";

// ─── Types ──────────────────────────────────────────────────

export type TextSize = "normal" | "large" | "xl";

export interface A11yState {
  easyRead: boolean;
  textSize: TextSize;
  highContrast: boolean;
  oneHand: boolean;
  interviewMode: boolean;
  tts: boolean;
}

export interface A11yContextValue extends A11yState {
  setEasyRead: (v: boolean) => void;
  setTextSize: (v: TextSize) => void;
  setHighContrast: (v: boolean) => void;
  setOneHand: (v: boolean) => void;
  setInterviewMode: (v: boolean) => void;
  setTts: (v: boolean) => void;
}

const STORAGE_KEY = "omnia_a11y";

const DEFAULTS: A11yState = {
  easyRead: false,
  textSize: "normal",
  highContrast: false,
  oneHand: false,
  interviewMode: false,
  tts: false,
};

// ─── Context ────────────────────────────────────────────────

const A11yContext = createContext<A11yContextValue | null>(null);

function loadState(): A11yState {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return DEFAULTS;
}

function persistState(state: A11yState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch { /* ignore */ }
}

// ─── Apply CSS classes to <html> ────────────────────────────

function applyToDocument(state: A11yState) {
  if (typeof document === "undefined") return;
  const html = document.documentElement;

  // Easy Read
  html.classList.toggle("a11y-easy-read", state.easyRead);

  // Text Size
  html.classList.remove("a11y-text-large", "a11y-text-xl");
  if (state.textSize === "large") html.classList.add("a11y-text-large");
  if (state.textSize === "xl") html.classList.add("a11y-text-xl");

  // High Contrast
  html.classList.toggle("a11y-high-contrast", state.highContrast);

  // One Hand
  html.classList.toggle("a11y-one-hand", state.oneHand);

  // Interview Mode
  html.classList.toggle("a11y-interview", state.interviewMode);
}

// ─── Provider ───────────────────────────────────────────────

export function A11yProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<A11yState>(DEFAULTS);
  const [mounted, setMounted] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    const loaded = loadState();
    setState(loaded);
    applyToDocument(loaded);
    setMounted(true);
  }, []);

  // Persist + apply on change
  useEffect(() => {
    if (!mounted) return;
    persistState(state);
    applyToDocument(state);
  }, [state, mounted]);

  const setEasyRead = useCallback((v: boolean) => setState((s) => ({ ...s, easyRead: v })), []);
  const setTextSize = useCallback((v: TextSize) => setState((s) => ({ ...s, textSize: v })), []);
  const setHighContrast = useCallback((v: boolean) => setState((s) => ({ ...s, highContrast: v })), []);
  const setOneHand = useCallback((v: boolean) => setState((s) => ({ ...s, oneHand: v })), []);
  const setInterviewMode = useCallback((v: boolean) => setState((s) => ({ ...s, interviewMode: v, tts: v ? s.tts : false })), []);
  const setTts = useCallback((v: boolean) => setState((s) => ({ ...s, tts: s.interviewMode ? v : false })), []);

  const value = useMemo<A11yContextValue>(() => ({
    ...state, setEasyRead, setTextSize, setHighContrast, setOneHand, setInterviewMode, setTts,
  }), [state, setEasyRead, setTextSize, setHighContrast, setOneHand, setInterviewMode, setTts]);

  return <A11yContext.Provider value={value}>{children}</A11yContext.Provider>;
}

export function useA11y(): A11yContextValue {
  const ctx = useContext(A11yContext);
  if (!ctx) throw new Error("useA11y must be used within A11yProvider");
  return ctx;
}
