"use client";

import { useState, useCallback } from "react";
import { useI18n } from "@/i18n";
import { useOffline } from "@/lib/offline-context";
import {
  apiSubmitVisitAttestation,
  type SubmitAttestationPayload,
} from "@/lib/api";
import { addToOutbox } from "@/lib/offline-db";
import { Card, CardHeader, Button, Input, Chip } from "@/components/ds";
import SignaturePad from "@/components/ds/SignaturePad";
import {
  PenLine, Ban, Send, CheckCircle2, Loader2,
} from "lucide-react";

type Mode = "signed" | "cannot_sign";
type CannotSignReason = "illiterate" | "disability" | "absent" | "refused" | "other";

const REASONS: CannotSignReason[] = ["illiterate", "disability", "absent", "refused", "other"];

interface AttestationCardProps {
  visitId: string | null;
  onSubmitted?: () => void;
}

export default function AttestationCard({ visitId, onSubmitted }: AttestationCardProps) {
  const { t } = useI18n();
  const { isOnline } = useOffline();

  const [mode, setMode] = useState<Mode>("signed");
  const [signatureSvg, setSignatureSvg] = useState<string | null>(null);
  const [assisted, setAssisted] = useState(false);
  const [reason, setReason] = useState<CannotSignReason | "">("");
  const [reasonDetail, setReasonDetail] = useState("");
  const [witnessName, setWitnessName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [savedOffline, setSavedOffline] = useState(false);

  const reasonLabelKey = (r: CannotSignReason) => {
    const map: Record<CannotSignReason, string> = {
      illiterate: "attestationReasonIlliterate",
      disability: "attestationReasonDisability",
      absent: "attestationReasonAbsent",
      refused: "attestationReasonRefused",
      other: "attestationReasonOther",
    };
    return map[r] as Parameters<typeof t>[0];
  };

  const canSubmit = mode === "signed"
    ? !!signatureSvg
    : !!reason;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    setSubmitting(true);

    const clientId = crypto.randomUUID();
    const payload: SubmitAttestationPayload = {
      client_id: clientId,
      status: mode,
      ...(mode === "signed"
        ? {
            signature_svg: signatureSvg ?? undefined,
            assisted,
          }
        : {
            cannot_sign_reason: reason || undefined,
            cannot_sign_detail: reasonDetail.trim() || undefined,
            witness_name: witnessName.trim() || undefined,
          }),
    };

    if (visitId && isOnline) {
      const { error } = await apiSubmitVisitAttestation(visitId, payload);
      if (error) {
        await saveToOutbox(visitId, clientId, payload);
        setSavedOffline(true);
      }
    } else {
      const url = visitId
        ? `/api/v1/visits/${visitId}/attestation/`
        : "/api/v1/visits/__pending__/attestation/";
      await addToOutbox({
        url,
        method: "POST",
        body: JSON.stringify(payload),
        clientId,
      });
      setSavedOffline(true);
    }

    setSubmitting(false);
    setSubmitted(true);
    onSubmitted?.();
  }, [canSubmit, mode, signatureSvg, assisted, reason, reasonDetail, witnessName, visitId, isOnline, onSubmitted]);

  const saveToOutbox = async (vId: string, clientId: string, payload: SubmitAttestationPayload) => {
    await addToOutbox({
      url: `/api/v1/visits/${vId}/attestation/`,
      method: "POST",
      body: JSON.stringify(payload),
      clientId,
    });
  };

  if (submitted) {
    return (
      <Card>
        <div className="flex items-center gap-3 py-[var(--space-2)]">
          <CheckCircle2 size={24} className="text-[var(--success)] shrink-0" />
          <p className="text-sm font-medium text-[var(--success)]">
            {savedOffline ? t("attestationSavedOffline") : t("attestationSubmitted")}
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <h3 className="text-base font-semibold text-[var(--text-primary)] flex items-center gap-2">
          <PenLine size={18} className="text-[var(--primary)]" />
          {t("attestation")}
        </h3>
      </CardHeader>

      {/* Mode toggle */}
      <div className="flex gap-2 mb-[var(--space-4)]">
        <Chip selected={mode === "signed"} onToggle={() => setMode("signed")}>
          {t("attestationSign")}
        </Chip>
        <Chip selected={mode === "cannot_sign"} onToggle={() => setMode("cannot_sign")}>
          {t("attestationCannotSign")}
        </Chip>
      </div>

      {/* Sign mode */}
      {mode === "signed" && (
        <div className="space-y-[var(--space-3)]">
          <SignaturePad onSignatureChange={setSignatureSvg} />

          {/* Assisted toggle */}
          <label className="flex items-center gap-[var(--space-2)] cursor-pointer min-h-[var(--touch-target-min)]">
            <input
              type="checkbox"
              checked={assisted}
              onChange={(e) => setAssisted(e.target.checked)}
              className="w-5 h-5 rounded border-[var(--border-default)] accent-[var(--primary)]"
            />
            <span className="text-sm text-[var(--text-secondary)]">
              {t("attestationAssisted")}
            </span>
          </label>
        </div>
      )}

      {/* Cannot sign mode */}
      {mode === "cannot_sign" && (
        <div className="space-y-[var(--space-3)]">
          {/* Reason selection */}
          <div>
            <label className="block text-sm font-medium text-[var(--text-primary)] mb-[var(--space-2)]">
              {t("attestationReason")} *
            </label>
            <div className="grid grid-cols-2 gap-2">
              {REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setReason(r)}
                  className={`text-start p-[var(--space-3)] rounded-[var(--radius-md)] border-2 text-sm transition-colors cursor-pointer min-h-[var(--touch-target-min)] ${
                    reason === r
                      ? "border-[var(--primary)] bg-[color-mix(in_srgb,var(--primary)_8%,transparent)] font-medium text-[var(--text-primary)]"
                      : "border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--border-strong)]"
                  }`}
                >
                  {t(reasonLabelKey(r))}
                </button>
              ))}
            </div>
          </div>

          {/* Reason detail */}
          <Input
            placeholder={t("attestationReasonDetail")}
            value={reasonDetail}
            onChange={(e) => setReasonDetail(e.target.value)}
          />

          {/* Witness name */}
          <Input
            placeholder={t("attestationWitness")}
            value={witnessName}
            onChange={(e) => setWitnessName(e.target.value)}
          />
        </div>
      )}

      {/* Submit */}
      <div className="mt-[var(--space-4)]">
        <Button
          type="button"
          variant="primary"
          size="md"
          icon={submitting ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
          className="w-full"
          disabled={!canSubmit || submitting}
          onClick={handleSubmit}
        >
          {submitting ? t("loading") : t("attestationSubmit")}
        </Button>
      </div>
    </Card>
  );
}
