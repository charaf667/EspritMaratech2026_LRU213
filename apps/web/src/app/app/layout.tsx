"use client";

import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";
import { useI18n } from "@/i18n";
import { useAuth } from "@/lib/auth-context";
import { OfflineProvider, useOffline } from "@/lib/offline-context";
import { TabsNav, type Tab } from "@/components/ds";
import AccessibilityPanel from "@/components/ds/AccessibilityPanel";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { MapPin, PlusCircle, LayoutDashboard, LogOut, WifiOff, UserCircle } from "lucide-react";
import type { ReactNode } from "react";

function AppLayoutInner({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const { user, isAuthenticated, isLoading, logout, hasRole } = useAuth();
  const { outboxCount, isOnline } = useOffline();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-dvh bg-[var(--bg-secondary)]">
        <div className="w-10 h-10 rounded-full bg-[var(--primary)] flex items-center justify-center text-[var(--on-primary)] text-sm font-bold animate-pulse">
          O
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) return null;

  const tabs: Tab[] = [
    { id: "home", label: t("tabAgentHome"), icon: <MapPin size={18} /> },
    { id: "new-visit", label: t("tabNewVisit"), icon: <PlusCircle size={18} /> },
    ...(hasRole("admin")
      ? [{ id: "admin", label: t("tabAdmin"), icon: <LayoutDashboard size={18} /> }]
      : []),
  ];

  const activeTab = pathname.includes("/admin")
    ? "admin"
    : pathname.includes("/new-visit")
    ? "new-visit"
    : "home";

  const handleTabChange = (id: string) => {
    if (id === "home") router.push("/app");
    else if (id === "new-visit") router.push("/app/new-visit");
    else if (id === "admin") router.push("/app/admin");
  };

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  return (
    <div className="flex flex-col h-dvh bg-[var(--bg-secondary)]">
      {/* Header */}
      <header className="sticky top-0 z-[var(--z-sticky)] bg-[var(--surface-raised)] shadow-[var(--elevation-1)]">
        {/* Offline banner */}
        {!isOnline && (
          <div role="status" aria-live="polite" className="flex items-center justify-center gap-2 px-[var(--space-3)] py-[var(--space-1)] bg-[var(--warning)] text-[var(--on-warning)] text-xs font-medium">
            <WifiOff size={14} />
            {t("offlineDisconnected")}
          </div>
        )}

        <div className="flex items-center justify-between px-[var(--space-4)] h-14">
          {/* Brand */}
          <div className="flex items-center gap-[var(--space-3)]">
            <div className="w-9 h-9 rounded-full bg-[var(--primary)] flex items-center justify-center text-[var(--on-primary)] text-sm font-bold shrink-0">
              O
            </div>
            <div className="hidden sm:block">
              <p className="text-sm font-semibold text-[var(--text-primary)] leading-tight">OMNIA</p>
              <p className="text-xs text-[var(--text-tertiary)] leading-tight">{t("appSubtitle")}</p>
            </div>
          </div>

          {/* Right utilities */}
          <div className="flex items-center gap-[var(--space-2)]">
            {/* Outbox badge */}
            {outboxCount > 0 && (
              <button
                onClick={() => router.push("/offline")}
                className="relative flex items-center justify-center w-10 h-10 rounded-full hover:bg-[var(--bg-secondary)] text-[var(--warning)] cursor-pointer min-w-[var(--touch-target-min)] min-h-[var(--touch-target-min)]"
                aria-label={`${outboxCount} actions en attente`}
              >
                <WifiOff size={18} />
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-[var(--critical)] text-white text-[10px] font-bold px-1">
                  {outboxCount}
                </span>
              </button>
            )}
            <AccessibilityPanel />
            <LanguageSwitcher />
            <button
              onClick={() => router.push("/app/account")}
              aria-label={t("accountSettings")}
              className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)] cursor-pointer min-w-[var(--touch-target-min)] min-h-[var(--touch-target-min)]"
            >
              <UserCircle size={20} />
            </button>
            <button
              onClick={handleLogout}
              aria-label={t("logout")}
              className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)] cursor-pointer min-w-[var(--touch-target-min)] min-h-[var(--touch-target-min)]"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <TabsNav tabs={tabs} activeTab={activeTab} onTabChange={handleTabChange} />
      </header>

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {children}
      </main>
    </div>
  );
}

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <OfflineProvider>
      <AppLayoutInner>{children}</AppLayoutInner>
    </OfflineProvider>
  );
}
