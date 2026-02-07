"use client";

import { useState, useCallback, useRef, type ChangeEvent } from "react";
import { useI18n } from "@/i18n";
import { useA11y } from "@/lib/accessibility-context";
import type { TranslationKey } from "@/i18n";
import {
  MOCK_AIDS, ALLOWED_ATTACHMENT_TYPES, MAX_ATTACHMENTS, MAX_ATTACHMENT_SIZE,
  type AidItem, type Attachment,
} from "@/lib/mock-data";
import { Button, AttachmentChip, PushToTalk } from "@/components/ds";
import TTSButton from "./TTSButton";
import {
  ChevronLeft, ChevronRight, Check, Minus, Plus,
  Paperclip, AlertTriangle,
} from "lucide-react";

interface InterviewWizardProps {
  aids: AidItem[];
  selectedAids: Map<string, number>;
  toggleAid: (id: string) => void;
  setAidQty: (id: string, qty: number, max: number) => void;
  notes: string;
  setNotes: (v: string) => void;
  onTranscript: (text: string) => void;
  attachments: Attachment[];
  onAddAttachment: (e: ChangeEvent<HTMLInputElement>) => void;
  onRemoveAttachment: (id: string) => void;
  complaintText: string;
  setComplaintText: (v: string) => void;
  onDone: () => void;
}

interface InterviewQuestion {
  id: string;
  titleKey: string;
  ttsText: string;
}

