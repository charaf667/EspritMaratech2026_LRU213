"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/i18n";
import type { TranslationKey } from "@/i18n";
import { USE_API, apiRedeemFeeling } from "@/lib/api";
import { Button, Input, Card } from "@/components/ds";
import { Search, ShieldAlert } from "lucide-react";

/** Map API error responses to privacy-safe i18n keys */
function classifyRedeemError(status: number, detail: string): TranslationKey {
  if (status === 429) return "feelingRateLimited";
  if (status === 410 || detail.includes("expired")) return "feelingExpired";
  if (status === 403 || detail.includes("revoked")) return "feelingRevoked";
  if (status === 404 || status === 400) return "feelingInvalid";
  return "feelingGenericError";
}

export default function FeelingRedeemPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<TranslationKey | null>(null);
  const [loading, setLoading] = useState(false);
  const attemptsRef = useRef(0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setError(null);

    if (!USE_API) {
      router.push(`/feeling/card/${code.trim()}`);
      return;
    }

    // Client-side rate guard: max 5 attempts per session
    attemptsRef.current += 1;
    if (attemptsRef.current > 5) {
      setError("feelingRateLimited");
      return;
    }

    setLoading(true);
    const { data, error: apiError, status } = await apiRedeemFeeling(code.trim());
    setLoading(false);

    if (data?.token) {
      router.push(`/feeling/card/${data.token}`);
    } else {
      setError(classifyRedeemError(status, apiError ?? ""));
    }
  };

  return (
    <div className="pt-[var(--space-8)]">
      <div className="text-center mb-[var(--space-8)]">
        <h1 className="text-[var(--text-2xl)] font-semibold text-[var(--text-primary)]">
          {t("feelingRedeem")}
        </h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          {t("feelingEnterCode")}
        </p>
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="space-y-[var(--space-4)]">
          <Input
            label={t("feelingCode")}
            placeholder="tk_abc123"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            icon={<Search size={18} />}
            error={error ? t(error) : undefined}
            required
          />
          {error && (
            <div className="flex items-start gap-2 p-[var(--space-3)] rounded-[var(--radius-md)] bg-[color-mix(in_srgb,var(--critical)_8%,transparent)] border border-[var(--critical)]" role="alert">
              <ShieldAlert size={18} className="text-[var(--critical)] shrink-0 mt-0.5" />
              <p className="text-sm text-[var(--critical)]">{t(error)}</p>
            </div>
          )}
          <Button type="submit" variant="primary" size="md" className="w-full" disabled={!code.trim() || loading}>
            {loading ? "..." : t("feelingVerify")}
          </Button>
        </form>
      </Card>
    </div>
  );
}
