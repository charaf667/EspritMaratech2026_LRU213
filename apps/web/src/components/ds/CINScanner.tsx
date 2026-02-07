"use client";

import { useState, useRef, useCallback } from "react";
import { useI18n } from "@/i18n";
import { apiExtractCIN } from "@/lib/api";
import { Button, Card } from "@/components/ds";
import { Camera, Upload, Loader2, Check, AlertTriangle } from "lucide-react";

interface CINFields {
  nin?: string;
  last_name?: string;
  first_name?: string;
  date_of_birth?: string;
  place_of_birth?: string;
  address?: string;
  candidates?: string[];
}

interface CINScannerProps {
  onExtracted: (fields: CINFields) => void;
  onClose?: () => void;
}

type ScanState = "idle" | "capturing" | "processing" | "done" | "error";

export default function CINScanner({ onExtracted, onClose }: CINScannerProps) {
  const { t } = useI18n();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<ScanState>("idle");
  const [preview, setPreview] = useState<string | null>(null);
  const [fields, setFields] = useState<CINFields | null>(null);
  const [error, setError] = useState<string | null>(null);

  const processImage = useCallback(async (file: File) => {
    setState("processing");
    setError(null);

    // Show preview
    const url = URL.createObjectURL(file);
    setPreview(url);

    const { data, error: apiError } = await apiExtractCIN(file);

    if (apiError || !data) {
      setState("error");
      setError(apiError || t("sttError"));
      return;
    }

    setFields(data.fields);
    setState("done");
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processImage(file);
    },
    [processImage]
  );

  const handleCapture = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleConfirm = useCallback(() => {
    if (fields) onExtracted(fields);
  }, [fields, onExtracted]);

  return (
    <div className="space-y-[var(--space-4)]">
      {/* Hidden file input with camera capture */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />

      {state === "idle" && (
        <div className="space-y-[var(--space-3)]">
          <p className="text-sm text-[var(--text-secondary)]">
            {t("scanCINDescription")}
          </p>
          <div className="flex gap-[var(--space-3)]">
            <Button
              variant="primary"
              size="lg"
              icon={<Camera size={20} />}
              className="flex-1"
              onClick={handleCapture}
            >
              {t("takePicture")}
            </Button>
            <Button
              variant="secondary"
              size="lg"
              icon={<Upload size={20} />}
              className="flex-1"
              onClick={() => {
                // Remove capture attribute for file picker
                if (fileInputRef.current) {
                  fileInputRef.current.removeAttribute("capture");
                  fileInputRef.current.click();
                  fileInputRef.current.setAttribute("capture", "environment");
                }
              }}
            >
              {t("uploadImage")}
            </Button>
          </div>
        </div>
      )}

      {/* Preview */}
      {preview && (
        <div className="rounded-[var(--radius-md)] overflow-hidden border border-[var(--border-default)]">
          <img src={preview} alt={t("cinPreviewAlt")} className="w-full h-auto max-h-64 object-contain bg-[var(--bg-secondary)]" />
        </div>
      )}

      {/* Processing */}
      {state === "processing" && (
        <div className="flex items-center justify-center gap-2 py-[var(--space-4)]">
          <Loader2 size={20} className="animate-spin text-[var(--primary)]" />
          <span className="text-sm text-[var(--text-secondary)]">{t("processingOCR")}</span>
        </div>
      )}

      {/* Error */}
      {state === "error" && (
        <Card className="border-[var(--critical)]">
          <div className="flex items-center gap-2 text-[var(--critical)]">
            <AlertTriangle size={18} />
            <span className="text-sm">{error}</span>
          </div>
          <Button variant="secondary" size="sm" className="mt-[var(--space-2)]" onClick={() => { setState("idle"); setPreview(null); }}>
            {t("retry")}
          </Button>
        </Card>
      )}

      {/* Results */}
      {state === "done" && fields && (
        <Card>
          <div className="flex items-center gap-2 mb-[var(--space-3)]">
            <Check size={18} className="text-[var(--success)]" />
            <span className="text-sm font-medium text-[var(--text-primary)]">
              {t("cinExtracted")}
            </span>
          </div>

          <dl className="grid grid-cols-2 gap-y-[var(--space-2)] gap-x-[var(--space-3)] text-sm">
            {fields.nin && (
              <>
                <dt className="text-[var(--text-tertiary)]">NIN</dt>
                <dd className="text-[var(--text-primary)] font-mono">{fields.nin}</dd>
              </>
            )}
            {fields.last_name && (
              <>
                <dt className="text-[var(--text-tertiary)]">{t("cinLastName")}</dt>
                <dd className="text-[var(--text-primary)]">{fields.last_name}</dd>
              </>
            )}
            {fields.first_name && (
              <>
                <dt className="text-[var(--text-tertiary)]">{t("cinFirstName")}</dt>
                <dd className="text-[var(--text-primary)]">{fields.first_name}</dd>
              </>
            )}
            {fields.date_of_birth && (
              <>
                <dt className="text-[var(--text-tertiary)]">{t("cinDateOfBirth")}</dt>
                <dd className="text-[var(--text-primary)]">{fields.date_of_birth}</dd>
              </>
            )}
            {fields.place_of_birth && (
              <>
                <dt className="text-[var(--text-tertiary)]">{t("cinPlaceOfBirth")}</dt>
                <dd className="text-[var(--text-primary)]">{fields.place_of_birth}</dd>
              </>
            )}
            {fields.address && (
              <>
                <dt className="text-[var(--text-tertiary)]">{t("cinAddress")}</dt>
                <dd className="text-[var(--text-primary)]">{fields.address}</dd>
              </>
            )}
          </dl>

          {fields.candidates && fields.candidates.length > 0 && !fields.last_name && (
            <div className="mt-[var(--space-3)]">
              <p className="text-xs text-[var(--text-tertiary)] mb-1">{t("cinDetectedText")}</p>
              {fields.candidates.map((c, i) => (
                <p key={i} className="text-sm text-[var(--text-secondary)]">{c}</p>
              ))}
            </div>
          )}

          <div className="flex gap-2 mt-[var(--space-4)]">
            <Button variant="primary" size="md" className="flex-1" onClick={handleConfirm}>
              {t("useData")}
            </Button>
            <Button variant="secondary" size="md" onClick={() => { setState("idle"); setPreview(null); setFields(null); }}>
              {t("retry")}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
