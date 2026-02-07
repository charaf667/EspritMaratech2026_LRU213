"use client";

import { useState } from "react";
import { useA11y, type TextSize } from "@/lib/accessibility-context";
import { useI18n } from "@/i18n";
import {
  Accessibility, X, BookOpen, Type, Contrast, Hand,
  MessageSquare, Volume2,
} from "lucide-react";

const TEXT_SIZE_OPTIONS: { value: TextSize; label: string; labelAr: string; labelTn: string }[] = [
  { value: "normal", label: "Normal", labelAr: "عادي", labelTn: "عادي" },
  { value: "large", label: "Large", labelAr: "كبير", labelTn: "كبير" },
  { value: "xl", label: "XL", labelAr: "كبير جداً", labelTn: "كبير برشا" },
];

export default function AccessibilityPanel() {
  const { locale } = useI18n();
  const a11y = useA11y();
  const [open, setOpen] = useState(false);

  const isAr = locale === "ar";
  const isTn = locale === "tn";
  const isRtl = isAr || isTn;
  const label = isTn ? "سهولة الوصول" : isAr ? "إمكانية الوصول" : "Accessibilité";

  return (
    <>
      {/* Trigger button — icon + label (SOT-04 §1.1: not icon-only) */}
      <button
        onClick={() => setOpen(true)}
        aria-label={label}
        className="inline-flex items-center gap-1.5 px-3 h-9 border border-[var(--border-default)] rounded-[var(--radius-md)] bg-[var(--secondary)] text-[var(--text-primary)] text-sm font-medium hover:bg-[var(--secondary-hover)] cursor-pointer transition-colors min-h-[var(--touch-target-min)]"
      >
        <Accessibility size={16} />
        <span className="hidden sm:inline">{label}</span>
      </button>

      {/* Panel overlay */}
      {open && (
        <div className="fixed inset-0 z-[var(--z-modal)] flex justify-end" role="dialog" aria-modal="true" aria-label={label}>
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} aria-hidden="true" />
          <div
            className="relative w-full max-w-sm bg-[var(--surface-raised)] shadow-[var(--elevation-5)] flex flex-col overflow-y-auto"
            onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }}
          >
            {/* Header */}
            <div className="sticky top-0 z-10 bg-[var(--surface-raised)] border-b border-[var(--border-default)] p-[var(--space-4)] flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[var(--text-primary)] flex items-center gap-2">
                <Accessibility size={20} className="text-[var(--primary)]" />
                {label}
              </h2>
              <button
                onClick={() => setOpen(false)}
                aria-label={isRtl ? "سكّر" : "Fermer"}
                className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)] cursor-pointer min-w-[var(--touch-target-min)] min-h-[var(--touch-target-min)]"
              >
                <X size={20} />
              </button>
            </div>

            {/* Toggles */}
            <div className="p-[var(--space-4)] space-y-[var(--space-4)]">

              {/* 1. Easy Read */}
              <ToggleRow
                icon={<BookOpen size={20} />}
                label={isTn ? "قراية ساهلة" : isAr ? "قراءة سهلة" : "Lecture facile"}
                description={isTn ? "خبّي النصوص الثانوية" : isAr ? "إخفاء النصوص الثانوية" : "Masquer les textes secondaires"}
                checked={a11y.easyRead}
                onChange={a11y.setEasyRead}
              />

              {/* 2. Text Size */}
              <div className="space-y-[var(--space-2)]">
                <div className="flex items-center gap-[var(--space-3)]">
                  <span className="text-[var(--primary)]"><Type size={20} /></span>
                  <span className="text-sm font-medium text-[var(--text-primary)]">
                    {isTn ? "حجم الخط" : isAr ? "حجم النص" : "Taille du texte"}
                  </span>
                </div>
                <div className="flex gap-2">
                  {TEXT_SIZE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => a11y.setTextSize(opt.value)}
                      className={`flex-1 py-2 px-3 rounded-[var(--radius-md)] text-sm font-medium cursor-pointer transition-colors border min-h-[var(--touch-target-min)] ${
                        a11y.textSize === opt.value
                          ? "bg-[var(--primary)] text-[var(--on-primary)] border-[var(--primary)]"
                          : "bg-[var(--bg-secondary)] text-[var(--text-primary)] border-[var(--border-subtle)] hover:bg-[var(--bg-tertiary)]"
                      }`}
                    >
                      {isTn ? opt.labelTn : isAr ? opt.labelAr : opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 3. High Contrast */}
              <ToggleRow
                icon={<Contrast size={20} />}
                label={isTn ? "تباين عالي" : isAr ? "تباين عالي" : "Contraste élevé"}
                description={isTn ? "خلّي النص والحدود يبانو أكثر" : isAr ? "تعزيز قراءة النصوص والحدود" : "Renforcer la lisibilité des textes et bordures"}
                checked={a11y.highContrast}
                onChange={a11y.setHighContrast}
              />

              {/* 4. One-hand mode */}
              <ToggleRow
                icon={<Hand size={20} />}
                label={isTn ? "بيد وحدة" : isAr ? "وضع اليد الواحدة" : "Mode une main"}
                description={isTn ? "الأزرار الكبيرة في الأسفل (موبايل)" : isAr ? "الإجراءات الرئيسية في الأسفل (جوال)" : "Actions principales en bas (mobile)"}
                checked={a11y.oneHand}
                onChange={a11y.setOneHand}
              />

              <hr className="border-[var(--border-subtle)]" />

              {/* 5. Interview Mode (wizard only) */}
              <ToggleRow
                icon={<MessageSquare size={20} />}
                label={isTn ? "وضع المقابلة" : isAr ? "وضع المقابلة" : "Mode entretien"}
                description={isTn ? "سؤال واحد في كل شاشة (المعالج برك)" : isAr ? "سؤال واحد لكل شاشة (المعالج فقط)" : "1 question par écran (wizard uniquement)"}
                checked={a11y.interviewMode}
                onChange={a11y.setInterviewMode}
              />

              {/* 6. TTS (only when interview mode is on) */}
              <ToggleRow
                icon={<Volume2 size={20} />}
                label={isTn ? "اقرا بصوت عالي" : isAr ? "قراءة بصوت عالٍ" : "Lire à voix haute (TTS)"}
                description={isTn ? "يخدم برك في وضع المقابلة" : isAr ? "متاح فقط في وضع المقابلة" : "Disponible uniquement en mode entretien"}
                checked={a11y.tts}
                onChange={a11y.setTts}
                disabled={!a11y.interviewMode}
              />
            </div>

            {/* Footer info */}
            <div className="p-[var(--space-4)] border-t border-[var(--border-subtle)] mt-auto">
              <p className="text-xs text-[var(--text-tertiary)]">
                {isTn
                  ? "الإعدادات تتسجّل في هالجهاز."
                  : isAr
                  ? "يتم حفظ الإعدادات محلياً على هذا الجهاز."
                  : "Les paramètres sont sauvegardés localement sur cet appareil."}
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Toggle Row ─────────────────────────────────────────────

function ToggleRow({
  icon, label, description, checked, onChange, disabled,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label
      className={`flex items-start gap-[var(--space-3)] cursor-pointer min-h-[var(--touch-target-min)] ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
    >
      <span className="text-[var(--primary)] mt-0.5 shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[var(--text-primary)]">{label}</p>
        <p className="text-xs text-[var(--text-tertiary)]">{description}</p>
      </div>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="mt-1 w-10 h-6 shrink-0 rounded-full appearance-none cursor-pointer transition-colors bg-[var(--bg-tertiary)] checked:bg-[var(--primary)] relative
          before:content-[''] before:absolute before:w-4 before:h-4 before:bg-white before:rounded-full before:top-1 before:left-1 before:transition-transform
          checked:before:translate-x-4 disabled:cursor-not-allowed"
        aria-label={label}
      />
    </label>
  );
}
