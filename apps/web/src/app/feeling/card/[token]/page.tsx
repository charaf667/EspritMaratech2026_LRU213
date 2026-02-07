"use client";

import { useState, useMemo, useEffect } from "react";
import { useParams } from "next/navigation";
import { useI18n } from "@/i18n";
import { MOCK_VISITS, MOCK_FAMILIES, MOCK_AIDS, type Visit } from "@/lib/mock-data";
import { USE_API, apiGetFeelingCard } from "@/lib/api";
import { Card, Badge, Button } from "@/components/ds";
import { Phone, Calendar, Package, ArrowRight } from "lucide-react";

interface CardData {
  familyName: string;
  familyId: string;
  phone: string | null;
  visitDate: string | null;
  aids: { label: string; quantity: number }[];
  nextAction: string;
  codeShort: string;
}

export default function FeelingCardPage() {
  const { t, locale } = useI18n();
  const params = useParams();
  const token = params.token as string;

  const [cardData, setCardData] = useState<CardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!USE_API) {
      // Mock mode
      const visit = MOCK_VISITS.find((v) => v.feelingToken === token);
      const family = visit ? MOCK_FAMILIES.find((f) => f.id === visit.familyId) : undefined;
      if (visit && family) {
        setCardData({
          familyName: family.name,
          familyId: family.id,
          phone: family.phone,
          visitDate: visit.date,
          aids: visit.aids.map((va) => {
            const aid = MOCK_AIDS.find((a) => a.id === va.aidId);
            return {
              label: locale === "ar" ? (aid?.labelAr ?? va.aidId) : (aid?.label ?? va.aidId),
              quantity: va.quantity,
            };
          }),
          nextAction: "Suivi prevu sous 30 jours",
          codeShort: token,
        });
      }
      setLoading(false);
      return;
    }

    apiGetFeelingCard(token).then(({ data, error: apiError }) => {
      if (data) {
        setCardData({
          familyName: data.family_name,
          familyId: data.family_id,
          phone: data.phone,
          visitDate: data.visit_date ? data.visit_date.split("T")[0] : null,
          aids: data.aids.map((a) => ({
            label: locale === "ar" ? a.label_ar : a.label_fr,
            quantity: a.quantity,
          })),
          nextAction: data.next_action,
          codeShort: data.code_short,
        });
      } else {
        setError(apiError ?? "Token invalide");
      }
      setLoading(false);
    });
  }, [token, locale]);

  if (loading) {
    return (
      <div className="pt-[var(--space-12)] text-center">
        <p className="text-sm text-[var(--text-secondary)]">...</p>
      </div>
    );
  }

  if (!cardData || error) {
    return (
      <div className="pt-[var(--space-12)] text-center">
        <div className="w-16 h-16 mx-auto mb-[var(--space-4)] rounded-full bg-[var(--critical)] flex items-center justify-center text-[var(--on-critical)] text-2xl">
          ✕
        </div>
        <h1 className="text-[var(--text-xl)] font-semibold text-[var(--text-primary)] mb-2">
          {t("feelingNoToken")}
        </h1>
        <p className="text-sm text-[var(--text-secondary)]">
          {error ?? `Token: ${token}`}
        </p>
      </div>
    );
  }

  return (
    <div className="pt-[var(--space-4)] space-y-[var(--space-4)]">
      {/* Header */}
      <div className="text-center mb-[var(--space-6)]">
        <div className="w-16 h-16 mx-auto mb-[var(--space-3)] rounded-full bg-[var(--primary)] flex items-center justify-center text-[var(--on-primary)] text-2xl font-bold">
          O
        </div>
        <h1 className="text-[var(--text-2xl)] font-semibold text-[var(--text-primary)]">
          {t("feelingTitle")}
        </h1>
        <p className="text-sm text-[var(--text-secondary)]">{t("feelingSubtitle")}</p>
      </div>

      {/* Family info */}
      <Card>
        <div className="flex items-center justify-between mb-[var(--space-3)]">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">
            {t("family")} {cardData.familyName}
          </h2>
          <Badge variant="info">{cardData.familyId.substring(0, 8)}</Badge>
        </div>
        {cardData.phone && (
          <p className="text-sm text-[var(--text-secondary)]">{cardData.phone}</p>
        )}
      </Card>

      {/* Visit date */}
      {cardData.visitDate && (
        <Card>
          <div className="flex items-center gap-[var(--space-3)]">
            <div className="w-10 h-10 rounded-full bg-[color-mix(in_srgb,var(--primary)_10%,transparent)] flex items-center justify-center shrink-0">
              <Calendar size={20} className="text-[var(--primary)]" />
            </div>
            <div>
              <p className="text-sm text-[var(--text-tertiary)]">{t("feelingDate")}</p>
              <p className="font-semibold text-[var(--text-primary)]">{cardData.visitDate}</p>
            </div>
          </div>
        </Card>
      )}

      {/* Aids received */}
      <Card>
        <h3 className="text-base font-semibold text-[var(--text-primary)] mb-[var(--space-3)] flex items-center gap-2">
          <Package size={20} className="text-[var(--primary)]" />
          {t("feelingAidsReceived")}
        </h3>
        <ul className="space-y-[var(--space-2)]">
          {cardData.aids.map((aid) => (
            <li
              key={aid.label}
              className="flex items-center justify-between py-[var(--space-2)] px-[var(--space-3)] rounded-[var(--radius-md)] bg-[var(--bg-secondary)]"
            >
              <span className="text-sm font-medium text-[var(--text-primary)]">{aid.label}</span>
              <span className="text-sm font-semibold text-[var(--primary)]">×{aid.quantity}</span>
            </li>
          ))}
        </ul>
      </Card>

      {/* Next action */}
      <Card>
        <div className="flex items-center gap-[var(--space-3)]">
          <div className="w-10 h-10 rounded-full bg-[color-mix(in_srgb,var(--success)_10%,transparent)] flex items-center justify-center shrink-0">
            <ArrowRight size={20} className="text-[var(--success)]" />
          </div>
          <div>
            <p className="text-sm text-[var(--text-tertiary)]">{t("feelingNextAction")}</p>
            <p className="font-medium text-[var(--text-primary)]">
              {cardData.nextAction}
            </p>
          </div>
        </div>
      </Card>

      {/* Call association */}
      <div className="pt-[var(--space-2)]">
        <a href="tel:+21671000000">
          <Button
            variant="primary"
            size="lg"
            icon={<Phone size={22} />}
            className="w-full"
          >
            {t("feelingCallAssociation")}
          </Button>
        </a>
      </div>

      <p className="text-xs text-center text-[var(--text-tertiary)] pt-[var(--space-2)] pb-[var(--space-4)]">
        {cardData.codeShort} — {t("readOnly")}
      </p>
    </div>
  );
}
