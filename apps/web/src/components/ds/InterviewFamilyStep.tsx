"use client";

import { useState, useMemo } from "react";
import { useI18n } from "@/i18n";
import { useA11y } from "@/lib/accessibility-context";
import type { Family, Priority } from "@/lib/mock-data";
import { Badge, PushToTalk } from "@/components/ds";
import TTSButton from "./TTSButton";
import type { BadgeVariant } from "./Badge";
import { Search, Users, MapPin } from "lucide-react";

const PRIORITY_BADGE: Record<Priority, BadgeVariant> = {
  overdue: "critical",
  urgent: "warning",
  normal: "neutral",
};

interface InterviewFamilyStepProps {
  families: Family[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onNext: () => void;
}

export default function InterviewFamilyStep({
  families,
  selectedId,
  onSelect,
  onNext,
}: InterviewFamilyStepProps) {
  const { t, locale } = useI18n();
  const { tts } = useA11y();
  const isAr = locale === "ar";

  const [search, setSearch] = useState("");

  // Voice search callback
  const handleVoiceSearch = (text: string) => {
    setSearch(text);
  };

  const filtered = useMemo(() => {
    if (!search.trim()) {
      // Show top 5 by priority when no search
      return [...families]
        .sort((a, b) => {
          const order: Record<Priority, number> = { overdue: 0, urgent: 1, normal: 2 };
          return order[a.priority] - order[b.priority];
        })
        .slice(0, 5);
    }
    const q = search.toLowerCase();
    return families.filter(
      (f) =>
        f.name.toLowerCase().includes(q) ||
        f.address.toLowerCase().includes(q) ||
        f.id.toLowerCase().includes(q) ||
        f.phone.toLowerCase().includes(q)
    );
  }, [search, families]);

  const ttsText = isAr
    ? "اختر العائلة المستفيدة. يمكنك البحث بالصوت."
    : "Sélectionnez la famille bénéficiaire. Vous pouvez rechercher par la voix.";

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Title + TTS */}
      <div className="px-[var(--space-4)] pt-[var(--space-4)]">
        <h2 className="text-[var(--text-2xl)] font-semibold text-[var(--text-primary)] mb-[var(--space-3)]">
          {t("selectFamily")}
        </h2>

        {tts && (
          <div className="mb-[var(--space-3)]">
            <TTSButton text={ttsText} />
          </div>
        )}

        {/* Voice search */}
        <div className="mb-[var(--space-3)]">
          <PushToTalk onTranscript={handleVoiceSearch} />
        </div>

        {/* Text search */}
        <div className="relative mb-[var(--space-3)]">
          <Search size={20} className="absolute start-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("searchFamily")}
            className="w-full ps-10 pe-4 py-3 rounded-[var(--radius-lg)] border-2 border-[var(--border-default)] bg-[var(--bg-primary)] text-[var(--text-primary)] text-lg focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
          />
        </div>

        <p className="text-xs text-[var(--text-tertiary)] mb-[var(--space-2)]">
          {search.trim()
            ? `${filtered.length} ${isAr ? "نتيجة" : "résultat(s)"}`
            : (isAr ? "أهم 5 عائلات حسب الأولوية" : "Top 5 familles par priorité")}
        </p>
      </div>

      {/* Family cards — large touch targets */}
      <div className="flex-1 overflow-y-auto px-[var(--space-4)] pb-[var(--space-4)]">
        <div className="space-y-[var(--space-3)]">
          {filtered.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => {
                onSelect(f.id);
                onNext();
              }}
              className={`w-full text-start p-[var(--space-4)] rounded-[var(--radius-lg)] border-2 cursor-pointer transition-colors min-h-[var(--touch-target-comfortable)] ${
                selectedId === f.id
                  ? "border-[var(--primary)] bg-[color-mix(in_srgb,var(--primary)_8%,transparent)]"
                  : "border-[var(--border-subtle)] bg-[var(--surface-raised)] hover:bg-[var(--bg-secondary)]"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-lg font-semibold text-[var(--text-primary)]">
                  {t("family")} {f.name}
                </span>
                <Badge variant={PRIORITY_BADGE[f.priority]}>
                  {t(f.priority)}
                </Badge>
              </div>
              <div className="flex items-center gap-3 text-sm text-[var(--text-secondary)]">
                <span className="flex items-center gap-1">
                  <Users size={16} /> {f.membersCount}
                </span>
                <span className="flex items-center gap-1">
                  <MapPin size={16} /> {f.zone || f.address}
                </span>
              </div>
              {f.phone && (
                <p className="text-sm text-[var(--text-tertiary)] mt-1">{f.phone}</p>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
