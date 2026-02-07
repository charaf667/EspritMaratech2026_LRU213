"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Volume2, StopCircle } from "lucide-react";
import { useI18n } from "@/i18n";

interface TTSButtonProps {
  text: string;
  className?: string;
}

export default function TTSButton({ text, className }: TTSButtonProps) {
  const { locale } = useI18n();
  const [speaking, setSpeaking] = useState(false);
  const [supported, setSupported] = useState(true);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      setSupported(false);
    }
    return () => {
      window.speechSynthesis?.cancel();
    };
  }, []);

  const handleSpeak = useCallback(() => {
    if (!supported || !text) return;

    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = locale === "ar" ? "ar-SA" : "fr-FR";
    utterance.rate = 0.9;
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    utteranceRef.current = utterance;

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    setSpeaking(true);
  }, [text, locale, speaking, supported]);

  if (!supported) {
    return (
      <p className="text-xs text-[var(--text-tertiary)] italic">
        {locale === "ar" ? "TTS غير مدعوم في هذا المتصفح" : "TTS non supporté dans ce navigateur"}
      </p>
    );
  }

  const label = speaking
    ? (locale === "ar" ? "إيقاف" : "Arrêter")
    : (locale === "ar" ? "قراءة بصوت عالٍ" : "Lire à voix haute");

  return (
    <button
      type="button"
      onClick={handleSpeak}
      aria-label={label}
      className={`inline-flex items-center gap-2 px-4 py-2 rounded-[var(--radius-md)] text-sm font-medium cursor-pointer transition-colors min-h-[var(--touch-target-min)] ${
        speaking
          ? "bg-[var(--critical)] text-[var(--on-critical)] hover:bg-[var(--critical-hover)]"
          : "bg-[var(--primary)] text-[var(--on-primary)] hover:bg-[var(--primary-hover)]"
      } ${className ?? ""}`}
    >
      {speaking ? <StopCircle size={18} /> : <Volume2 size={18} />}
      {label}
    </button>
  );
}
