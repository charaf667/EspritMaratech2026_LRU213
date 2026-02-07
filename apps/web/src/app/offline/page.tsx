"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/i18n";
import { useAuth } from "@/lib/auth-context";
import { OfflineProvider, useOffline } from "@/lib/offline-context";
import { getAllOutbox, type OutboxEntry } from "@/lib/offline-db";
import { Button, Card, Badge } from "@/components/ds";
import { RefreshCw, WifiOff, Wifi, Clock, AlertTriangle, Check } from "lucide-react";
import type { TranslationKey } from "@/i18n";

const STATUS_KEY: Record<string, { variant: "neutral" | "warning" | "critical" | "success"; labelKey: TranslationKey }> = {
  pending: { variant: "warning", labelKey: "offlinePending" },
  sending: { variant: "neutral", labelKey: "offlineSending" },
  failed: { variant: "critical", labelKey: "offlineFailed" },
};

function OfflinePageInner() {
  const { t, locale } = useI18n();
  const { isOnline, outboxCount, lastSyncAt, syncNow, isSyncing } = useOffline();
  const [entries, setEntries] = useState<OutboxEntry[]>([]);

  useEffect(() => {
    loadEntries();
  }, [outboxCount]);

  async function loadEntries() {
    const all = await getAllOutbox();
    setEntries(all.sort((a, b) => b.createdAt - a.createdAt));
  }

  const handleSync = async () => {
    await syncNow();
    await loadEntries();
  };

  return (
    <div className="flex flex-col flex-1 overflow-y-auto bg-[var(--bg-secondary)]">
      {/* Header */}
      <div className="bg-[var(--surface-raised)] border-b border-[var(--border-default)] p-[var(--space-4)]">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-3 mb-[var(--space-3)]">
            {isOnline ? (
              <Wifi size={24} className="text-[var(--success)]" />
            ) : (
              <WifiOff size={24} className="text-[var(--warning)]" />
            )}
            <div>
              <h1 className="text-xl font-semibold text-[var(--text-primary)]">
                {t("offlineSync")}
              </h1>
              <p className="text-sm text-[var(--text-secondary)]">
                {isOnline ? t("offlineConnected") : t("offlineDisconnected")}
              </p>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-[var(--space-3)]">
            <Card className="flex items-center gap-3">
              <Clock size={20} className="text-[var(--warning)] shrink-0" />
              <div>
                <p className="text-2xl font-bold text-[var(--text-primary)]">{entries.filter(e => e.status === "pending").length}</p>
                <p className="text-xs text-[var(--text-tertiary)]">
                  {t("offlinePending")}
                </p>
              </div>
            </Card>
            <Card className="flex items-center gap-3">
              <AlertTriangle size={20} className="text-[var(--critical)] shrink-0" />
              <div>
                <p className="text-2xl font-bold text-[var(--text-primary)]">{entries.filter(e => e.status === "failed").length}</p>
                <p className="text-xs text-[var(--text-tertiary)]">
                  {t("offlineFailed")}
                </p>
              </div>
            </Card>
          </div>

          {/* Last sync */}
          {lastSyncAt && (
            <p className="text-xs text-[var(--text-tertiary)] mt-[var(--space-2)]">
              {t("offlineLastSync")}{" "}
              {new Date(lastSyncAt).toLocaleString(locale === "ar" ? "ar-DZ" : "fr-FR")}
            </p>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="p-[var(--space-4)] max-w-2xl mx-auto w-full">
        <Button
          variant="primary"
          size="md"
          className="w-full mb-[var(--space-4)]"
          disabled={!isOnline || isSyncing || entries.filter(e => e.status === "pending" || e.status === "failed").length === 0}
          onClick={handleSync}
          icon={<RefreshCw size={18} className={isSyncing ? "animate-spin" : ""} />}
        >
          {isSyncing ? t("offlineSyncing") : t("offlineSyncNow")}
        </Button>

        {/* Queue entries */}
        {entries.length === 0 ? (
          <div className="text-center py-[var(--space-8)]">
            <Check size={48} className="text-[var(--success)] mx-auto mb-[var(--space-3)]" />
            <p className="text-[var(--text-secondary)]">
              {t("offlineNoPending")}
            </p>
          </div>
        ) : (
          <div className="space-y-[var(--space-2)]">
            <h2 className="text-sm font-medium text-[var(--text-secondary)] mb-[var(--space-2)]">
              {t("offlineQueue")} ({entries.length})
            </h2>
            {entries.map((entry) => {
              const meta = STATUS_KEY[entry.status] ?? STATUS_KEY.pending;
              return (
                <Card key={entry.id}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-[var(--text-primary)]">
                      {entry.method} {entry.url.replace("/api/", "")}
                    </span>
                    <Badge variant={meta.variant}>{t(meta.labelKey)}</Badge>
                  </div>
                  <p className="text-xs text-[var(--text-tertiary)]">
                    {new Date(entry.createdAt).toLocaleString(locale === "ar" ? "ar-DZ" : "fr-FR")}
                  </p>
                  {entry.error && (
                    <p className="text-xs text-[var(--critical)] mt-1">{entry.error}</p>
                  )}
                  {entry.retries > 0 && (
                    <p className="text-xs text-[var(--text-tertiary)] mt-1">
                      {entry.retries} {t("offlineAttempts")}
                    </p>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function OfflinePage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace("/login");
  }, [isLoading, isAuthenticated, router]);

  if (isLoading || !isAuthenticated) return null;

  return (
    <OfflineProvider>
      <OfflinePageInner />
    </OfflineProvider>
  );
}
