"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n";
import { useOffline } from "@/lib/offline-context";
import {
  apiGetEmergencyTypes, apiTriggerEmergency,
  type EmergencyType, type TriggerEmergencyPayload,
} from "@/lib/api";
import { addToOutbox } from "@/lib/offline-db";
import { Button, Input, PushToTalk } from "@/components/ds";
import {
  ChevronLeft, MapPin, Loader2, Camera, Send, CheckCircle2,
  Phone, X, AlertTriangle,
} from "lucide-react";

type Phase = "form" | "submitting" | "confirmed";

const ORG_HOTLINE = process.env.NEXT_PUBLIC_ORG_HOTLINE || "";

interface EmergencyJournalProps {
  open: boolean;
  onClose: () => void;
  initialLat?: number | null;
  initialLng?: number | null;
}

export default function EmergencyJournal({
  open, onClose, initialLat, initialLng,
}: EmergencyJournalProps) {
  const { t, locale } = useI18n();
  const { isOnline } = useOffline();

  const [phase, setPhase] = useState<Phase>("form");
  const [types, setTypes] = useState<EmergencyType[]>([]);
  const [selectedType, setSelectedType] = useState<string>("");
  const [summary, setSummary] = useState("");
  const [details, setDetails] = useState("");
  const [lat, setLat] = useState<number | null>(initialLat ?? null);
  const [lng, setLng] = useState<number | null>(initialLng ?? null);
  const [gpsStatus, setGpsStatus] = useState<"idle" | "acquiring" | "done" | "failed">("idle");
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [voiceNote, setVoiceNote] = useState("");
  const [savedOffline, setSavedOffline] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch emergency types
  useEffect(() => {
    if (!open) return;
    apiGetEmergencyTypes().then(({ data }) => {
      if (data) setTypes(data);
    });
  }, [open]);

  // Acquire GPS on open
  useEffect(() => {
    if (!open || lat !== null) return;
    if (!navigator.geolocation) {
      setGpsStatus("failed");
      return;
    }
    setGpsStatus("acquiring");
    const id = navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude);
        setLng(pos.coords.longitude);
        setGpsStatus("done");
      },
      () => setGpsStatus("failed"),
      { enableHighAccuracy: true, timeout: 8000 }
    );
    return () => {
      try { navigator.geolocation.clearWatch(id as unknown as number); } catch {}
    };
  }, [open, lat]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setPhase("form");
      setSelectedType("");
      setSummary("");
      setDetails("");
      setLat(initialLat ?? null);
      setLng(initialLng ?? null);
      setGpsStatus("idle");
      setPhoto(null);
      setPhotoPreview(null);
      setVoiceNote("");
      setSavedOffline(false);
    }
  }, [open, initialLat, initialLng]);

  const handlePhotoChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhoto(file);
    const reader = new FileReader();
    reader.onload = () => setPhotoPreview(reader.result as string);
    reader.readAsDataURL(file);
  }, []);

  const generateClientId = () => crypto.randomUUID();

  const handleSubmit = async () => {
    if (!selectedType) return;
    setPhase("submitting");

    const clientId = generateClientId();
    const payload: TriggerEmergencyPayload = {
      client_id: clientId,
      emergency_type: selectedType,
      summary: summary.trim() || undefined,
      details: [details.trim(), voiceNote.trim()].filter(Boolean).join("\n\n") || undefined,
      lat,
      lng,
    };

    if (isOnline) {
      const { error } = await apiTriggerEmergency(payload);
      if (error) {
        // Fallback to offline queue
        await saveToOutbox(clientId, payload);
        setSavedOffline(true);
      }
    } else {
      await saveToOutbox(clientId, payload);
      setSavedOffline(true);
    }

    setPhase("confirmed");
  };

  const saveToOutbox = async (clientId: string, payload: TriggerEmergencyPayload) => {
    await addToOutbox({
      url: "/api/v1/emergencies/trigger/",
      method: "POST",
      body: JSON.stringify(payload),
      clientId,
    });
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[var(--z-modal)] bg-[var(--surface-raised)] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 flex items-center gap-3 px-[var(--space-4)] py-[var(--space-3)] border-b border-[var(--border-default)] bg-[var(--critical)]">
        {phase === "form" && (
          <button
            type="button"
            onClick={onClose}
            aria-label={t("back")}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/20 text-[var(--on-critical)] cursor-pointer min-w-[var(--touch-target-min)] min-h-[var(--touch-target-min)]"
          >
            <ChevronLeft size={20} className="rtl:rotate-180" />
          </button>
        )}
        <div className="flex items-center gap-2 flex-1">
          <AlertTriangle size={20} className="text-[var(--on-critical)]" />
          <h1 className="text-lg font-bold text-[var(--on-critical)]">{t("emergency")}</h1>
        </div>
        {phase !== "confirmed" && (
          <button
            type="button"
            onClick={onClose}
            aria-label={t("close")}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/20 text-[var(--on-critical)] cursor-pointer min-w-[var(--touch-target-min)] min-h-[var(--touch-target-min)]"
          >
            <X size={20} />
          </button>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-[var(--space-4)] space-y-[var(--space-5)]">
        {phase === "form" && (
          <>
            {/* GPS status */}
            <div className="flex items-center gap-2 text-sm">
              <MapPin size={16} className={cn(
                gpsStatus === "done" ? "text-[var(--success)]" :
                gpsStatus === "failed" ? "text-[var(--critical)]" :
                "text-[var(--text-tertiary)]"
              )} />
              <span className="text-[var(--text-secondary)]">
                {gpsStatus === "acquiring" && t("emergencyGpsAcquiring")}
                {gpsStatus === "done" && `${lat?.toFixed(4)}, ${lng?.toFixed(4)}`}
                {gpsStatus === "failed" && t("emergencyGpsFailed")}
                {gpsStatus === "idle" && t("emergencyGpsAcquiring")}
              </span>
              {gpsStatus === "acquiring" && <Loader2 size={14} className="animate-spin text-[var(--text-tertiary)]" />}
            </div>

            {/* Emergency type selection */}
            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-[var(--space-2)]">
                {t("emergencyType")} *
              </label>
              <div className="grid grid-cols-1 gap-2">
                {types.length === 0 ? (
                  <div className="flex items-center gap-2 p-3 text-sm text-[var(--text-tertiary)]">
                    <Loader2 size={14} className="animate-spin" />
                    {t("loading")}
                  </div>
                ) : types.map((type) => (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => setSelectedType(type.key)}
                    className={cn(
                      "w-full text-start p-[var(--space-3)] rounded-[var(--radius-md)] border-2 transition-colors cursor-pointer min-h-[var(--touch-target-min)]",
                      selectedType === type.key
                        ? "border-[var(--critical)] bg-[color-mix(in_srgb,var(--critical)_8%,transparent)]"
                        : "border-[var(--border-default)] hover:border-[var(--border-strong)]"
                    )}
                  >
                    <span className="font-medium text-[var(--text-primary)]">
                      {locale === "ar" || locale === "tn" ? type.label_ar : type.label_fr}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Summary */}
            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-[var(--space-2)]">
                {t("emergencySummary")}
              </label>
              <Input
                placeholder={t("emergencyDetails")}
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
              />
            </div>

            {/* Details */}
            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-[var(--space-2)]">
                {t("emergencyDetails")}
              </label>
              <textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder={t("emergencyDetails")}
                rows={3}
                className="w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-primary)] text-[var(--text-primary)] p-[var(--space-3)] text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
              />
            </div>

            {/* Photo */}
            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-[var(--space-2)]">
                {t("emergencyPhoto")}
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handlePhotoChange}
                className="hidden"
              />
              {photoPreview ? (
                <div className="relative w-32 h-32 rounded-[var(--radius-md)] overflow-hidden border border-[var(--border-default)]">
                  <img src={photoPreview} alt="" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => { setPhoto(null); setPhotoPreview(null); }}
                    className="absolute top-1 end-1 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center text-white cursor-pointer"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<Camera size={16} />}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {t("emergencyPhoto")}
                </Button>
              )}
            </div>

            {/* Voice memo */}
            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-[var(--space-2)]">
                {t("emergencyVoiceMemo")}
              </label>
              <PushToTalk onTranscript={(text) => setVoiceNote((prev) => prev ? `${prev} ${text}` : text)} />
              {voiceNote && (
                <div className="mt-2 p-[var(--space-3)] rounded-[var(--radius-md)] bg-[var(--bg-secondary)] text-sm text-[var(--text-primary)]">
                  {voiceNote}
                </div>
              )}
            </div>
          </>
        )}

        {phase === "submitting" && (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <Loader2 size={40} className="animate-spin text-[var(--critical)]" />
            <p className="text-[var(--text-secondary)]">{t("loading")}</p>
          </div>
        )}

        {phase === "confirmed" && (
          <div className="flex flex-col items-center justify-center py-8 gap-6 text-center">
            <div className="w-20 h-20 rounded-full bg-[var(--success)] flex items-center justify-center">
              <CheckCircle2 size={40} className="text-[var(--on-success,#fff)]" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">
                {t("emergencyConfirmed")}
              </h2>
              <p className="text-sm text-[var(--text-secondary)] max-w-xs mx-auto">
                {savedOffline ? t("emergencySavedOffline") : t("emergencyConfirmedDesc")}
              </p>
            </div>

            {/* Call buttons */}
            <div className="flex flex-col gap-3 w-full max-w-xs">
              <a
                href="tel:112"
                className="flex items-center justify-center gap-2 w-full h-14 rounded-[var(--radius-md)] bg-[var(--critical)] text-[var(--on-critical)] font-semibold text-base min-h-[var(--touch-target-min)]"
              >
                <Phone size={20} />
                {t("emergencyCall112")}
              </a>
              {ORG_HOTLINE && (
                <a
                  href={`tel:${ORG_HOTLINE}`}
                  className="flex items-center justify-center gap-2 w-full h-14 rounded-[var(--radius-md)] bg-[var(--primary)] text-[var(--on-primary)] font-semibold text-base min-h-[var(--touch-target-min)]"
                >
                  <Phone size={20} />
                  {t("emergencyCallOrg")}
                </a>
              )}
            </div>

            <Button variant="ghost" size="md" onClick={onClose} className="mt-4">
              {t("close")}
            </Button>
          </div>
        )}
      </div>

      {/* Footer — submit button */}
      {phase === "form" && (
        <div className="shrink-0 p-[var(--space-4)] border-t border-[var(--border-default)] bg-[var(--surface-raised)]">
          <Button
            variant="critical"
            size="lg"
            icon={<Send size={20} />}
            className="w-full"
            disabled={!selectedType}
            onClick={handleSubmit}
          >
            {t("emergencySubmit")}
          </Button>
        </div>
      )}
    </div>
  );
}
