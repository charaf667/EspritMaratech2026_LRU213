"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/i18n";
import { useAuth } from "@/lib/auth-context";
import {
  MOCK_FAMILIES, MOCK_KPIS, MOCK_AID_DISTRIBUTION, MOCK_COMPLAINTS,
  MOCK_DATA_QUALITY, MOCK_USERS, MOCK_VISITS,
  type Family, type Complaint, type Priority, type DashboardKPIs,
  type AidDistribution, type DataQuality, type User,
} from "@/lib/mock-data";
import {
  USE_API, apiGetDashboard, apiDashboardToKPIs, apiDashboardToAidDistribution,
  apiDashboardToCriticalQueue, apiDashboardToDataQuality, apiDashboardToWorkload,
  apiDashboardToSLA,
  apiGetFamilies, apiFamilyToFamily, apiGetComplaints, apiComplaintToComplaint,
  apiGetUsers, apiUserToUser, apiAssignFamily, apiMergeFamily,
  apiUpdateComplaintStatus, apiAssignComplaint, apiAddComplaintMessage,
  exportFamiliesCsvUrl, exportFamiliesXlsxUrl, exportVisitsCsvUrl, exportVisitsXlsxUrl,
} from "@/lib/api";
import type { TranslationKey } from "@/i18n";
import { Card, CardHeader, Badge, Button, Chip, Input, Modal, EmergenciesPanel } from "@/components/ds";
import type { BadgeVariant } from "@/components/ds";
import {
  TrendingUp, TrendingDown, Minus, Clock, AlertTriangle, CalendarCheck,
  Users, BarChart3, ShieldAlert, Database, ChevronRight, Search,
  UserPlus, Eye, Send, MessageSquare, Download,
} from "lucide-react";

const PRIORITY_BADGE: Record<Priority, BadgeVariant> = {
  overdue: "critical", urgent: "warning", normal: "neutral",
};

export default function AdminDashboardPage() {
  const { t } = useI18n();
  const { hasRole } = useAuth();
  const router = useRouter();

  const [activeSection, setActiveSection] = useState<"dashboard" | "families" | "users" | "emergencies">("dashboard");

  if (!hasRole("admin")) {
    return (
      <div className="flex items-center justify-center flex-1 p-8">
        <p className="text-[var(--text-secondary)]">{t("adminOnly")}</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Sub-navigation */}
      <div className="flex gap-2 px-[var(--space-4)] py-[var(--space-3)] border-b border-[var(--border-default)] bg-[var(--surface-raised)] overflow-x-auto">
        <Chip selected={activeSection === "dashboard"} onToggle={() => setActiveSection("dashboard")}>
          {t("dashboard")}
        </Chip>
        <Chip selected={activeSection === "families"} onToggle={() => setActiveSection("families")}>
          {t("families")}
        </Chip>
        <Chip selected={activeSection === "users"} onToggle={() => setActiveSection("users")}>
          {t("users")}
        </Chip>
        <Chip selected={activeSection === "emergencies"} onToggle={() => setActiveSection("emergencies")}>
          {t("emergencyIncidents")}
        </Chip>
      </div>

      <div className="p-[var(--space-4)] max-w-5xl mx-auto space-y-[var(--space-6)]">
        {activeSection === "dashboard" && <DashboardView t={t} />}
        {activeSection === "families" && <FamiliesView t={t} router={router} />}
        {activeSection === "users" && <UsersView t={t} />}
        {activeSection === "emergencies" && <EmergenciesPanel />}
      </div>
    </div>
  );
}

// ─── Dashboard View ─────────────────────────────────────────