export default function InterviewWizard({
  aids, selectedAids, toggleAid, setAidQty,
  notes, setNotes, onTranscript,
  attachments, onAddAttachment, onRemoveAttachment,
  complaintText, setComplaintText,
  onDone,
}: InterviewWizardProps) {
  const { t, locale } = useI18n();
  const { tts } = useA11y();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isAr = locale === "ar";

  const questions: InterviewQuestion[] = [
    {
      id: "aids",
      titleKey: "aidsSelection",
      ttsText: isAr ? "اختر المساعدات التي تم تقديمها" : "Sélectionnez les aides distribuées",
    },
    {
      id: "notes",
      titleKey: "notes",
      ttsText: isAr ? "هل لديك ملاحظات حول هذه الزيارة؟" : "Avez-vous des notes sur cette visite ?",
    },
    {
      id: "attachments",
      titleKey: "attachments",
      ttsText: isAr ? "هل تريد إضافة صور أو ملفات؟" : "Souhaitez-vous ajouter des photos ou fichiers ?",
    },
    {
      id: "complaint",
      titleKey: "reportProblem",
      ttsText: isAr ? "هل هناك مشكلة تريد الإبلاغ عنها؟" : "Y a-t-il un problème à signaler ?",
    },
  ];

  const [currentQ, setCurrentQ] = useState(0);
  const q = questions[currentQ];

  const handleNext = () => {
    if (currentQ < questions.length - 1) setCurrentQ(currentQ + 1);
    else onDone();
  };

  const handleBack = () => {
    if (currentQ > 0) setCurrentQ(currentQ - 1);
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Progress */}
      <div className="px-[var(--space-4)] pt-[var(--space-4)]">
        <div className="flex gap-1 mb-[var(--space-2)]">
          {questions.map((_, i) => (
            <div
              key={i}
              className={`flex-1 h-1.5 rounded-full transition-colors ${
                i <= currentQ ? "bg-[var(--primary)]" : "bg-[var(--bg-tertiary)]"
              }`}
            />
          ))}
        </div>
        <p className="text-xs text-[var(--text-tertiary)]">{currentQ + 1} / {questions.length}</p>
      </div>

      {/* Question */}
      <div className="flex-1 overflow-y-auto p-[var(--space-4)]">
        <h2 className="text-[var(--text-2xl)] font-semibold text-[var(--text-primary)] mb-[var(--space-4)]">
          {t(q.titleKey as TranslationKey)}
        </h2>

        {/* TTS button (Enhancement 6 — only when TTS is on) */}
        {tts && (
          <div className="mb-[var(--space-4)]">
            <TTSButton text={q.ttsText} />
          </div>
        )}

        {/* Question-specific content */}
        {q.id === "aids" && (
          <AidsQuestion
            aids={aids}
            selectedAids={selectedAids}
            toggleAid={toggleAid}
            setAidQty={setAidQty}
            locale={locale}
          />
        )}

        {q.id === "notes" && (
          <NotesQuestion
            notes={notes}
            setNotes={setNotes}
            onTranscript={onTranscript}
            t={t}
          />
        )}

        {q.id === "attachments" && (
          <AttachmentsQuestion
            attachments={attachments}
            onAddAttachment={onAddAttachment}
            onRemoveAttachment={onRemoveAttachment}
            fileInputRef={fileInputRef}
            t={t}
          />
        )}

        {q.id === "complaint" && (
          <ComplaintQuestion
            complaintText={complaintText}
            setComplaintText={setComplaintText}
            t={t}
          />
        )}
      </div>

      {/* Navigation — bottom (SOT-04 §2.4: one-hand reachable) */}
      <div className="a11y-bottom-actions sticky bottom-0 bg-[var(--surface-raised)] border-t border-[var(--border-default)] p-[var(--space-4)]">
        <div className="flex gap-[var(--space-3)]">
          {currentQ > 0 && (
            <Button variant="secondary" size="lg" icon={<ChevronLeft size={18} />} onClick={handleBack}>
              {t("back")}
            </Button>
          )}
          <div className="flex-1" />
          <Button
            variant="primary"
            size="lg"
            onClick={handleNext}
            icon={currentQ === questions.length - 1 ? <Check size={18} /> : <ChevronRight size={18} />}
          >
            {currentQ === questions.length - 1 ? t("confirm") : t("next")}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Aids Question (large controls) ─────────────────────────

function AidsQuestion({
  aids, selectedAids, toggleAid, setAidQty, locale,
}: {
  aids: AidItem[];
  selectedAids: Map<string, number>;
  toggleAid: (id: string) => void;
  setAidQty: (id: string, qty: number, max: number) => void;
  locale: string;
}) {
  return (
    <div className="space-y-[var(--space-3)]">
      {aids.map((aid) => {
        const isSelected = selectedAids.has(aid.id);
        const qty = selectedAids.get(aid.id) ?? 0;
        return (
          <button
            key={aid.id}
            type="button"
            onClick={() => toggleAid(aid.id)}
            className={`w-full text-start p-[var(--space-4)] rounded-[var(--radius-lg)] border-2 cursor-pointer transition-colors min-h-[var(--touch-target-comfortable)] ${
              isSelected
                ? "border-[var(--primary)] bg-[color-mix(in_srgb,var(--primary)_8%,transparent)]"
                : "border-[var(--border-subtle)] bg-[var(--surface-raised)] hover:bg-[var(--bg-secondary)]"
            }`}
          >
            <span className="text-lg font-medium text-[var(--text-primary)]">
              {locale === "ar" ? aid.labelAr : aid.label}
            </span>
            {isSelected && (
              <div className="flex items-center gap-3 mt-[var(--space-3)]" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setAidQty(aid.id, qty - 1, aid.maxQty); }}
                  disabled={qty <= 1}
                  className="w-12 h-12 flex items-center justify-center rounded-full bg-[var(--bg-tertiary)] text-[var(--text-primary)] disabled:opacity-40 cursor-pointer min-w-[var(--touch-target-min)] min-h-[var(--touch-target-min)]"
                  aria-label="Decrease"
                >
                  <Minus size={20} />
                </button>
                <span className="text-2xl font-bold text-[var(--text-primary)] min-w-[3ch] text-center">{qty}</span>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setAidQty(aid.id, qty + 1, aid.maxQty); }}
                  disabled={qty >= aid.maxQty}
                  className="w-12 h-12 flex items-center justify-center rounded-full bg-[var(--bg-tertiary)] text-[var(--text-primary)] disabled:opacity-40 cursor-pointer min-w-[var(--touch-target-min)] min-h-[var(--touch-target-min)]"
                  aria-label="Increase"
                >
                  <Plus size={20} />
                </button>
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── Notes Question ─────────────────────────────────────────

function NotesQuestion({
  notes, setNotes, onTranscript, t,
}: {
  notes: string;
  setNotes: (v: string) => void;
  onTranscript: (text: string) => void;
  t: (key: TranslationKey) => string;
}) {
  return (
    <div className="space-y-[var(--space-4)]">
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder={t("notesPlaceholder")}
        rows={5}
        className="w-full p-[var(--space-4)] rounded-[var(--radius-lg)] border-2 border-[var(--border-default)] bg-[var(--bg-primary)] text-[var(--text-primary)] text-lg resize-y focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
      />
      <div>
        <h3 className="text-base font-medium text-[var(--text-primary)] mb-[var(--space-2)]">{t("sttTitle")}</h3>
        <PushToTalk onTranscript={onTranscript} />
      </div>
    </div>
  );
}

// ─── Attachments Question ───────────────────────────────────

function AttachmentsQuestion({
  attachments, onAddAttachment, onRemoveAttachment, fileInputRef, t,
}: {
  attachments: Attachment[];
  onAddAttachment: (e: ChangeEvent<HTMLInputElement>) => void;
  onRemoveAttachment: (id: string) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  t: (key: TranslationKey) => string;
}) {
  return (
    <div className="space-y-[var(--space-4)]">
      <div className="flex flex-wrap gap-3">
        {attachments.map((att) => (
          <AttachmentChip key={att.id} filename={att.filename} onRemove={() => onRemoveAttachment(att.id)} />
        ))}
      </div>
      <p className="text-sm text-[var(--text-tertiary)]">{attachments.length}/{MAX_ATTACHMENTS}</p>
      {attachments.length < MAX_ATTACHMENTS && (
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept={ALLOWED_ATTACHMENT_TYPES.join(",")}
            onChange={onAddAttachment}
            className="hidden"
          />
          <Button
            variant="secondary"
            size="lg"
            icon={<Paperclip size={20} />}
            onClick={() => fileInputRef.current?.click()}
            className="w-full"
          >
            {t("addAttachment")}
          </Button>
        </>
      )}
    </div>
  );
}

// ─── Complaint Question ─────────────────────────────────────

function ComplaintQuestion({
  complaintText, setComplaintText, t,
}: {
  complaintText: string;
  setComplaintText: (v: string) => void;
  t: (key: TranslationKey) => string;
}) {
  return (
    <div className="space-y-[var(--space-4)]">
      <p className="text-base text-[var(--text-secondary)] flex items-center gap-2">
        <AlertTriangle size={20} className="text-[var(--warning)] shrink-0" />
        {t("complaintDescription")}
      </p>
      <textarea
        value={complaintText}
        onChange={(e) => setComplaintText(e.target.value)}
        placeholder={t("complaintDescription")}
        rows={4}
        className="w-full p-[var(--space-4)] rounded-[var(--radius-lg)] border-2 border-[var(--border-default)] bg-[var(--bg-primary)] text-[var(--text-primary)] text-lg resize-y focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
      />
    </div>
  );
}
