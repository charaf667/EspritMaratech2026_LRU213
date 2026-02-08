"use client";

import { useState, type ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useI18n } from "@/i18n";
import { useAuth } from "@/lib/auth-context";
import {
  LayoutDashboard, Users, FolderOpen, AlertTriangle, ShieldAlert,
  ChevronLeft, ChevronRight, MapPin, Route, GitMerge, Brain,
} from "lucide-react";

interface SidebarItem {
  id: string;
  label: string;
  icon: ReactNode;
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const { hasRole } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  // Only admins get the sidebar layout
  if (!hasRole("admin")) {
    return <>{children}</>;
  }

  const sidebarItems: SidebarItem[] = [
    { id: "dashboard", label: t("sidebarDashboard"), icon: <LayoutDashboard size={20} /> },
    { id: "families", label: t("sidebarFamilies"), icon: <FolderOpen size={20} /> },
    { id: "users", label: t("sidebarUsers"), icon: <Users size={20} /> },
    { id: "complaints", label: t("sidebarComplaints"), icon: <AlertTriangle size={20} /> },
    { id: "emergencies", label: t("sidebarEmergencies"), icon: <ShieldAlert size={20} /> },
    { id: "planner", label: t("sidebarPlanner"), icon: <Route size={20} /> },
    { id: "duplicates", label: t("sidebarDuplicates"), icon: <GitMerge size={20} /> },
    { id: "ops-brief", label: t("sidebarOpsBrief"), icon: <Brain size={20} /> },
  ];

  // Derive active section from URL search param or default to dashboard
  const searchParams = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const activeSection = searchParams.get("section") || "dashboard";

  const handleNav = (id: string) => {
    if (id === "dashboard") {
      router.push("/app/admin");
    } else {
      router.push(`/app/admin?section=${id}`);
    }
  };

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Sidebar */}
      <nav
        role="navigation"
        aria-label={t("sidebarNav")}
        className={`hidden md:flex flex-col shrink-0 bg-[var(--surface-raised)] border-e border-[var(--border-default)] transition-all duration-200 ${
          collapsed ? "w-16" : "w-60"
        }`}
      >
        {/* Sidebar header */}
        <div className="flex items-center justify-between px-3 py-3 border-b border-[var(--border-subtle)]">
          {!collapsed && (
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
              {t("adminPanel")}
            </span>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex items-center justify-center w-8 h-8 rounded-[var(--radius-md)] hover:bg-[var(--bg-secondary)] text-[var(--text-tertiary)] cursor-pointer transition-colors"
            aria-label={collapsed ? t("expandSidebar") : t("collapseSidebar")}
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        {/* Nav items */}
        <ul className="flex-1 py-2 space-y-0.5 px-2" role="list">
          {sidebarItems.map((item) => {
            const isActive = item.id === activeSection;
            return (
              <li key={item.id}>
                <button
                  onClick={() => handleNav(item.id)}
                  aria-current={isActive ? "page" : undefined}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-md)] text-sm font-medium transition-colors cursor-pointer min-h-[var(--touch-target-min)] ${
                    isActive
                      ? "bg-[color-mix(in_srgb,var(--primary)_12%,transparent)] text-[var(--primary)]"
                      : "text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)]"
                  } ${collapsed ? "justify-center" : ""}`}
                  title={collapsed ? item.label : undefined}
                >
                  <span className="shrink-0">{item.icon}</span>
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </button>
              </li>
            );
          })}
        </ul>

        {/* Back to agent view */}
        <div className="border-t border-[var(--border-subtle)] p-2">
          <button
            onClick={() => router.push("/app")}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-md)] text-sm font-medium text-[var(--text-tertiary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)] cursor-pointer transition-colors min-h-[var(--touch-target-min)] ${
              collapsed ? "justify-center" : ""
            }`}
            title={collapsed ? t("backToAgent") : undefined}
          >
            <MapPin size={20} className="shrink-0" />
            {!collapsed && <span className="truncate">{t("backToAgent")}</span>}
          </button>
        </div>
      </nav>

      {/* Main content area */}
      <div className="flex-1 overflow-y-auto bg-[var(--bg-secondary)] pb-16 md:pb-0">
        {children}
      </div>

      {/* Mobile bottom nav (md:hidden) — WCAG 2.2 compliant, one-hand friendly */}
      <nav
        role="navigation"
        aria-label={t("sidebarNav")}
        className="md:hidden fixed bottom-0 inset-x-0 z-[var(--z-sticky)] bg-[var(--surface-raised)] border-t border-[var(--border-default)] safe-area-bottom"
      >
        <ul
          className="flex overflow-x-auto gap-1 px-2 py-1.5 scrollbar-hide"
          role="list"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          {sidebarItems.map((item) => {
            const isActive = item.id === activeSection;
            return (
              <li key={item.id} className="shrink-0">
                <button
                  onClick={() => handleNav(item.id)}
                  aria-current={isActive ? "page" : undefined}
                  className={`flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 rounded-[var(--radius-md)] text-[10px] font-medium transition-colors cursor-pointer min-w-[var(--touch-target-min)] min-h-[var(--touch-target-min)] ${
                    isActive
                      ? "bg-[color-mix(in_srgb,var(--primary)_12%,transparent)] text-[var(--primary)]"
                      : "text-[var(--text-tertiary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  <span className="shrink-0">{item.icon}</span>
                  <span className="truncate max-w-[56px]">{item.label}</span>
                </button>
              </li>
            );
          })}
          <li className="shrink-0">
            <button
              onClick={() => router.push("/app")}
              className="flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 rounded-[var(--radius-md)] text-[10px] font-medium text-[var(--text-tertiary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)] cursor-pointer transition-colors min-w-[var(--touch-target-min)] min-h-[var(--touch-target-min)]"
            >
              <MapPin size={20} className="shrink-0" />
              <span className="truncate max-w-[56px]">{t("backToAgent")}</span>
            </button>
          </li>
        </ul>
      </nav>
    </div>
  );
}
