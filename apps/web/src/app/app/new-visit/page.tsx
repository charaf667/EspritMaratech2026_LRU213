"use client";

import { useState, useMemo, useCallback, useRef, useEffect, type ChangeEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useI18n } from "@/i18n";
import type { TranslationKey } from "@/i18n";
import { useAuth } from "@/lib/auth-context";
import { useA11y } from "@/lib/accessibility-context";
import InterviewWizard from "@/components/ds/InterviewWizard";
import InterviewFamilyStep from "@/components/ds/InterviewFamilyStep";
import InterviewReviewStep from "@/components/ds/InterviewReviewStep";
import {
  MOCK_FAMILIES, MOCK_AIDS, MOCK_VISITS,
  ALLOWED_ATTACHMENT_TYPES, MAX_ATTACHMENTS, MAX_ATTACHMENT_SIZE,
  type Family, type AidItem, type VisitAid, type Attachment,
} from "@/lib/mock-data";
import {
  USE_API, apiGetFamilies, apiFamilyToFamily, apiGetAidTypes, apiAidToAidItem,
  apiCreateVisit, type CreateVisitPayload,
  apiCreateFamily, type CreateFamilyPayload,
} from "@/lib/api";
import { useOffline } from "@/lib/offline-context";
import { addToOutbox, getCachedFamilies, getCachedAidTypes } from "@/lib/offline-db";
import {
  Stepper, Button, Badge, Input, Chip, AttachmentChip, PushToTalk, Card, Modal,
  EmergencyFAB, EmergencyTriggerSheet, EmergencyJournal, AttestationCard, QRScannerConfirm,
} from "@/components/ds";
import {
  ChevronLeft, ChevronRight, Check, Minus, Plus,
  Paperclip, AlertTriangle, QrCode, UserPlus, MapPin, Loader2,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

export default function NewVisitPage() {
  const { t, locale } = useI18n();
  const { user } = useAuth();
  const { interviewMode, oneHand } = useA11y();
  const scrollRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isOnline } = useOffline();
  const preselectedFamilyId = searchParams.get("familyId");

  const [step, setStep] = useState(0);
  const [emergencySheetOpen, setEmergencySheetOpen] = useState(false);
  const [emergencyJournalOpen, setEmergencyJournalOpen] = useState(false);
  const steps = [t("wizardStep1"), t("wizardStep2"), t("wizardStep3")];

  // Step 1: Family selection
  const [selectedFamilyId, setSelectedFamilyId] = useState<string | null>(preselectedFamilyId);
  const [familySearch, setFamilySearch] = useState("");

  // Step 2: Aids + notes + STT + attachments
  const [selectedAids, setSelectedAids] = useState<Map<string, number>>(new Map());
  const [notes, setNotes] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [complaintOpen, setComplaintOpen] = useState(false);
  const [complaintText, setComplaintText] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step 3: Validation + QR
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [feelingCode, setFeelingCode] = useState<string | null>(null);
  const [omniaRef, setOmniaRef] = useState<string | null>(null);
  const [createdVisitId, setCreatedVisitId] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Data from API or mock
  const [families, setFamilies] = useState<Family[]>([]);
  const [aids, setAids] = useState<AidItem[]>([]);

  // Load families + aids (from API or cache when offline)
  useEffect(() => {
    if (!USE_API) {
      setFamilies(MOCK_FAMILIES);
      setAids(MOCK_AIDS);
      return;
    }

    if (!isOnline) {
      // Offline: load from IndexedDB cache
      getCachedFamilies().then((cached) => {
        if (cached.length > 0) setFamilies((cached as any[]).map(apiFamilyToFamily));
      });
      getCachedAidTypes().then((cached) => {
        if (cached.length > 0) setAids((cached as any[]).map(apiAidToAidItem));
      });
      return;
    }

    apiGetFamilies().then(({ data }) => {
      if (data?.results) setFamilies(data.results.map(apiFamilyToFamily));
    });
    apiGetAidTypes().then(({ data }) => {
      if (data) setAids(data.map(apiAidToAidItem));
    });
  }, [isOnline]);

  const selectedFamily = families.find((f) => f.id === selectedFamilyId);

  const filteredFamilies = useMemo(() => {
    if (!familySearch.trim()) return families;
    const q = familySearch.toLowerCase();
    return families.filter(
      (f) => f.name.toLowerCase().includes(q) || f.id.toLowerCase().includes(q) || f.address.toLowerCase().includes(q)
    );
  }, [familySearch, families]);

  // Aid toggle
  const toggleAid = useCallback((aidId: string) => {
    setSelectedAids((prev) => {
      const next = new Map(prev);
      if (next.has(aidId)) next.delete(aidId);
      else next.set(aidId, 1);
      return next;
    });
  }, []);

  const setAidQty = useCallback((aidId: string, qty: number, maxQty: number) => {
    setSelectedAids((prev) => {
      const next = new Map(prev);
      const clamped = Math.max(1, Math.min(qty, maxQty));
      next.set(aidId, clamped);
      return next;
    });
  }, []);

  // Attachment handling
  const handleAddAttachment = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    for (const file of Array.from(files)) {
      if (attachments.length >= MAX_ATTACHMENTS) break;
      if (!ALLOWED_ATTACHMENT_TYPES.includes(file.type)) continue;
      if (file.size > MAX_ATTACHMENT_SIZE) continue;

      setAttachments((prev) => [
        ...prev,
        { id: `att-${Date.now()}-${Math.random()}`, filename: file.name, type: file.type, size: file.size },
      ]);
    }
    e.target.value = "";
  }, [attachments.length]);

  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }, []);

  // STT callback
  const handleTranscript = useCallback((text: string) => {
    setNotes((prev) => (prev ? prev + "\n" + text : text));
  }, []);

  // Navigation
  const canGoNext = step === 0
    ? !!selectedFamilyId
    : step === 1
    ? selectedAids.size > 0
    : true;

  const handleNext = () => {
    if (step < 2) {
      setStep(step + 1);
      scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleBack = () => {
    if (step > 0) {
      setStep(step - 1);
      scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleSubmit = async () => {
    if (!selectedFamilyId) return;
    setSubmitError(null);

    if (!USE_API) {
      const token = `tk_${Date.now().toString(36)}`;
      setGeneratedToken(token);
      setFeelingCode("DEMO01");
      setOmniaRef("OMNIA-DEMO01");
      setSubmitted(true);
      return;
    }

    setSubmitting(true);
    const payload: CreateVisitPayload = {
      family_id: selectedFamilyId,
      notes: notes || "",
      aids: Array.from(selectedAids.entries()).map(([aidId, qty]) => ({
        aid_type_key: aidId,
        qty,
      })),
      complaint_text: complaintText.trim() || "",
    };

    if (!isOnline) {
      // Offline: save to outbox
      await addToOutbox({
        url: "/api/visits/",
        method: "POST",
        body: JSON.stringify(payload),
        clientId: crypto.randomUUID(),
      });
      setSubmitting(false);
      setSubmitted(true);
      return;
    }

    try {
      const { data, error } = await apiCreateVisit(payload);
      setSubmitting(false);

      if (data) {
        setGeneratedToken(data.feeling_token ?? null);
        setFeelingCode(data.feeling_code ?? null);
        setOmniaRef(data.omnia_ref ?? null);
        setCreatedVisitId(data.id ?? null);
        setSubmitted(true);
      } else {
        console.error("Visit creation failed:", error);
        setSubmitError(error || t("visitSubmitError"));
      }
    } catch (e) {
      setSubmitting(false);
      console.error("Visit creation exception:", e);
      setSubmitError(t("visitSubmitError"));
    }
  };

  return (
    <div ref={scrollRef} className="flex flex-col flex-1 overflow-y-auto bg-[var(--bg-secondary)] scroll-smooth">
      {/* Stepper */}
      <div className="sticky top-0 z-10 bg-[var(--surface-raised)] border-b border-[var(--border-default)] py-[var(--space-4)] px-[var(--space-4)]">
        <Stepper steps={steps} currentStep={step} />
      </div>

      {/* Step content */}
      <div key={step} className="flex-1 p-[var(--space-4)] max-w-2xl mx-auto w-full step-animate">
        {step === 0 && interviewMode ? (
          <InterviewFamilyStep
            families={filteredFamilies}
            selectedId={selectedFamilyId}
            onSelect={setSelectedFamilyId}
            onNext={() => setStep(1)}
          />
        ) : step === 0 && (
          <StepFamily
            families={filteredFamilies}
            selectedId={selectedFamilyId}
            onSelect={setSelectedFamilyId}
            search={familySearch}
            onSearchChange={setFamilySearch}
            t={t}
            onFamilyCreated={(f) => {
              setFamilies((prev) => [f, ...prev]);
              setSelectedFamilyId(f.id);
            }}
          />
        )}

        {step === 1 && interviewMode ? (
          <InterviewWizard
            aids={aids}
            selectedAids={selectedAids}
            toggleAid={toggleAid}
            setAidQty={setAidQty}
            notes={notes}
            setNotes={setNotes}
            onTranscript={handleTranscript}
            attachments={attachments}
            onAddAttachment={handleAddAttachment}
            onRemoveAttachment={removeAttachment}
            complaintText={complaintText}
            setComplaintText={setComplaintText}
            onDone={() => setStep(2)}
          />
        ) : step === 1 && (
          <StepBenefits
            aids={aids}
            selectedAids={selectedAids}
            toggleAid={toggleAid}
            setAidQty={setAidQty}
            notes={notes}
            setNotes={setNotes}
            onTranscript={handleTranscript}
            attachments={attachments}
            onAddAttachment={handleAddAttachment}
            onRemoveAttachment={removeAttachment}
            fileInputRef={fileInputRef}
            complaintOpen={complaintOpen}
            setComplaintOpen={setComplaintOpen}
            complaintText={complaintText}
            setComplaintText={setComplaintText}
            locale={locale}
            t={t}
          />
        )}

        {step === 2 && interviewMode ? (
          <InterviewReviewStep
            family={selectedFamily!}
            aids={aids}
            selectedAids={selectedAids}
            notes={notes}
            attachments={attachments}
            submitted={submitted}
            generatedToken={generatedToken}
            feelingCode={feelingCode}
            omniaRef={omniaRef}
            submitting={submitting}
            submitError={submitError}
            onSubmit={handleSubmit}
          />
        ) : step === 2 && (
          <StepValidation
            family={selectedFamily!}
            aids={aids}
            selectedAids={selectedAids}
            notes={notes}
            attachments={attachments}
            submitted={submitted}
            generatedToken={generatedToken}
            feelingCode={feelingCode}
            omniaRef={omniaRef}
            visitId={createdVisitId}
            submitError={submitError}
            t={t}
          />
        )}
      </div>

      {/* Bottom spacer for one-hand mode */}
      {oneHand && <div className="a11y-bottom-spacer" />}

      {/* Bottom actions */}
      <div className="a11y-bottom-actions sticky bottom-0 bg-[var(--surface-raised)] border-t border-[var(--border-default)] p-[var(--space-4)]">
        <div className="max-w-2xl mx-auto flex gap-[var(--space-3)]">
          {step > 0 && !submitted && (
            <Button variant="secondary" size="md" icon={<ChevronLeft size={18} />} onClick={handleBack}>
              {t("back")}
            </Button>
          )}
          <div className="flex-1" />
          {!submitted ? (
            step < 2 ? (
              <Button
                variant="primary"
                size="md"
                disabled={!canGoNext}
                onClick={handleNext}
                icon={<ChevronRight size={18} />}
              >
                {t("next")}
              </Button>
            ) : (
              <Button
                variant="primary"
                size="md"
                disabled={!canGoNext || submitting}
                onClick={handleSubmit}
                icon={<Check size={18} />}
              >
                {submitting ? "..." : t("submitVisit")}
              </Button>
            )
          ) : (
            <Button variant="primary" size="md" onClick={() => router.push("/app")}>
              {t("back")} — {t("tabAgentHome")}
            </Button>
          )}
        </div>
      </div>
      {/* Emergency UX */}
      {!emergencySheetOpen && !emergencyJournalOpen && (
        <EmergencyFAB onClick={() => setEmergencySheetOpen(true)} />
      )}
      <EmergencyTriggerSheet
        open={emergencySheetOpen}
        onClose={() => setEmergencySheetOpen(false)}
        onConfirm={() => {
          setEmergencySheetOpen(false);
          setEmergencyJournalOpen(true);
        }}
      />
      <EmergencyJournal
        open={emergencyJournalOpen}
        onClose={() => setEmergencyJournalOpen(false)}
      />
    </div>
  );
}

// ─── Step 1: Family Selection ───────────────────────────────

function StepFamily({
  families,
  selectedId,
  onSelect,
  search,
  onSearchChange,
  t,
  onFamilyCreated,
}: {
  families: Family[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  search: string;
  onSearchChange: (v: string) => void;
  t: (key: TranslationKey) => string;
  onFamilyCreated?: (family: Family) => void;
}) {
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState("");
  const [headName, setHeadName] = useState("");
  const [householdSize, setHouseholdSize] = useState("1");
  const [formPhone, setFormPhone] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formZone, setFormZone] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");

  const handleGeolocate = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(6));
        setLng(pos.coords.longitude.toFixed(6));
      },
      () => { /* ignore errors */ },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const handleCreateFamily = async () => {
    if (!headName.trim()) return;
    setCreating(true);
    setFormError("");

    const payload: CreateFamilyPayload = {
      head_name: headName.trim(),
      household_size: Math.max(1, parseInt(householdSize) || 1),
      phone: formPhone.trim() || undefined,
      address_text: formAddress.trim() || undefined,
      zone_label: formZone.trim() || undefined,
      lat: parseFloat(lat) || 36.8,
      lng: parseFloat(lng) || 10.18,
    };

    if (USE_API) {
      const { data, error } = await apiCreateFamily(payload);
      if (data) {
        const newFamily = apiFamilyToFamily(data);
        onFamilyCreated?.(newFamily);
        setShowCreate(false);
        resetForm();
      } else {
        setFormError(t("familyCreateError"));
      }
    } else {
      // Mock mode: create a fake family
      const mockFamily: Family = {
        id: `FAM-${Date.now()}`,
        name: payload.head_name,
        address: payload.address_text ?? "",
        phone: payload.phone ?? "",
        priority: "normal",
        lat: payload.lat,
        lng: payload.lng,
        membersCount: payload.household_size,
        lastVisit: "",
        zone: payload.zone_label ?? "",
      };
      onFamilyCreated?.(mockFamily);
      setShowCreate(false);
      resetForm();
    }
    setCreating(false);
  };

  const resetForm = () => {
    setHeadName("");
    setHouseholdSize("1");
    setFormPhone("");
    setFormAddress("");
    setFormZone("");
    setLat("");
    setLng("");
    setFormError("");
  };

  return (
    <div className="space-y-[var(--space-4)]">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-[var(--text-primary)]">{t("selectFamily")}</h2>
        <Button
          variant="primary"
          size="sm"
          icon={<UserPlus size={16} />}
          onClick={() => setShowCreate(true)}
        >
          {t("addFamily")}
        </Button>
      </div>
      <Input
        placeholder={t("searchFamily")}
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        icon={<span className="text-[var(--text-tertiary)]">🔍</span>}
      />
      <div className="space-y-2">
        {families.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => onSelect(f.id)}
            className={`w-full text-start p-[var(--space-3)] rounded-[var(--radius-lg)] border cursor-pointer transition-colors min-h-[var(--touch-target-min)] ${
              selectedId === f.id
                ? "border-[var(--primary)] bg-[color-mix(in_srgb,var(--primary)_8%,transparent)]"
                : "border-[var(--border-subtle)] bg-[var(--surface-raised)] hover:bg-[var(--bg-secondary)]"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-medium text-[var(--text-primary)]">{t("family")} {f.name}</span>
              <Badge variant={f.priority === "overdue" ? "critical" : f.priority === "urgent" ? "warning" : "neutral"}>
                {t(f.priority)}
              </Badge>
            </div>
            <p className="text-xs text-[var(--text-tertiary)] mt-0.5">{f.id} — {f.address}</p>
          </button>
        ))}
      </div>

      {/* Create Family Modal */}
      <Modal open={showCreate} onClose={() => { setShowCreate(false); resetForm(); }} title={t("addFamily")}>
        <div className="space-y-[var(--space-3)]">
          <div>
            <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">{t("headName")} *</label>
            <Input value={headName} onChange={(e) => setHeadName(e.target.value)} placeholder={t("headName")} />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">{t("householdSize")}</label>
            <Input type="number" value={householdSize} onChange={(e) => setHouseholdSize(e.target.value)} min="1" />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">{t("phone")}</label>
            <Input value={formPhone} onChange={(e) => setFormPhone(e.target.value)} placeholder={t("phone")} />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">{t("addressText")}</label>
            <Input value={formAddress} onChange={(e) => setFormAddress(e.target.value)} placeholder={t("addressText")} />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">{t("zoneLabel")}</label>
            <Input value={formZone} onChange={(e) => setFormZone(e.target.value)} placeholder={t("zoneLabel")} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">{t("latitude")}</label>
              <Input type="number" step="any" value={lat} onChange={(e) => setLat(e.target.value)} placeholder="36.8" />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">{t("longitude")}</label>
              <Input type="number" step="any" value={lng} onChange={(e) => setLng(e.target.value)} placeholder="10.18" />
            </div>
          </div>
          <Button variant="secondary" size="sm" icon={<MapPin size={16} />} onClick={handleGeolocate} className="w-full">
            {t("useMyLocation")}
          </Button>

          {formError && <p className="text-sm text-[var(--critical)]">{formError}</p>}

          <Button
            variant="primary"
            size="md"
            className="w-full"
            disabled={!headName.trim() || creating}
            icon={creating ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
            onClick={handleCreateFamily}
          >
            {creating ? t("loading") : t("createFamily")}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

// ─── Step 2: Benefits ───────────────────────────────────────

function StepBenefits({
  aids, selectedAids, toggleAid, setAidQty,
  notes, setNotes, onTranscript,
  attachments, onAddAttachment, onRemoveAttachment, fileInputRef,
  complaintOpen, setComplaintOpen, complaintText, setComplaintText,
  locale, t,
}: {
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
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  complaintOpen: boolean;
  setComplaintOpen: (v: boolean) => void;
  complaintText: string;
  setComplaintText: (v: string) => void;
  locale: string;
  t: (key: TranslationKey) => string;
}) {
  return (
    <div className="space-y-[var(--space-6)]">
      {/* Aids selection */}
      <section>
        <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-[var(--space-3)]">{t("aidsSelection")}</h2>
        <div className="space-y-2">
          {aids.map((aid) => {
            const isSelected = selectedAids.has(aid.id);
            const qty = selectedAids.get(aid.id) ?? 0;
            return (
              <div
                key={aid.id}
                className={`flex items-center gap-[var(--space-3)] p-[var(--space-3)] rounded-[var(--radius-md)] border transition-colors ${
                  isSelected ? "border-[var(--primary)] bg-[color-mix(in_srgb,var(--primary)_5%,transparent)]" : "border-[var(--border-subtle)] bg-[var(--surface-raised)]"
                }`}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleAid(aid.id)}
                  className="w-5 h-5 shrink-0 accent-[var(--primary)] cursor-pointer"
                  aria-label={locale === "ar" ? aid.labelAr : aid.label}
                />
                <span className="flex-1 text-sm font-medium text-[var(--text-primary)]">
                  {locale === "ar" ? aid.labelAr : aid.label}
                </span>
                {isSelected && (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setAidQty(aid.id, qty - 1, aid.maxQty)}
                      disabled={qty <= 1}
                      className="w-8 h-8 flex items-center justify-center rounded-full bg-[var(--bg-tertiary)] text-[var(--text-primary)] disabled:opacity-40 cursor-pointer min-w-[var(--touch-target-min)] min-h-[var(--touch-target-min)]"
                      aria-label="Decrease"
                    >
                      <Minus size={14} />
                    </button>
                    <span className="w-8 text-center text-sm font-semibold text-[var(--text-primary)]">{qty}</span>
                    <button
                      type="button"
                      onClick={() => setAidQty(aid.id, qty + 1, aid.maxQty)}
                      disabled={qty >= aid.maxQty}
                      className="w-8 h-8 flex items-center justify-center rounded-full bg-[var(--bg-tertiary)] text-[var(--text-primary)] disabled:opacity-40 cursor-pointer min-w-[var(--touch-target-min)] min-h-[var(--touch-target-min)]"
                      aria-label="Increase"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {selectedAids.size === 0 && (
          <p className="text-sm text-[var(--warning)] mt-2 flex items-center gap-1">
            <AlertTriangle size={14} /> {t("noAidsSelected")}
          </p>
        )}
      </section>

      {/* Notes textarea */}
      <section>
        <h3 className="text-base font-medium text-[var(--text-primary)] mb-[var(--space-2)]">{t("notes")}</h3>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={t("notesPlaceholder")}
          rows={3}
          className="w-full p-[var(--space-3)] rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-primary)] text-[var(--text-primary)] text-sm resize-y focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
        />
      </section>

      {/* Push-to-talk STT */}
      <section>
        <h3 className="text-base font-medium text-[var(--text-primary)] mb-[var(--space-2)]">{t("sttTitle")}</h3>
        <PushToTalk onTranscript={onTranscript} />
      </section>

      {/* Attachments */}
      <section>
        <div className="flex items-center justify-between mb-[var(--space-2)]">
          <h3 className="text-base font-medium text-[var(--text-primary)]">{t("attachments")}</h3>
          <span className="text-xs text-[var(--text-tertiary)]">{attachments.length}/{MAX_ATTACHMENTS}</span>
        </div>

        <div className="flex flex-wrap gap-2 mb-[var(--space-2)]">
          {attachments.map((att) => (
            <AttachmentChip key={att.id} filename={att.filename} onRemove={() => onRemoveAttachment(att.id)} />
          ))}
        </div>

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
              size="sm"
              icon={<Paperclip size={16} />}
              onClick={() => fileInputRef.current?.click()}
            >
              {t("addAttachment")}
            </Button>
          </>
        )}
      </section>

      {/* Report problem (collapsible) */}
      <section className="border border-[var(--border-default)] rounded-[var(--radius-lg)] overflow-hidden">
        <button
          type="button"
          onClick={() => setComplaintOpen(!complaintOpen)}
          className="w-full flex items-center justify-between p-[var(--space-3)] bg-[var(--surface-raised)] hover:bg-[var(--bg-secondary)] cursor-pointer min-h-[var(--touch-target-min)]"
        >
          <span className="flex items-center gap-2 text-sm font-medium text-[var(--warning)]">
            <AlertTriangle size={16} />
            {t("reportProblem")}
          </span>
          <ChevronRight size={16} className={`text-[var(--text-tertiary)] transition-transform ${complaintOpen ? "rotate-90" : ""}`} />
        </button>
        {complaintOpen && (
          <div className="p-[var(--space-3)] border-t border-[var(--border-subtle)]">
            <textarea
              value={complaintText}
              onChange={(e) => setComplaintText(e.target.value)}
              placeholder={t("complaintDescription")}
              rows={2}
              className="w-full p-[var(--space-3)] rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-primary)] text-[var(--text-primary)] text-sm resize-y focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)] mb-2"
            />
            {complaintText.trim() && (
              <p className="text-xs text-[var(--text-tertiary)] italic">
                {t("complaintSentWithVisit")}
              </p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

// ─── Step 3: Validation ─────────────────────────────────────

function StepValidation({
  family, aids, selectedAids, notes, attachments, submitted, generatedToken, feelingCode, omniaRef, visitId, submitError, t,
}: {
  family: Family;
  aids: AidItem[];
  selectedAids: Map<string, number>;
  notes: string;
  attachments: Attachment[];
  submitted: boolean;
  generatedToken: string | null;
  feelingCode: string | null;
  omniaRef: string | null;
  visitId: string | null;
  submitError: string | null;
  t: (key: TranslationKey) => string;
}) {
  const aidsList = Array.from(selectedAids.entries()).map(([aidId, qty]) => {
    const aid = aids.find((a) => a.id === aidId);
    return { label: aid?.label ?? aidId, qty };
  });

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const feelingUrl = feelingCode
    ? `${origin}/feeling?code=${feelingCode}`
    : null;

  return (
    <div className="space-y-[var(--space-6)]">
      {submitted && (
        <div className={`flex items-center gap-3 p-[var(--space-4)] rounded-[var(--radius-lg)] border ${
          generatedToken
            ? "bg-[color-mix(in_srgb,var(--success)_10%,transparent)] border-[var(--success)]"
            : "bg-[color-mix(in_srgb,var(--warning)_10%,transparent)] border-[var(--warning)]"
        }`}>
          <Check size={24} className={generatedToken ? "text-[var(--success)] shrink-0" : "text-[var(--warning)] shrink-0"} />
          <p className={`text-sm font-medium ${generatedToken ? "text-[var(--success)]" : "text-[var(--warning)]"}`}>
            {generatedToken ? t("visitSuccess") : t("visitSavedLocally")}
          </p>
        </div>
      )}

      {submitError && (
        <div className="flex items-center gap-3 p-[var(--space-4)] rounded-[var(--radius-lg)] border border-[var(--critical)] bg-[color-mix(in_srgb,var(--critical)_8%,transparent)]">
          <AlertTriangle size={24} className="text-[var(--critical)] shrink-0" />
          <p className="text-sm font-medium text-[var(--critical)]">{submitError}</p>
        </div>
      )}

      <h2 className="text-xl font-semibold text-[var(--text-primary)]">{t("visitSummary")}</h2>

      {/* Family */}
      <Card>
        <h3 className="text-base font-medium text-[var(--text-primary)] mb-2">{t("family")}</h3>
        <p className="text-sm font-semibold text-[var(--text-primary)]">{family.name}</p>
        <p className="text-sm text-[var(--text-secondary)]">{family.address}</p>
        {family.membersCount && (
          <p className="text-xs text-[var(--text-tertiary)] mt-1">{family.membersCount} {t("members")}</p>
        )}
      </Card>

      {/* Aids */}
      <Card>
        <h3 className="text-base font-medium text-[var(--text-primary)] mb-2">{t("aids")}</h3>
        <ul className="space-y-1">
          {aidsList.map((a) => (
            <li key={a.label} className="flex justify-between text-sm">
              <span className="text-[var(--text-primary)]">{a.label}</span>
              <span className="text-[var(--text-secondary)]">×{a.qty}</span>
            </li>
          ))}
        </ul>
      </Card>

      {/* Notes */}
      {notes && (
        <Card>
          <h3 className="text-base font-medium text-[var(--text-primary)] mb-2">{t("notes")}</h3>
          <p className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap">{notes}</p>
        </Card>
      )}

      {/* Attachments */}
      {attachments.length > 0 && (
        <Card>
          <h3 className="text-base font-medium text-[var(--text-primary)] mb-2">{t("attachments")}</h3>
          <div className="flex flex-wrap gap-2">
            {attachments.map((att) => (
              <AttachmentChip key={att.id} filename={att.filename} />
            ))}
          </div>
        </Card>
      )}

      {/* OMNIA Reference */}
      {submitted && omniaRef && (
        <Card className="flex flex-col items-center gap-[var(--space-3)]">
          <p className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider">{t("receipt")}</p>
          <p className="text-2xl font-bold font-mono text-[var(--primary)] tracking-widest">{omniaRef}</p>
        </Card>
      )}

      {/* QR Code */}
      {submitted && feelingUrl && (
        <Card className="flex flex-col items-center gap-[var(--space-4)]">
          <h3 className="text-base font-medium text-[var(--text-primary)]">{t("generateQR")}</h3>
          <QRCodeSVG value={feelingUrl} size={200} level="M" />
          <p className="text-xs text-[var(--text-tertiary)] text-center">{feelingUrl}</p>
          {feelingCode && (
            <p className="text-lg font-mono font-semibold bg-[var(--bg-secondary)] px-4 py-2 rounded-[var(--radius-md)] tracking-widest">
              {feelingCode}
            </p>
          )}
        </Card>
      )}

      {/* QR Scan Confirmation */}
      {submitted && feelingCode && (
        <QRScannerConfirm
          expectedCode={feelingCode}
          onConfirmed={() => {}}
        />
      )}

      {/* Attestation — shown after visit is submitted */}
      {submitted && (
        <AttestationCard visitId={visitId} />
      )}
    </div>
  );
}
