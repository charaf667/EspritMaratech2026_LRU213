"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/i18n";
import { useAuth } from "@/lib/auth-context";
import { MOCK_ITEMS } from "@/lib/mock-data";
import FieldList from "@/components/FieldList";
import MapViewDynamic from "@/components/MapViewDynamic";
import LanguageSwitcher from "@/components/LanguageSwitcher";

export default function FieldPage() {
  const { t } = useI18n();
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace("/login");
  }, [isLoading, isAuthenticated, router]);

  if (isLoading || !isAuthenticated) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      {/* Header */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 16px",
          borderBottom: "1px solid var(--color-border)",
          background: "var(--color-surface)",
        }}
      >
        <h1 style={{ fontSize: "1.1rem", fontWeight: 700 }}>
          {t("appName")} — {t("field")}
        </h1>
        <LanguageSwitcher />
      </header>

      {/* Main content: split view */}
      <main
        style={{
          display: "flex",
          flex: 1,
          overflow: "hidden",
        }}
      >
        {/* List panel */}
        <section
          aria-label={t("list")}
          style={{
            width: "clamp(280px, 35%, 420px)",
            display: "flex",
            flexDirection: "column",
            borderInlineEnd: "1px solid var(--color-border)",
            background: "var(--color-surface)",
          }}
        >
          <FieldList
            items={MOCK_ITEMS}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </section>

        {/* Map panel */}
        <section
          aria-label={t("map")}
          style={{ flex: 1, position: "relative" }}
        >
          <MapViewDynamic
            items={MOCK_ITEMS}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </section>
      </main>
    </div>
  );
}
