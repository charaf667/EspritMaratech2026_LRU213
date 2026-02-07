"use client";

import { useI18n } from "@/i18n";
import { useA11y } from "@/lib/accessibility-context";
import type { Family, AidItem, Attachment } from "@/lib/mock-data";
import { Button, Card, AttachmentChip } from "@/components/ds";
import TTSButton from "./TTSButton";
import { Check, QrCode } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

interface InterviewReviewStepProps {
  family: Family;
  aids: AidItem[];
  selectedAids: Map<string, number>;
  notes: string;
  attachments: Attachment[];
  submitted: boolean;
  generatedToken: string | null;
  submitting: boolean;
  onSubmit: () => void;
}

export default function InterviewReviewStep({
  family,
  aids,
  selectedAids,
  notes,
  attachments,
  submitted,
  generatedToken,
  submitting,
  onSubmit,
}: InterviewReviewStepProps) {
  const { t, locale } = useI18n();
  const { tts } = useA11y();
  const isAr = locale === "ar";

  const aidsList = Array.from(selectedAids.entries()).map(([aidId, qty]) => {
    const aid = aids.find((a) => a.id === aidId);
    return {
      label: aid ? (isAr ? aid.labelAr : aid.label) : aidId,
      qty,
    };
  });

  const feelingUrl = generatedToken
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/feeling/card/${generatedToken}`
    : null;

  // Build TTS summary text
  const summaryParts: string[] = [];
  summaryParts.push(
    isAr
      ? `ملخص الزيارة للعائلة ${family.name}.`
      : `Résumé de la visite pour la famille ${family.name}.`
  );
  if (aidsList.length > 0) {
    const aidsText = aidsList.map((a) => `${a.label} × ${a.qty}`).join(", ");
    summaryParts.push(isAr ? `المساعدات: ${aidsText}.` : `Aides : ${aidsText}.`);
  }
  if (notes) {
    summaryParts.push(isAr ? `ملاحظات: ${notes}.` : `Notes : ${notes}.`);
  }
  const ttsText = summaryParts.join(" ");

  return (
    <div className="flex flex-col flex-1 overflow-y-auto p-[var(--space-4)]">
      {/* TTS reads the summary aloud */}
      {tts && !submitted && (
        <div className="mb-[var(--space-4)]">
          <TTSButton text={ttsText} />
        </div>
      )}

      {/* Success state */}
      {submitted && (
        <div className={`flex items-center gap-3 p-[var(--space-4)] rounded-[var(--radius-lg)] border mb-[var(--space-4)] ${
          generatedToken
            ? "bg-[color-mix(in_srgb,var(--success)_10%,transparent)] border-[var(--success)]"
            : "bg-[color-mix(in_srgb,var(--warning)_10%,transparent)] border-[var(--warning)]"
        }`}>
          <Check size={28} className={generatedToken ? "text-[var(--success)]" : "text-[var(--warning)]"} />
          <p className={`text-lg font-semibold ${generatedToken ? "text-[var(--success)]" : "text-[var(--warning)]"}`}>
            {generatedToken
              ? t("visitSuccess")
              : (isAr ? "تم الحفظ محلياً" : "Sauvegardé localement")}
          </p>
        </div>
      )}

      <h2 className="text-[var(--text-2xl)] font-semibold text-[var(--text-primary)] mb-[var(--space-4)]">
        {t("visitSummary")}
      </h2>

      {/* Family */}
      <Card className="mb-[var(--space-3)]">
        <h3 className="text-lg font-medium text-[var(--text-primary)] mb-2">{t("family")}</h3>
        <p className="text-base text-[var(--text-secondary)]">
          {family.name} — {family.address}
        </p>
      </Card>

      {/* Aids */}
      <Card className="mb-[var(--space-3)]">
        <h3 className="text-lg font-medium text-[var(--text-primary)] mb-2">{t("aids")}</h3>
        <ul className="space-y-2">
          {aidsList.map((a) => (
            <li key={a.label} className="flex justify-between text-base p-2 rounded-[var(--radius-md)] bg-[var(--bg-secondary)]">
              <span className="text-[var(--text-primary)]">{a.label}</span>
              <span className="font-semibold text-[var(--text-primary)]">x{a.qty}</span>
            </li>
          ))}
        </ul>
      </Card>

      {/* Notes */}
      {notes && (
        <Card className="mb-[var(--space-3)]">
          <h3 className="text-lg font-medium text-[var(--text-primary)] mb-2">{t("notes")}</h3>
          <p className="text-base text-[var(--text-secondary)] whitespace-pre-wrap">{notes}</p>
        </Card>
      )}

      {/* Attachments */}
      {attachments.length > 0 && (
        <Card className="mb-[var(--space-3)]">
          <h3 className="text-lg font-medium text-[var(--text-primary)] mb-2">{t("attachments")}</h3>
          <div className="flex flex-wrap gap-2">
            {attachments.map((att) => (
              <AttachmentChip key={att.id} filename={att.filename} />
            ))}
          </div>
        </Card>
      )}

      {/* QR Code */}
      {submitted && generatedToken && feelingUrl && (
        <Card className="flex flex-col items-center gap-[var(--space-4)] mb-[var(--space-3)]">
          <h3 className="text-lg font-medium text-[var(--text-primary)]">{t("generateQR")}</h3>
          <QRCodeSVG value={feelingUrl} size={240} level="M" />
          <p className="text-xs text-[var(--text-tertiary)] text-center break-all">{feelingUrl}</p>
        </Card>
      )}

      {/* Large confirm button */}
      {!submitted && (
        <div className="sticky bottom-0 pt-[var(--space-4)]">
          <Button
            variant="primary"
            size="lg"
            className="w-full"
            disabled={submitting}
            onClick={onSubmit}
            icon={<Check size={24} />}
          >
            {submitting ? "..." : t("submitVisit")}
          </Button>
        </div>
      )}
    </div>
  );
}