function DashboardView({ t }: { t: (key: TranslationKey) => string }) {
  const [kpis, setKpis] = useState<DashboardKPIs>(MOCK_KPIS);
  const [aidDistribution, setAidDistribution] = useState<AidDistribution[]>(MOCK_AID_DISTRIBUTION);
  const [criticalQueue, setCriticalQueue] = useState<Family[]>([]);
  const [dataQuality, setDataQuality] = useState<DataQuality>(MOCK_DATA_QUALITY);
  const [complaints, setComplaints] = useState<Complaint[]>(MOCK_COMPLAINTS);
  const [workload, setWorkload] = useState<{ agent_id: string; agent_name: string; families_count: number; overdue_count: number }[]>([]);
  const [slaPct, setSlaPct] = useState(100);
  const [users, setUsers] = useState<User[]>([]);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assignFamilyId, setAssignFamilyId] = useState<string | null>(null);
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);

  const openAssignModal = (familyId: string) => {
    setAssignFamilyId(familyId);
    setAssignModalOpen(true);
  };

  const handleAssign = async (userId: string | null) => {
    if (!assignFamilyId) return;
    await apiAssignFamily(assignFamilyId, userId);
    setAssignModalOpen(false);
    setAssignFamilyId(null);
  };

  useEffect(() => {
    if (!USE_API) {
      const topRetard = MOCK_FAMILIES.filter((f) => f.priority === "overdue").slice(0, 10);
      const topUrgent = MOCK_FAMILIES.filter((f) => f.priority === "urgent").slice(0, 10);
      setCriticalQueue([...topRetard, ...topUrgent].slice(0, 10));
      return;
    }
    apiGetDashboard().then(({ data }) => {
      if (data) {
        setKpis(apiDashboardToKPIs(data));
        setAidDistribution(apiDashboardToAidDistribution(data));
        setCriticalQueue(apiDashboardToCriticalQueue(data));
        setDataQuality(apiDashboardToDataQuality(data));
        setWorkload(apiDashboardToWorkload(data));
        setSlaPct(apiDashboardToSLA(data));
      }
    });
    apiGetComplaints().then(({ data }) => {
      if (data?.results) setComplaints(data.results.map(apiComplaintToComplaint));
    });
    apiGetUsers().then(({ data }) => {
      if (data) setUsers(data.map(apiUserToUser));
    });
  }, []);

  return (
    <>
      {/* KPI Cards */}
      <section>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-[var(--space-3)]">
          <KPICard
            label={t("kpiOverdue")}
            value={kpis.overdue}
            trend={kpis.overdueTrend}
            icon={<Clock size={20} />}
            variant="critical"
          />
          <KPICard
            label={t("kpiUrgent")}
            value={kpis.urgent}
            trend={kpis.urgentTrend}
            icon={<AlertTriangle size={20} />}
            variant="warning"
          />
          <KPICard
            label={t("kpiVisits7d")}
            value={kpis.visitsLast7d}
            trend={kpis.visitsTrend}
            icon={<CalendarCheck size={20} />}
            variant="success"
          />
          <KPICard
            label={t("kpiNewFamilies")}
            value={kpis.newFamilies7d}
            trend={kpis.newFamiliesTrend}
            icon={<UserPlus size={20} />}
            variant="info"
          />
        </div>
      </section>

      {/* Top Aids Distribution */}
      <section>
        <Card>
          <CardHeader>
            <h3 className="text-base font-semibold text-[var(--text-primary)] flex items-center gap-2">
              <BarChart3 size={18} className="text-[var(--primary)]" />
              {t("topAids")}
            </h3>
          </CardHeader>
          <div className="space-y-[var(--space-3)]">
            {aidDistribution.map((item, idx) => {
              const maxCount = aidDistribution[0]?.count ?? 1;
              const pct = Math.round((item.count / maxCount) * 100);
              return (
                <div key={item.aidId}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-[var(--text-primary)] font-medium">
                      {idx + 1}. {item.label}
                    </span>
                    <span className="text-[var(--text-secondary)]">{item.count}</span>
                  </div>
                  <div className="w-full h-2 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[var(--primary)] rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </section>

      {/* Critical Queue */}
      <section>
        <Card>
          <CardHeader>
            <h3 className="text-base font-semibold text-[var(--text-primary)] flex items-center gap-2">
              <ShieldAlert size={18} className="text-[var(--critical)]" />
              {t("criticalQueue")}
            </h3>
          </CardHeader>
          <div className="space-y-[var(--space-2)]">
            {criticalQueue.map((family) => (
              <div
                key={family.id}
                className="flex items-center justify-between p-[var(--space-3)] rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-secondary)]"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-medium text-sm text-[var(--text-primary)] truncate">
                      {t("family")} {family.name}
                    </span>
                    <Badge variant={PRIORITY_BADGE[family.priority]}>
                      {t(family.priority)}
                    </Badge>
                  </div>
                  <p className="a11y-secondary text-xs text-[var(--text-tertiary)] truncate">{family.address}</p>
                </div>
                <div className="flex gap-1 shrink-0 ms-2">
                  <Button variant="ghost" size="sm" onClick={() => openAssignModal(family.id)}>{t("assign")}</Button>
                  <Button variant="ghost" size="sm">{t("open")}</Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </section>

      {/* Complaints */}
      <section>
        <Card>
          <CardHeader>
            <h3 className="text-base font-semibold text-[var(--text-primary)] flex items-center gap-2">
              <AlertTriangle size={18} className="text-[var(--warning)]" />
              {t("complaints")}
            </h3>
          </CardHeader>
          <ComplaintsPanel t={t} allComplaints={complaints} onSelect={setSelectedComplaint} />
        </Card>
      </section>

      {/* SLA Gauge */}
      <section>
        <Card>
          <CardHeader>
            <h3 className="text-base font-semibold text-[var(--text-primary)] flex items-center gap-2">
              <CalendarCheck size={18} className="text-[var(--success)]" />
              SLA — Visites à temps
            </h3>
          </CardHeader>
          <div className="flex items-center gap-4">
            <span className="text-3xl font-bold" style={{
              color: slaPct >= 80 ? "var(--success)" : slaPct >= 60 ? "var(--warning)" : "var(--critical)"
            }}>
              {slaPct}%
            </span>
            <div className="flex-1">
              <div className="w-full h-3 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${slaPct}%`,
                    backgroundColor: slaPct >= 80 ? "var(--success)" : slaPct >= 60 ? "var(--warning)" : "var(--critical)",
                  }}
                />
              </div>
            </div>
          </div>
        </Card>
      </section>

      {/* Agent Workload */}
      {workload.length > 0 && (
        <section>
          <Card>
            <CardHeader>
              <h3 className="text-base font-semibold text-[var(--text-primary)] flex items-center gap-2">
                <Users size={18} className="text-[var(--primary)]" />
                {t("agentWorkload")}
              </h3>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border-default)]">
                    <th className="text-start p-2 text-[var(--text-secondary)] font-medium">{t("agentCol")}</th>
                    <th className="text-end p-2 text-[var(--text-secondary)] font-medium">{t("familiesCol")}</th>
                    <th className="text-end p-2 text-[var(--text-secondary)] font-medium">{t("overdueCol")}</th>
                  </tr>
                </thead>
                <tbody>
                  {workload.map((w) => (
                    <tr key={w.agent_id} className="border-b border-[var(--border-subtle)]">
                      <td className="p-2 text-[var(--text-primary)] font-medium">{w.agent_name}</td>
                      <td className="p-2 text-end text-[var(--text-primary)]">{w.families_count}</td>
                      <td className="p-2 text-end">
                        <Badge variant={w.overdue_count > 0 ? "critical" : "success"}>
                          {w.overdue_count}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </section>
      )}

      {/* Data Quality */}
      <section>
        <Card>
          <CardHeader>
            <h3 className="text-base font-semibold text-[var(--text-primary)] flex items-center gap-2">
              <Database size={18} className="text-[var(--info)]" />
              {t("dataQuality")}
            </h3>
          </CardHeader>
          <DataQualityPanel t={t} dq={dataQuality} onMerge={async (targetId, sourceId) => {
            const { error } = await apiMergeFamily(targetId, sourceId);
            if (!error) {
              setDataQuality((prev) => ({
                ...prev,
                suspectedDuplicates: Math.max(0, prev.suspectedDuplicates - 1),
                duplicates: prev.duplicates.filter(
                  (d) => !(d.familyA === sourceId || d.familyB === sourceId)
                ),
              }));
            }
          }} />
        </Card>
      </section>

      {/* Assign Modal */}
      <AssignModal
        open={assignModalOpen}
        onClose={() => { setAssignModalOpen(false); setAssignFamilyId(null); }}
        users={users}
        onAssign={handleAssign}
        t={t}
      />

      {/* Complaint Detail Modal */}
      {selectedComplaint && (
        <ComplaintDetailModal
          complaint={selectedComplaint}
          users={users}
          onClose={() => setSelectedComplaint(null)}
          onUpdated={(updated) => {
            setComplaints((prev) => prev.map((c) => c.id === updated.id ? updated : c));
            setSelectedComplaint(null);
          }}
          t={t}
        />
      )}
    </>
  );
}

// ─── KPI Card ───────────────────────────────────────────────

function KPICard({
  label, value, trend, icon, variant,
}: {
  label: string;
  value: number;
  trend: number;
  icon: React.ReactNode;
  variant: BadgeVariant;
}) {
  const colorMap: Record<BadgeVariant, string> = {
    critical: "var(--critical)",
    warning: "var(--warning)",
    success: "var(--success)",
    info: "var(--info)",
    neutral: "var(--text-primary)",
  };
  const color = colorMap[variant];

  return (
    <Card className="flex flex-col gap-[var(--space-2)]">
      <div className="flex items-center justify-between">
        <span className="text-[var(--text-secondary)] text-sm">{label}</span>
        <span style={{ color }}>{icon}</span>
      </div>
      <p className="text-3xl font-bold" style={{ color }}>{value}</p>
      <div className="flex items-center gap-1 text-xs">
        {trend > 0 && <TrendingUp size={14} className="text-[var(--critical)]" />}
        {trend < 0 && <TrendingDown size={14} className="text-[var(--success)]" />}
        {trend === 0 && <Minus size={14} className="text-[var(--text-tertiary)]" />}
        <span className="text-[var(--text-tertiary)]">
          {trend > 0 ? `+${trend}` : trend === 0 ? "—" : `${trend}`}
        </span>
      </div>
    </Card>
  );
}

// ─── Complaints Panel ───────────────────────────────────────

function ComplaintsPanel({ t, allComplaints, onSelect }: { t: (key: TranslationKey) => string; allComplaints: Complaint[]; onSelect?: (c: Complaint) => void }) {
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const complaints = statusFilter
    ? allComplaints.filter((c) => c.status === statusFilter)
    : allComplaints;

  return (
    <div className="space-y-[var(--space-3)]">
      <div className="flex gap-2 overflow-x-auto">
        <Chip selected={statusFilter === null} onToggle={() => setStatusFilter(null)}>
          {t("complaintAll")}
        </Chip>
        <Chip selected={statusFilter === "open"} onToggle={() => setStatusFilter(statusFilter === "open" ? null : "open")}>
          {t("complaintOpen")}
        </Chip>
        <Chip selected={statusFilter === "in_progress"} onToggle={() => setStatusFilter(statusFilter === "in_progress" ? null : "in_progress")}>
          {t("complaintInProgress")}
        </Chip>
      </div>
      {complaints.length === 0 ? (
        <p className="text-sm text-[var(--text-tertiary)] py-4 text-center">{t("noResults")}</p>
      ) : (
        <div className="space-y-[var(--space-2)]">
          {complaints.map((c) => {
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => onSelect?.(c)}
                className="w-full text-start p-[var(--space-3)] rounded-[var(--radius-md)] border border-[var(--border-subtle)] hover:bg-[var(--bg-secondary)] cursor-pointer transition-colors"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-[var(--text-primary)]">
                    {c.familyId.substring(0, 8)}
                  </span>
                  <Badge variant={c.priority === "urgent" ? "warning" : c.priority === "overdue" ? "critical" : "neutral"}>
                    {c.status}
                  </Badge>
                </div>
                <p className="text-sm text-[var(--text-secondary)]">{c.description}</p>
                <p className="text-xs text-[var(--text-tertiary)] mt-1">{c.date}</p>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Data Quality Panel ─────────────────────────────────────

function DataQualityPanel({ t, dq, onMerge }: { t: (key: TranslationKey) => string; dq: DataQuality; onMerge?: (targetId: string, sourceId: string) => Promise<void> }) {
  return (
    <div className="space-y-[var(--space-4)]">
      {/* Global score */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-[var(--text-secondary)]">{t("globalScore")}</span>
          <span className="text-lg font-bold text-[var(--text-primary)]">{dq.globalScore}%</span>
        </div>
        <div className="w-full h-3 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${dq.globalScore}%`,
              backgroundColor: dq.globalScore >= 80 ? "var(--success)" : dq.globalScore >= 60 ? "var(--warning)" : "var(--critical)",
            }}
          />
        </div>
      </div>

      {/* Duplicates */}
      <div>
        <div className="flex items-center justify-between mb-[var(--space-2)]">
          <span className="text-sm text-[var(--text-secondary)]">{t("suspectedDuplicates")}</span>
          <Badge variant="warning">{dq.suspectedDuplicates}</Badge>
        </div>
        {dq.duplicates.map((dup, idx) => {
          return (
            <div key={idx} className="p-[var(--space-3)] rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-secondary)]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-[var(--text-primary)]">
                  {dup.familyA.substring(0, 8)} ↔ {dup.familyB.substring(0, 8)}
                </span>
                <Badge variant="warning">{dup.similarity}%</Badge>
              </div>
              <p className="text-xs text-[var(--text-secondary)] mb-2">{dup.reason}</p>
              <div className="flex gap-2">
                <Button variant="primary" size="sm" onClick={() => onMerge?.(dup.familyA, dup.familyB)}>{t("merge")}</Button>
                <Button variant="ghost" size="sm">{t("ignore")}</Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Families Admin View ────────────────────────────────────

function FamiliesView({
  t,
  router,
}: {
  t: (key: TranslationKey) => string;
  router: ReturnType<typeof useRouter>;
}) {
  const [search, setSearch] = useState("");
  const [allFamilies, setAllFamilies] = useState<Family[]>(USE_API ? [] : MOCK_FAMILIES);
  const [users, setUsers] = useState<User[]>([]);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assignFamilyId, setAssignFamilyId] = useState<string | null>(null);

  useEffect(() => {
    if (!USE_API) return;
    apiGetFamilies(search.trim() ? { search: search.trim() } : undefined).then(({ data }) => {
      if (data?.results) setAllFamilies(data.results.map(apiFamilyToFamily));
    });
  }, [search]);

  useEffect(() => {
    if (!USE_API) return;
    apiGetUsers().then(({ data }) => {
      if (data) setUsers(data.map(apiUserToUser));
    });
  }, []);

  const openAssign = (familyId: string) => {
    setAssignFamilyId(familyId);
    setAssignModalOpen(true);
  };

  const handleAssign = async (userId: string | null) => {
    if (!assignFamilyId) return;
    const { error } = await apiAssignFamily(assignFamilyId, userId);
    if (!error) {
      setAllFamilies((prev) =>
        prev.map((f) =>
          f.id === assignFamilyId ? { ...f, assignedAgent: userId ?? undefined } : f
        )
      );
    }
    setAssignModalOpen(false);
    setAssignFamilyId(null);
  };

  const families = useMemo(() => {
    if (USE_API) return allFamilies; // Already filtered server-side
    if (!search.trim()) return allFamilies;
    const q = search.toLowerCase();
    return allFamilies.filter(
      (f) => f.name.toLowerCase().includes(q) || f.id.toLowerCase().includes(q) || f.address.toLowerCase().includes(q)
    );
  }, [search, allFamilies]);

  return (
    <div className="space-y-[var(--space-4)]">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-[var(--text-primary)]">{t("families")}</h2>
        <div className="flex gap-2">
          <a href={exportFamiliesCsvUrl()} download className="inline-flex">
            <Button variant="ghost" size="sm" icon={<Download size={14} />}>CSV</Button>
          </a>
          <a href={exportFamiliesXlsxUrl()} download className="inline-flex">
            <Button variant="ghost" size="sm" icon={<Download size={14} />}>Excel</Button>
          </a>
        </div>
      </div>
      <Input
        placeholder={t("searchFamily")}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        icon={<Search size={18} />}
      />
      <div className="space-y-[var(--space-2)]">
        {families.map((family) => {
          const missing: string[] = [];
          if (!family.phone) missing.push(t("fieldPhone"));
          if (!family.address) missing.push(t("fieldAddress"));
          if (!family.zone) missing.push(t("fieldZone"));
          if (!family.assignedAgent) missing.push(t("fieldAgent"));
          const totalFields = 4;
          const score = Math.round(((totalFields - missing.length) / totalFields) * 100);
          const scoreColor = score >= 80 ? "var(--success)" : score >= 50 ? "var(--warning)" : "var(--critical)";

          return (
            <Card key={family.id} interactive>
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-medium text-[var(--text-primary)]">{t("family")} {family.name}</span>
                    <Badge variant={PRIORITY_BADGE[family.priority]}>{t(family.priority)}</Badge>
                    <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full" style={{ color: scoreColor, border: `1px solid ${scoreColor}` }}>
                      {score}%
                    </span>
                  </div>
                  <p className="a11y-tertiary text-xs text-[var(--text-tertiary)]">{family.id} — {family.zone}</p>
                  <p className="a11y-secondary text-sm text-[var(--text-secondary)]">{family.address}</p>
                  <div className="a11y-secondary flex items-center gap-4 mt-1 text-xs text-[var(--text-tertiary)]">
                    <span>{t("members")}: {family.membersCount}</span>
                    <span>{t("lastVisit")}: {family.lastVisit}</span>
                    <span>{t("assignedAgent")}: {family.assignedAgent ?? "—"}</span>
                  </div>
                  {missing.length > 0 && (
                    <p className="a11y-secondary text-xs mt-1" style={{ color: scoreColor }}>
                      {t("missingFields")}: {missing.join(", ")}
                    </p>
                  )}
                </div>
                <div className="flex gap-1 shrink-0 ms-2">
                  <Button variant="ghost" size="sm" onClick={() => openAssign(family.id)}>{t("assign")}</Button>
                  <Button variant="ghost" size="sm" icon={<Eye size={16} />}>{t("open")}</Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <AssignModal
        open={assignModalOpen}
        onClose={() => { setAssignModalOpen(false); setAssignFamilyId(null); }}
        users={users}
        onAssign={handleAssign}
        t={t}
      />
    </div>
  );
}

// ─── Assign Modal (stub — will be replaced by backend agent) ─

function AssignModal({
  open, onClose, users, onAssign, t,
}: {
  open: boolean;
  onClose: () => void;
  users: User[];
  onAssign: (userId: string | null) => void;
  t: (key: TranslationKey) => string;
}) {
  if (!open) return null;
  return (
    <Modal open={open} onClose={onClose} title={t("assign")}>
      <div className="space-y-[var(--space-2)]">
        <Button variant="ghost" size="sm" className="w-full text-start" onClick={() => onAssign(null)}>
          — {t("noResults")}
        </Button>
        {users.map((u) => (
          <Button key={u.id} variant="ghost" size="sm" className="w-full text-start" onClick={() => onAssign(u.id)}>
            {u.firstName} {u.lastName} ({u.role})
          </Button>
        ))}
      </div>
    </Modal>
  );
}

// ─── Complaint Detail Modal (stub — will be replaced by backend agent) ─

function ComplaintDetailModal({
  complaint, users, onClose, onUpdated, t,
}: {
  complaint: Complaint;
  users: User[];
  onClose: () => void;
  onUpdated: (updated: Complaint) => void;
  t: (key: TranslationKey) => string;
}) {
  const [message, setMessage] = useState("");

  const handleStatusChange = async (newStatus: string) => {
    if (!USE_API) {
      onUpdated({ ...complaint, status: newStatus as Complaint["status"] });
      return;
    }
    const { data } = await apiUpdateComplaintStatus(complaint.id, newStatus);
    if (data) {
      onUpdated({ ...complaint, status: newStatus as Complaint["status"] });
    }
  };

  const handleSendMessage = async () => {
    if (!message.trim()) return;
    await apiAddComplaintMessage(complaint.id, message.trim());
    setMessage("");
  };

  return (
    <Modal open onClose={onClose} title={`${t("complaint")} — ${complaint.id.substring(0, 8)}`}>
      <div className="space-y-[var(--space-3)]">
        <div className="flex items-center gap-2">
          <Badge variant={complaint.status === "open" ? "warning" : complaint.status === "resolved" ? "success" : "neutral"}>
            {complaint.status}
          </Badge>
          <Badge variant={complaint.priority === "urgent" ? "warning" : "neutral"}>
            {complaint.priority}
          </Badge>
        </div>
        <p className="text-sm text-[var(--text-secondary)]">{complaint.description}</p>
        <p className="text-xs text-[var(--text-tertiary)]">{complaint.date}</p>

        <div className="flex gap-2">
          {complaint.status === "open" && (
            <Button variant="primary" size="sm" onClick={() => handleStatusChange("in_progress")}>
              {t("complaintInProgress")}
            </Button>
          )}
          {(complaint.status === "open" || complaint.status === "in_progress") && (
            <Button variant="secondary" size="sm" onClick={() => handleStatusChange("resolved")}>
              {t("complaintResolved")}
            </Button>
          )}
        </div>

        <div className="flex gap-2">
          <Input
            placeholder={t("messagePlaceholder")}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            icon={<MessageSquare size={16} />}
          />
          <Button variant="primary" size="sm" icon={<Send size={16} />} onClick={handleSendMessage} disabled={!message.trim()}>
            {t("save")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Users Admin View ───────────────────────────────────────

function UsersView({ t }: { t: (key: TranslationKey) => string }) {
  const [users, setUsers] = useState<User[]>(USE_API ? [] : MOCK_USERS);

  useEffect(() => {
    if (!USE_API) return;
    apiGetUsers().then(({ data }) => {
      if (data) setUsers(data.map(apiUserToUser));
    });
  }, []);

  return (
    <div className="space-y-[var(--space-4)]">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-[var(--text-primary)]">{t("manageUsers")}</h2>
        <Button variant="primary" size="sm" icon={<UserPlus size={16} />}>
          {t("addUser")}
        </Button>
      </div>
      <div className="space-y-[var(--space-2)]">
        {users.map((user) => (
          <Card key={user.id}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-[var(--space-3)]">
                <div className="w-10 h-10 rounded-full bg-[var(--primary)] flex items-center justify-center text-[var(--on-primary)] font-semibold text-sm shrink-0">
                  {user.firstName[0]}{user.lastName[0]}
                </div>
                <div>
                  <p className="font-medium text-sm text-[var(--text-primary)]">
                    {user.firstName} {user.lastName}
                  </p>
                  <p className="text-xs text-[var(--text-tertiary)]">{user.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={user.role === "admin" ? "info" : "neutral"}>
                  {user.role === "admin" ? t("admin") : t("agent")}
                </Badge>
                <span className="text-xs text-[var(--text-tertiary)]">{user.zone}</span>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
