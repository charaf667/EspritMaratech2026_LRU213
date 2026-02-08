"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
  apiGetFamilies, apiFamilyToFamily, apiGetFamily, apiGetComplaints, apiComplaintToComplaint,
  apiGetUsers, apiUserToUser, apiCreateUser, apiUpdateUser, apiDeleteUser,
  apiAssignFamily, apiMergeFamily, apiComputeRoute,
  apiUpdateComplaintStatus, apiAssignComplaint, apiAddComplaintMessage,
  exportFamiliesCsvUrl, exportFamiliesXlsxUrl, exportVisitsCsvUrl, exportVisitsXlsxUrl,
  apiGenerateOpsBrief,
  type CreateUserPayload,
  type OpsBriefOutput, type OpsBriefSection, type OpsBriefAction, type OpsBriefAlert, type OpsBriefGenerateResponse,
} from "@/lib/api";
import type { TranslationKey } from "@/i18n";
import { Card, CardHeader, Badge, Button, Chip, Input, Modal, EmergenciesPanel } from "@/components/ds";
import type { BadgeVariant } from "@/components/ds";
import {
  TrendingUp, TrendingDown, Minus, Clock, AlertTriangle, CalendarCheck,
  Users, BarChart3, ShieldAlert, Database, ChevronRight, Search,
  UserPlus, Eye, Send, MessageSquare, Download, Activity,
  Route, MapPin, Ruler, Copy, CheckCircle2, GitMerge, Loader2, X, Brain, RefreshCw,
  ExternalLink, Info, AlertCircle, Zap, Trash2, Edit3, Save,
} from "lucide-react";

const PRIORITY_BADGE: Record<Priority, BadgeVariant> = {
  overdue: "critical", urgent: "warning", normal: "neutral",
};

export default function AdminDashboardPage() {
  const { t } = useI18n();
  const { hasRole } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const section = searchParams.get("section") || "dashboard";

  if (!hasRole("admin")) {
    return (
      <div className="flex items-center justify-center flex-1 p-8">
        <p className="text-[var(--text-secondary)]">{t("adminOnly")}</p>
      </div>
    );
  }

  return (
    <div className="flex-1 p-6 lg:p-8 space-y-6" role="region" aria-label={t("sidebarDashboard")}>
      {section === "dashboard" && <DashboardView t={t} />}
      {section === "families" && <FamiliesView t={t} router={router} />}
      {section === "users" && <UsersView t={t} />}
      {section === "complaints" && <ComplaintsFullView t={t} />}
      {section === "emergencies" && <EmergenciesPanel />}
      {section === "planner" && <MissionPlannerView t={t} />}
      {section === "duplicates" && <DuplicateMergeView t={t} />}
      {section === "ops-brief" && <OpsBriefView t={t} />}
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
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">{t("sidebarDashboard")}</h1>
        <p className="text-sm text-[var(--text-tertiary)] mt-1 a11y-secondary">{t("appSubtitle")}</p>
      </div>

      {/* KPI Cards — full width row */}
      <section aria-label="KPI">
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          <KPICard label={t("kpiOverdue")} value={kpis.overdue} trend={kpis.overdueTrend} icon={<Clock size={20} />} variant="critical" />
          <KPICard label={t("kpiUrgent")} value={kpis.urgent} trend={kpis.urgentTrend} icon={<AlertTriangle size={20} />} variant="warning" />
          <KPICard label={t("kpiVisits7d")} value={kpis.visitsLast7d} trend={kpis.visitsTrend} icon={<CalendarCheck size={20} />} variant="success" />
          <KPICard label={t("kpiNewFamilies")} value={kpis.newFamilies7d} trend={kpis.newFamiliesTrend} icon={<UserPlus size={20} />} variant="info" />
        </div>
      </section>

      {/* SLA + Workload row */}
      <section aria-label="SLA">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* SLA gauge — takes 1 col */}
          <Card>
            <CardHeader>
              <h3 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
                <Activity size={16} className="text-[var(--success)]" />
                SLA — {t("kpiVisits7d")}
              </h3>
            </CardHeader>
            <div className="flex flex-col items-center py-4">
              <div className="relative w-28 h-28">
                <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90" aria-hidden="true">
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--bg-tertiary)" strokeWidth="3" />
                  <circle cx="18" cy="18" r="15.9" fill="none"
                    stroke={slaPct >= 80 ? "var(--success)" : slaPct >= 60 ? "var(--warning)" : "var(--critical)"}
                    strokeWidth="3" strokeDasharray={`${slaPct} ${100 - slaPct}`} strokeLinecap="round"
                    className="transition-all duration-700"
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-2xl font-bold"
                  style={{ color: slaPct >= 80 ? "var(--success)" : slaPct >= 60 ? "var(--warning)" : "var(--critical)" }}>
                  {slaPct}%
                </span>
              </div>
            </div>
          </Card>

          {/* Agent Workload — takes 2 cols */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <h3 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
                <Users size={16} className="text-[var(--primary)]" />
                {t("agentWorkload")}
              </h3>
            </CardHeader>
            {workload.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm" role="table">
                  <thead>
                    <tr className="border-b border-[var(--border-default)]">
                      <th className="text-start p-2.5 text-[var(--text-secondary)] font-medium text-xs uppercase tracking-wider">{t("agentCol")}</th>
                      <th className="text-end p-2.5 text-[var(--text-secondary)] font-medium text-xs uppercase tracking-wider">{t("familiesCol")}</th>
                      <th className="text-end p-2.5 text-[var(--text-secondary)] font-medium text-xs uppercase tracking-wider">{t("overdueCol")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {workload.map((w) => (
                      <tr key={w.agent_id} className="border-b border-[var(--border-subtle)] hover:bg-[var(--bg-secondary)] transition-colors">
                        <td className="p-2.5 text-[var(--text-primary)] font-medium">{w.agent_name}</td>
                        <td className="p-2.5 text-end text-[var(--text-primary)]">{w.families_count}</td>
                        <td className="p-2.5 text-end">
                          <Badge variant={w.overdue_count > 0 ? "critical" : "success"}>{w.overdue_count}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-[var(--text-tertiary)] py-4 text-center">{t("noResults")}</p>
            )}
          </Card>
        </div>
      </section>

      {/* 2-column grid: left = critical queue + complaints, right = aids + data quality */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left column */}
        <div className="space-y-4">
          {/* Critical Queue */}
          <section aria-label={t("criticalQueue")}>
            <Card>
              <CardHeader>
                <h3 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
                  <ShieldAlert size={16} className="text-[var(--critical)]" />
                  {t("criticalQueue")}
                  <Badge variant="critical">{criticalQueue.length}</Badge>
                </h3>
              </CardHeader>
              <div className="space-y-1.5 max-h-80 overflow-y-auto">
                {criticalQueue.map((family) => (
                  <div key={family.id}
                    className="flex items-center justify-between p-3 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-secondary)] hover:bg-[color-mix(in_srgb,var(--bg-secondary)_90%,var(--primary)_10%)] transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-medium text-sm text-[var(--text-primary)] truncate">
                          {t("family")} {family.name}
                        </span>
                        <Badge variant={PRIORITY_BADGE[family.priority]}>{t(family.priority)}</Badge>
                      </div>
                      <p className="a11y-secondary text-xs text-[var(--text-tertiary)] truncate">{family.address}</p>
                    </div>
                    <div className="flex gap-1 shrink-0 ms-2">
                      <Button variant="ghost" size="sm" onClick={() => openAssignModal(family.id)}>{t("assign")}</Button>
                      <Button variant="ghost" size="sm">{t("open")}</Button>
                    </div>
                  </div>
                ))}
                {criticalQueue.length === 0 && (
                  <p className="text-sm text-[var(--text-tertiary)] py-4 text-center">{t("noResults")}</p>
                )}
              </div>
            </Card>
          </section>

          {/* Complaints mini */}
          <section aria-label={t("complaints")}>
            <Card>
              <CardHeader>
                <h3 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
                  <AlertTriangle size={16} className="text-[var(--warning)]" />
                  {t("complaints")}
                  <Badge variant="warning">{complaints.length}</Badge>
                </h3>
              </CardHeader>
              <ComplaintsPanel t={t} allComplaints={complaints.slice(0, 5)} onSelect={setSelectedComplaint} />
            </Card>
          </section>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Aids distribution */}
          <section aria-label={t("topAids")}>
            <Card>
              <CardHeader>
                <h3 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
                  <BarChart3 size={16} className="text-[var(--primary)]" />
                  {t("topAids")}
                </h3>
              </CardHeader>
              <div className="space-y-3">
                {aidDistribution.map((item, idx) => {
                  const maxCount = aidDistribution[0]?.count ?? 1;
                  const pct = Math.round((item.count / maxCount) * 100);
                  const colors = ["var(--primary)", "var(--info)", "var(--success)", "var(--warning)", "var(--critical)"];
                  const barColor = colors[idx % colors.length];
                  return (
                    <div key={item.aidId}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-[var(--text-primary)] font-medium">{idx + 1}. {item.label}</span>
                        <span className="text-[var(--text-secondary)] font-semibold">{item.count}</span>
                      </div>
                      <div className="w-full h-2.5 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${pct}%`, backgroundColor: barColor }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </section>

          {/* Data Quality */}
          <section aria-label={t("dataQuality")}>
            <Card>
              <CardHeader>
                <h3 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
                  <Database size={16} className="text-[var(--info)]" />
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
              }} onIgnore={(idx) => {
                setDataQuality((prev) => ({
                  ...prev,
                  suspectedDuplicates: Math.max(0, prev.suspectedDuplicates - 1),
                  duplicates: prev.duplicates.filter((_, i) => i !== idx),
                }));
              }} />
            </Card>
          </section>
        </div>
      </div>

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
    </div>
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

function DataQualityPanel({ t, dq, onMerge, onIgnore }: { t: (key: TranslationKey) => string; dq: DataQuality; onMerge?: (targetId: string, sourceId: string) => Promise<void>; onIgnore?: (idx: number) => void }) {
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
                <Button variant="ghost" size="sm" onClick={() => onIgnore?.(idx)}>{t("ignore")}</Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Complaints Full View ───────────────────────────────────

function ComplaintsFullView({ t }: { t: (key: TranslationKey) => string }) {
  const [complaints, setComplaints] = useState<Complaint[]>(USE_API ? [] : MOCK_COMPLAINTS);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);

  useEffect(() => {
    if (!USE_API) return;
    apiGetComplaints().then(({ data }) => {
      if (data?.results) setComplaints(data.results.map(apiComplaintToComplaint));
    });
    apiGetUsers().then(({ data }) => {
      if (data) setUsers(data.map(apiUserToUser));
    });
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">{t("sidebarComplaints")}</h1>
      </div>
      <Card>
        <ComplaintsPanel t={t} allComplaints={complaints} onSelect={setSelectedComplaint} />
      </Card>
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
  const [familiesLoading, setFamiliesLoading] = useState(USE_API);
  const [familiesError, setFamiliesError] = useState<string | null>(null);

  useEffect(() => {
    if (!USE_API) return;
    setFamiliesLoading(true);
    setFamiliesError(null);
    const params: Record<string, string> | undefined = search.trim() ? { search: search.trim() } : undefined;
    apiGetFamilies(params).then(({ data, error }) => {
      if (data?.results) {
        setAllFamilies(data.results.map(apiFamilyToFamily));
      } else if (error) {
        setFamiliesError(error);
      }
      setFamiliesLoading(false);
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
    <div className="space-y-6" role="region" aria-label={t("sidebarFamilies")}>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">{t("sidebarFamilies")}</h1>
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
      {familiesLoading && (
        <div className="flex items-center justify-center py-12 gap-2 text-[var(--text-tertiary)]">
          <Loader2 size={20} className="animate-spin" />
          {t("loading")}
        </div>
      )}
      {familiesError && (
        <div className="p-4 rounded-[var(--radius-md)] bg-[color-mix(in_srgb,var(--critical)_8%,transparent)] border border-[var(--critical)] text-sm text-[var(--critical)]" role="alert">
          {familiesError}
        </div>
      )}
      {!familiesLoading && !familiesError && families.length === 0 && (
        <div className="text-center py-12 text-[var(--text-tertiary)]">{t("noResults")}</div>
      )}
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
                  <Button variant="ghost" size="sm" icon={<Eye size={16} />} onClick={() => router.push(`/app?family=${family.id}`)}>{t("open")}</Button>
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
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>(USE_API ? [] : MOCK_USERS);
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRole, setEditRole] = useState<string>("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Add form state
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newFirstName, setNewFirstName] = useState("");
  const [newLastName, setNewLastName] = useState("");
  const [newRole, setNewRole] = useState<"agent" | "admin">("agent");

  const loadUsers = () => {
    if (!USE_API) return;
    apiGetUsers().then(({ data }) => {
      if (data) setUsers(data.map(apiUserToUser));
    });
  };

  useEffect(() => { loadUsers(); }, []);

  const handleCreate = async () => {
    if (!newEmail || !newPassword || !newFirstName || !newLastName) {
      setError("Tous les champs sont obligatoires.");
      return;
    }
    setSaving(true);
    setError(null);
    const { data, error: err } = await apiCreateUser({
      email: newEmail, password: newPassword,
      first_name: newFirstName, last_name: newLastName, role: newRole,
    });
    setSaving(false);
    if (err) { setError(err); return; }
    setShowAdd(false);
    setNewEmail(""); setNewPassword(""); setNewFirstName(""); setNewLastName(""); setNewRole("agent");
    loadUsers();
  };

  const handleUpdateRole = async (userId: string) => {
    setSaving(true);
    await apiUpdateUser(userId, { role: editRole });
    setSaving(false);
    setEditingId(null);
    loadUsers();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setSaving(true);
    const { error: err } = await apiDeleteUser(deleteId);
    setSaving(false);
    if (err) { setError(err); setDeleteId(null); return; }
    setDeleteId(null);
    loadUsers();
  };

  const userToDelete = users.find((u) => u.id === deleteId);

  return (
    <div className="space-y-6" role="region" aria-label={t("sidebarUsers")}>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">{t("sidebarUsers")}</h1>
        <Button variant="primary" size="sm" icon={<UserPlus size={16} />} onClick={() => { setShowAdd(true); setError(null); }}>
          {t("addUser")}
        </Button>
      </div>

      {error && !showAdd && !deleteId && (
        <div className="p-3 rounded-[var(--radius-md)] bg-[var(--critical-light)] text-[var(--critical)] text-sm">{error}</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {users.map((user) => {
          const isEditing = editingId === user.id;
          const isSelf = user.id === currentUser?.id;
          return (
            <Card key={user.id}>
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-[var(--primary)] flex items-center justify-center text-[var(--on-primary)] font-semibold text-sm shrink-0">
                  {user.firstName?.[0] ?? ""}{user.lastName?.[0] ?? ""}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-[var(--text-primary)] truncate">
                    {user.firstName} {user.lastName}
                  </p>
                  <p className="text-xs text-[var(--text-tertiary)] truncate">{user.email}</p>
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  {isEditing ? (
                    <div className="flex items-center gap-1">
                      <select
                        value={editRole}
                        onChange={(e) => setEditRole(e.target.value)}
                        className="text-xs border border-[var(--border-default)] rounded-[var(--radius-sm)] px-1.5 py-1 bg-[var(--bg-primary)] text-[var(--text-primary)]"
                      >
                        <option value="agent">Agent</option>
                        <option value="admin">Admin</option>
                      </select>
                      <button onClick={() => handleUpdateRole(user.id)} disabled={saving} className="p-1 rounded hover:bg-[var(--bg-secondary)] text-[var(--success)] cursor-pointer" title="Sauvegarder">
                        <Save size={14} />
                      </button>
                      <button onClick={() => setEditingId(null)} className="p-1 rounded hover:bg-[var(--bg-secondary)] text-[var(--text-tertiary)] cursor-pointer" title="Annuler">
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <Badge variant={user.role === "admin" ? "info" : "neutral"}>
                      {user.role === "admin" ? t("admin") : t("agent")}
                    </Badge>
                  )}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => { setEditingId(user.id); setEditRole(user.role); }}
                      className="p-1 rounded hover:bg-[var(--bg-secondary)] text-[var(--text-tertiary)] hover:text-[var(--primary)] cursor-pointer transition-colors"
                      title="Modifier le rôle"
                    >
                      <Edit3 size={14} />
                    </button>
                    {!isSelf && (
                      <button
                        onClick={() => { setDeleteId(user.id); setError(null); }}
                        className="p-1 rounded hover:bg-[var(--bg-secondary)] text-[var(--text-tertiary)] hover:text-[var(--critical)] cursor-pointer transition-colors"
                        title="Supprimer"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* ── Add User Modal ── */}
      {showAdd && (
        <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Nouvel utilisateur">
          <div className="space-y-4">
            {error && (
              <div className="p-3 rounded-[var(--radius-md)] bg-[var(--critical-light)] text-[var(--critical)] text-sm">{error}</div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Prénom</label>
                <input
                  value={newFirstName} onChange={(e) => setNewFirstName(e.target.value)}
                  className="w-full px-3 py-2 border border-[var(--border-default)] rounded-[var(--radius-md)] bg-[var(--bg-primary)] text-sm text-[var(--text-primary)]"
                  placeholder="Sara"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Nom</label>
                <input
                  value={newLastName} onChange={(e) => setNewLastName(e.target.value)}
                  className="w-full px-3 py-2 border border-[var(--border-default)] rounded-[var(--radius-md)] bg-[var(--bg-primary)] text-sm text-[var(--text-primary)]"
                  placeholder="Mansouri"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Email</label>
              <input
                type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)}
                className="w-full px-3 py-2 border border-[var(--border-default)] rounded-[var(--radius-md)] bg-[var(--bg-primary)] text-sm text-[var(--text-primary)]"
                placeholder="sara@omnia.org"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Mot de passe</label>
              <input
                type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3 py-2 border border-[var(--border-default)] rounded-[var(--radius-md)] bg-[var(--bg-primary)] text-sm text-[var(--text-primary)]"
                placeholder="••••••••"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Rôle</label>
              <select
                value={newRole} onChange={(e) => setNewRole(e.target.value as "agent" | "admin")}
                className="w-full px-3 py-2 border border-[var(--border-default)] rounded-[var(--radius-md)] bg-[var(--bg-primary)] text-sm text-[var(--text-primary)]"
              >
                <option value="agent">Agent</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" size="sm" onClick={() => setShowAdd(false)}>Annuler</Button>
              <Button variant="primary" size="sm" icon={saving ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />} onClick={handleCreate} disabled={saving}>
                {saving ? "Création..." : "Créer"}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Delete Confirmation Modal ── */}
      {deleteId && userToDelete && (
        <Modal open={!!deleteId} onClose={() => setDeleteId(null)} title="Confirmer la suppression">
          <div className="space-y-4">
            {error && (
              <div className="p-3 rounded-[var(--radius-md)] bg-[var(--critical-light)] text-[var(--critical)] text-sm">{error}</div>
            )}
            <p className="text-sm text-[var(--text-secondary)]">
              Voulez-vous vraiment supprimer <strong>{userToDelete.firstName} {userToDelete.lastName}</strong> ({userToDelete.email}) ?
              Cette action est irréversible.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => setDeleteId(null)}>Annuler</Button>
              <Button
                variant="primary" size="sm"
                icon={saving ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                onClick={handleDelete} disabled={saving}
                className="!bg-[var(--critical)] hover:!bg-[color-mix(in_srgb,var(--critical)_85%,black)]"
              >
                {saving ? "Suppression..." : "Supprimer"}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Mission Planner View ──────────────────────────────────

function MissionPlannerView({ t }: { t: (key: TranslationKey) => string }) {
  const [families, setFamilies] = useState<Family[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [computing, setComputing] = useState(false);
  const [filterZone, setFilterZone] = useState("");
  const [filterPriority, setFilterPriority] = useState("");
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [result, setResult] = useState<{
    orderedFamilies: Family[];
    distanceKm: number | null;
    durationMin: number | null;
  } | null>(null);

  useEffect(() => {
    if (!USE_API) {
      setFamilies(MOCK_FAMILIES);
      setUsers(MOCK_USERS);
      return;
    }
    const params: Record<string, string> = { page_size: "100" };
    if (filterZone) params.zone = filterZone;
    if (filterPriority) params.priority = filterPriority;
    apiGetFamilies(params).then(({ data }) => {
      if (data?.results) setFamilies(data.results.map(apiFamilyToFamily));
    });
    apiGetUsers().then(({ data }) => {
      if (data) setUsers(data.map(apiUserToUser));
    });
  }, [filterZone, filterPriority]);

  const selectedFamilies = families.filter((f) => selectedIds.has(f.id));
  const zones = [...new Set(families.map((f) => f.zone).filter(Boolean))];

  const toggleFamily = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
    setResult(null);
  };

  const selectAll = () => {
    setSelectedIds(new Set(families.map((f) => f.id)));
    setResult(null);
  };

  const deselectAll = () => {
    setSelectedIds(new Set());
    setResult(null);
  };

  const handleCompute = async () => {
    if (selectedFamilies.length < 2) return;
    setComputing(true);

    const points = selectedFamilies.map((f) => ({ lat: f.lat, lng: f.lng, label: f.name }));

    if (!USE_API) {
      const ordered = [...selectedFamilies].sort((a, b) => {
        const order: Record<Priority, number> = { overdue: 0, urgent: 1, normal: 2 };
        return order[a.priority] - order[b.priority];
      });
      setResult({
        orderedFamilies: ordered,
        distanceKm: Math.round(ordered.length * 2.3 * 10) / 10,
        durationMin: Math.round(ordered.length * 8),
      });
      setComputing(false);
      return;
    }

    const { data } = await apiComputeRoute(points);
    setComputing(false);
    if (data) {
      const orderedFamilies = data.points.map((p) =>
        selectedFamilies.find((f) => Math.abs(f.lat - p.lat) < 0.0001 && Math.abs(f.lng - p.lng) < 0.0001) ?? selectedFamilies[0]
      );
      setResult({
        orderedFamilies,
        distanceKm: data.total_distance_km,
        durationMin: data.total_duration_min,
      });
    }
  };

  const handleExport = () => {
    if (!result) return;
    const lines = result.orderedFamilies.map((f, i) =>
      `${i + 1}. ${f.name} — ${f.address} (${t(f.priority)})`
    );
    const header = `${t("missionPlanner")} — ${result.distanceKm ?? "?"} km, ${result.durationMin ?? "?"} min`;
    const text = [header, "", ...lines].join("\n");
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleAssign = async (userId: string) => {
    if (!result) return;
    for (const f of result.orderedFamilies) {
      await apiAssignFamily(f.id, userId);
    }
    setAssignModalOpen(false);
  };

  return (
    <div className="space-y-6" role="region" aria-label={t("missionPlanner")}>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-[var(--text-primary)] flex items-center gap-2">
          <Route size={24} className="text-[var(--primary)]" />
          {t("missionPlanner")}
        </h1>
        <div className="flex gap-2">
          {result && (
            <>
              <Button variant="secondary" size="sm" icon={<Copy size={16} />} onClick={handleExport}>
                {copied ? t("plannerCopied") : t("plannerExport")}
              </Button>
              <Button variant="primary" size="sm" icon={<UserPlus size={16} />} onClick={() => setAssignModalOpen(true)}>
                {t("plannerAssign")}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={filterPriority}
          onChange={(e) => setFilterPriority(e.target.value)}
          className="px-3 py-2 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-raised)] text-sm text-[var(--text-primary)] min-h-[var(--touch-target-min)]"
          aria-label={t("plannerFilterPriority")}
        >
          <option value="">{t("plannerFilterPriority")}: {t("complaintAll")}</option>
          <option value="overdue">{t("overdue")}</option>
          <option value="urgent">{t("urgent")}</option>
          <option value="normal">{t("normal")}</option>
        </select>
        <select
          value={filterZone}
          onChange={(e) => setFilterZone(e.target.value)}
          className="px-3 py-2 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-raised)] text-sm text-[var(--text-primary)] min-h-[var(--touch-target-min)]"
          aria-label={t("plannerFilterZone")}
        >
          <option value="">{t("plannerFilterZone")}: {t("complaintAll")}</option>
          {zones.map((z) => <option key={z} value={z}>{z}</option>)}
        </select>
        <div className="flex gap-2 ms-auto">
          <Button variant="ghost" size="sm" onClick={selectAll}>{t("plannerSelectAll")}</Button>
          <Button variant="ghost" size="sm" onClick={deselectAll}>{t("plannerDeselectAll")}</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Family selection list */}
        <div className="space-y-2 max-h-[60vh] overflow-y-auto">
          <p className="text-sm text-[var(--text-secondary)] mb-2">
            {selectedIds.size} / {families.length} {t("families").toLowerCase()}
          </p>
          {families.map((f) => {
            const selected = selectedIds.has(f.id);
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => toggleFamily(f.id)}
                className={`w-full text-start p-[var(--space-3)] rounded-[var(--radius-md)] border cursor-pointer transition-colors min-h-[var(--touch-target-min)] flex items-center gap-3 ${
                  selected
                    ? "border-[var(--primary)] bg-[color-mix(in_srgb,var(--primary)_8%,transparent)]"
                    : "border-[var(--border-subtle)] bg-[var(--surface-raised)] hover:bg-[var(--bg-secondary)]"
                }`}
              >
                <input type="checkbox" checked={selected} readOnly className="w-5 h-5 shrink-0 accent-[var(--primary)] pointer-events-none" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-[var(--text-primary)] truncate">{f.name}</span>
                    <Badge variant={PRIORITY_BADGE[f.priority]}>{t(f.priority)}</Badge>
                  </div>
                  <p className="text-xs text-[var(--text-tertiary)] truncate">{f.address} — {f.zone}</p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Route result */}
        <div className="space-y-4">
          <Button
            variant="primary"
            size="md"
            className="w-full"
            disabled={selectedIds.size < 2 || computing}
            onClick={handleCompute}
            icon={computing ? <Loader2 size={18} className="animate-spin" /> : <Route size={18} />}
          >
            {computing ? "..." : t("plannerCompute")}
          </Button>

          {result && (
            <Card>
              <div className="flex gap-6 mb-4">
                {result.distanceKm != null && (
                  <div className="flex items-center gap-2 text-sm">
                    <Ruler size={18} className="text-[var(--primary)]" />
                    <div>
                      <p className="font-bold text-lg text-[var(--text-primary)]">{result.distanceKm} km</p>
                      <p className="text-xs text-[var(--text-tertiary)]">{t("plannerTotalDistance")}</p>
                    </div>
                  </div>
                )}
                {result.durationMin != null && (
                  <div className="flex items-center gap-2 text-sm">
                    <Clock size={18} className="text-[var(--primary)]" />
                    <div>
                      <p className="font-bold text-lg text-[var(--text-primary)]">{result.durationMin} min</p>
                      <p className="text-xs text-[var(--text-tertiary)]">{t("plannerTotalDuration")}</p>
                    </div>
                  </div>
                )}
              </div>

              <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-3">
                {t("plannerStops")} ({result.orderedFamilies.length})
              </h3>
              <ol className="space-y-2">
                {result.orderedFamilies.map((f, idx) => (
                  <li key={f.id} className="flex items-center gap-3 text-sm">
                    <span className="w-7 h-7 rounded-full bg-[var(--primary)] text-[var(--on-primary)] flex items-center justify-center text-xs font-bold shrink-0">
                      {idx + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-[var(--text-primary)] truncate">{f.name}</p>
                      <p className="text-xs text-[var(--text-tertiary)] truncate">{f.address}</p>
                    </div>
                    <Badge variant={PRIORITY_BADGE[f.priority]}>{t(f.priority)}</Badge>
                  </li>
                ))}
              </ol>
            </Card>
          )}
        </div>
      </div>

      {/* Assign Modal */}
      <Modal open={assignModalOpen} onClose={() => setAssignModalOpen(false)} title={t("plannerAssign")}>
        <div className="space-y-2">
          {users.filter((u) => u.role === "agent").map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => handleAssign(u.id)}
              className="w-full text-start p-[var(--space-3)] rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] hover:bg-[var(--bg-secondary)] cursor-pointer transition-colors min-h-[var(--touch-target-min)]"
            >
              <p className="font-medium text-sm text-[var(--text-primary)]">{u.firstName} {u.lastName}</p>
              <p className="text-xs text-[var(--text-tertiary)]">{u.email}</p>
            </button>
          ))}
        </div>
      </Modal>
    </div>
  );
}

// ─── Duplicate Merge View ──────────────────────────────────

interface DuplicatePair {
  familyA: string;
  familyAName: string;
  familyB: string;
  familyBName: string;
  similarity: number;
  reason: string;
}

function DuplicateMergeView({ t }: { t: (key: TranslationKey) => string }) {
  const [duplicates, setDuplicates] = useState<DuplicatePair[]>([]);
  const [loading, setLoading] = useState(true);
  const [compareIdx, setCompareIdx] = useState<number | null>(null);
  const [familyADetail, setFamilyADetail] = useState<Family | null>(null);
  const [familyBDetail, setFamilyBDetail] = useState<Family | null>(null);
  const [merging, setMerging] = useState(false);
  const [mergeSuccess, setMergeSuccess] = useState(false);
  const [ignored, setIgnored] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!USE_API) {
      setDuplicates([
        { familyA: "fam-001", familyAName: "Ben Ali", familyB: "fam-003", familyBName: "Ben Aly", similarity: 0.87, reason: "Nom similaire + même zone" },
        { familyA: "fam-002", familyAName: "Trabelsi", familyB: "fam-005", familyBName: "Trabelsi Mohamed", similarity: 0.92, reason: "Même téléphone + nom similaire" },
      ]);
      setLoading(false);
      return;
    }
    apiGetDashboard().then(({ data }) => {
      if (data?.suspected_duplicates) {
        setDuplicates(data.suspected_duplicates.map((d) => ({
          familyA: d.family_a,
          familyAName: d.family_a_name,
          familyB: d.family_b,
          familyBName: d.family_b_name,
          similarity: d.similarity,
          reason: d.reason,
        })));
      }
      setLoading(false);
    });
  }, []);

  const handleCompare = async (idx: number) => {
    setCompareIdx(idx);
    setMergeSuccess(false);
    const pair = duplicates[idx];

    if (!USE_API) {
      const mockA = MOCK_FAMILIES.find((f) => f.id === pair.familyA) ?? MOCK_FAMILIES[0];
      const mockB = MOCK_FAMILIES.find((f) => f.id === pair.familyB) ?? MOCK_FAMILIES[1];
      setFamilyADetail(mockA);
      setFamilyBDetail(mockB);
      return;
    }

    const [resA, resB] = await Promise.all([
      apiGetFamily(pair.familyA),
      apiGetFamily(pair.familyB),
    ]);
    if (resA.data) setFamilyADetail(apiFamilyToFamily(resA.data));
    if (resB.data) setFamilyBDetail(apiFamilyToFamily(resB.data));
  };

  const handleMerge = async (targetId: string, sourceId: string) => {
    setMerging(true);
    if (USE_API) {
      const { error } = await apiMergeFamily(targetId, sourceId);
      if (!error) {
        setMergeSuccess(true);
        setDuplicates((prev) => prev.filter((_, i) => i !== compareIdx));
        setTimeout(() => { setCompareIdx(null); setMergeSuccess(false); }, 1500);
      }
    } else {
      setMergeSuccess(true);
      setDuplicates((prev) => prev.filter((_, i) => i !== compareIdx));
      setTimeout(() => { setCompareIdx(null); setMergeSuccess(false); }, 1500);
    }
    setMerging(false);
  };

  const handleIgnore = (idx: number) => {
    setIgnored((prev) => new Set(prev).add(idx));
  };

  const visibleDuplicates = duplicates.filter((_, i) => !ignored.has(i));

  return (
    <div className="space-y-6" role="region" aria-label={t("duplicateMerge")}>
      <h1 className="text-2xl font-bold text-[var(--text-primary)] flex items-center gap-2">
        <GitMerge size={24} className="text-[var(--primary)]" />
        {t("duplicateMerge")}
      </h1>

      {loading ? (
        <div className="text-center py-12 text-[var(--text-tertiary)]">{t("loading")}</div>
      ) : visibleDuplicates.length === 0 ? (
        <Card>
          <div className="text-center py-8">
            <CheckCircle2 size={48} className="mx-auto mb-3 text-[var(--success)]" />
            <p className="text-lg font-medium text-[var(--text-primary)]">{t("duplicateNone")}</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {visibleDuplicates.map((pair, idx) => {
            const realIdx = duplicates.indexOf(pair);
            return (
              <Card key={`${pair.familyA}-${pair.familyB}`}>
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-[var(--text-primary)]">{pair.familyAName}</span>
                      <span className="text-[var(--text-tertiary)]">↔</span>
                      <span className="font-semibold text-[var(--text-primary)]">{pair.familyBName}</span>
                    </div>
                    <p className="text-xs text-[var(--text-tertiary)]">{pair.reason}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-center">
                      <p className="text-lg font-bold text-[var(--warning)]">{pair.similarity > 1 ? Math.round(pair.similarity) : Math.round(pair.similarity * 100)}%</p>
                      <p className="text-xs text-[var(--text-tertiary)]">{t("similarity")}</p>
                    </div>
                    <Button variant="secondary" size="sm" icon={<Eye size={16} />} onClick={() => handleCompare(realIdx)}>
                      {t("duplicateCompare")}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleIgnore(realIdx)}>
                      {t("duplicateIgnore")}
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Compare Modal */}
      {compareIdx !== null && familyADetail && familyBDetail && (
        <Modal
          open={true}
          onClose={() => { setCompareIdx(null); setFamilyADetail(null); setFamilyBDetail(null); }}
          title={t("duplicateCompare")}
        >
          {mergeSuccess ? (
            <div className="text-center py-8">
              <CheckCircle2 size={48} className="mx-auto mb-3 text-[var(--success)]" />
              <p className="text-lg font-medium text-[var(--success)]">{t("duplicateMergeSuccess")}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Side-by-side compare table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-[var(--border-default)]">
                      <th className="text-start p-2 text-[var(--text-tertiary)] font-medium">{t("duplicateField")}</th>
                      <th className="text-start p-2 text-[var(--text-primary)] font-medium">{t("duplicateValueA")}</th>
                      <th className="text-start p-2 text-[var(--text-primary)] font-medium">{t("duplicateValueB")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {([
                      [t("headName"), familyADetail.name, familyBDetail.name],
                      [t("phone"), familyADetail.phone, familyBDetail.phone],
                      [t("address"), familyADetail.address, familyBDetail.address],
                      [t("zone"), familyADetail.zone, familyBDetail.zone],
                      [t("members"), String(familyADetail.membersCount), String(familyBDetail.membersCount)],
                      [t("lastVisit"), familyADetail.lastVisit, familyBDetail.lastVisit],
                      [t("priority"), t(familyADetail.priority), t(familyBDetail.priority)],
                    ] as [string, string, string][]).map(([label, valA, valB]) => (
                      <tr key={label} className="border-b border-[var(--border-subtle)]">
                        <td className="p-2 text-[var(--text-tertiary)]">{label}</td>
                        <td className={`p-2 ${valA !== valB ? "text-[var(--warning)] font-medium" : "text-[var(--text-primary)]"}`}>{valA || "—"}</td>
                        <td className={`p-2 ${valA !== valB ? "text-[var(--warning)] font-medium" : "text-[var(--text-primary)]"}`}>{valB || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Warning */}
              <div className="flex items-start gap-2 p-3 rounded-[var(--radius-md)] bg-[color-mix(in_srgb,var(--warning)_10%,transparent)] border border-[var(--warning)]">
                <AlertTriangle size={18} className="text-[var(--warning)] shrink-0 mt-0.5" />
                <p className="text-sm text-[var(--text-primary)]">{t("duplicateMergeWarning")}</p>
              </div>

              {/* Merge actions */}
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="primary"
                  size="md"
                  disabled={merging}
                  icon={merging ? <Loader2 size={16} className="animate-spin" /> : <GitMerge size={16} />}
                  onClick={() => handleMerge(familyADetail.id, familyBDetail.id)}
                >
                  {t("duplicateTarget")}: {familyADetail.name}
                </Button>
                <Button
                  variant="secondary"
                  size="md"
                  disabled={merging}
                  icon={merging ? <Loader2 size={16} className="animate-spin" /> : <GitMerge size={16} />}
                  onClick={() => handleMerge(familyBDetail.id, familyADetail.id)}
                >
                  {t("duplicateTarget")}: {familyBDetail.name}
                </Button>
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}

// ─── AI Ops Brief View ────────────────────────────────────────

const SEVERITY_BADGE: Record<string, BadgeVariant> = {
  critical: "critical",
  warning: "warning",
  info: "neutral",
};

const SEVERITY_ICON: Record<string, typeof AlertCircle> = {
  critical: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

function OpsBriefView({ t }: { t: (key: TranslationKey) => string }) {
  const [brief, setBrief] = useState<OpsBriefOutput | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFallback, setIsFallback] = useState(false);
  const [timingMs, setTimingMs] = useState<number | null>(null);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    setBrief(null);
    setIsFallback(false);
    setTimingMs(null);

    try {
      if (!USE_API) {
        // Mock mode: generate a deterministic mock brief
        await new Promise((r) => setTimeout(r, 800));
        const mockBrief: OpsBriefOutput = {
          meta: {
            generated_at: new Date().toISOString(),
            window_hours: 24,
            lang: "fr",
            model: "mock-deterministic",
          },
          summary: "Briefing mock: 3 familles en retard, 1 urgence active, 2 plaintes ouvertes. Aucun doublon détecté.",
          sections: [
            {
              title: "Familles en retard",
              bullets: [
                { text: "Famille Trabelsi — retard de 15 jours", severity: "critical", citations: ["fam:d426ba4e"] },
                { text: "Famille Hamdi — retard de 8 jours", severity: "critical", citations: ["fam:aaa2b777"] },
              ],
            },
            {
              title: "Urgences",
              bullets: [
                { text: "Famille Bouazizi — marquée urgente (médicaments)", severity: "warning", citations: ["fam:8a7af58b"] },
              ],
            },
          ],
          actions: [
            {
              title: "Planifier visite Trabelsi",
              why: "Retard critique de 15 jours",
              priority: 1,
              target_url: "/app/admin?section=families&id=d426ba4e",
              citations: ["fam:d426ba4e"],
            },
            {
              title: "Traiter urgence Bouazizi",
              why: "Médicaments urgents nécessaires",
              priority: 2,
              target_url: "/app/admin?section=families&id=8a7af58b",
              citations: ["fam:8a7af58b"],
            },
          ],
          alerts: [
            {
              level: "critical",
              message: "3 familles en retard nécessitent une attention immédiate.",
              citations: ["fam:d426ba4e", "fam:aaa2b777"],
            },
          ],
        };
        setBrief(mockBrief);
        setIsFallback(false);
        setTimingMs(800);
        setLoading(false);
        return;
      }

      const { data, error: apiErr } = await apiGenerateOpsBrief(24, "fr");
      if (apiErr || !data) {
        setError(apiErr || t("opsBriefError"));
        setLoading(false);
        return;
      }
      setBrief(data.output);
      setIsFallback(data.fallback);
      setTimingMs(data.timing_ms ?? null);
      if (data.error) setError(data.error);
    } catch (e) {
      setError(t("opsBriefError"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Brain size={28} className="text-[var(--primary)]" />
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">{t("opsBriefTitle")}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={handleGenerate}
            disabled={loading}
            className="flex items-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                {t("opsBriefGenerating")}
              </>
            ) : brief ? (
              <>
                <RefreshCw size={16} />
                {t("opsBriefRegenerate")}
              </>
            ) : (
              <>
                <Zap size={16} />
                {t("opsBriefGenerate")}
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Error banner */}
      {error && !brief && (
        <div className="rounded-[var(--radius-lg)] border border-[var(--error)] bg-[color-mix(in_srgb,var(--error)_8%,transparent)] p-4 flex items-center gap-3">
          <AlertCircle size={20} className="text-[var(--error)] shrink-0" />
          <p className="text-sm text-[var(--error)]">{error}</p>
        </div>
      )}

      {/* Empty state */}
      {!brief && !loading && !error && (
        <Card>
          <div className="p-12 text-center">
            <Brain size={48} className="mx-auto text-[var(--text-tertiary)] mb-4" />
            <p className="text-[var(--text-secondary)]">{t("opsBriefEmpty")}</p>
          </div>
        </Card>
      )}

      {/* Brief content */}
      {brief && (
        <div className="space-y-6">
          {/* Meta banner */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[color-mix(in_srgb,var(--primary)_8%,transparent)] text-[var(--primary)]">
              <Brain size={14} />
              <span className="text-xs font-medium">
                {isFallback && brief.meta.model?.includes("ollama") ? t("opsBriefFallback") : t("opsBriefVerify")}
              </span>
            </div>
            <div className="flex items-center gap-4 text-xs text-[var(--text-tertiary)]">
              <span>{t("opsBriefWindow")}: <strong>{brief.meta.window_hours} {t("opsBriefHours")}</strong></span>
              <span>{t("opsBriefGeneratedAt")}: <strong>{new Date(brief.meta.generated_at).toLocaleString()}</strong></span>
              {timingMs != null && <span>⏱ {(timingMs / 1000).toFixed(1)}s</span>}
            </div>
          </div>

          {/* Summary */}
          <Card>
            <div className="p-5">
              <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-2 flex items-center gap-2">
                <BarChart3 size={18} className="text-[var(--primary)]" />
                {t("opsBriefSummary")}
              </h2>
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{brief.summary}</p>
            </div>
          </Card>

          {/* Alerts */}
          {brief.alerts.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-lg font-semibold text-[var(--text-primary)] flex items-center gap-2">
                <AlertCircle size={18} className="text-[var(--error)]" />
                {t("opsBriefAlerts")}
              </h2>
              {brief.alerts.map((alert, i) => {
                const Icon = SEVERITY_ICON[alert.level] || Info;
                return (
                  <div
                    key={i}
                    className={`rounded-[var(--radius-lg)] border p-4 flex items-start gap-3 ${
                      alert.level === "critical"
                        ? "border-[var(--error)] bg-[color-mix(in_srgb,var(--error)_6%,transparent)]"
                        : alert.level === "warning"
                        ? "border-[var(--warning)] bg-[color-mix(in_srgb,var(--warning)_6%,transparent)]"
                        : "border-[var(--border-default)] bg-[var(--surface-raised)]"
                    }`}
                  >
                    <Icon size={18} className={`shrink-0 mt-0.5 ${
                      alert.level === "critical" ? "text-[var(--error)]"
                      : alert.level === "warning" ? "text-[var(--warning)]"
                      : "text-[var(--text-tertiary)]"
                    }`} />
                    <div className="flex-1">
                      <p className="text-sm text-[var(--text-primary)]">{alert.message}</p>
                      {alert.citations.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {alert.citations.map((c, j) => (
                            <span key={j} className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] font-mono">
                              {t("opsBriefCitation")}: {c}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Actions */}
          {brief.actions.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold text-[var(--text-primary)] flex items-center gap-2">
                <Zap size={18} className="text-[var(--warning)]" />
                {t("opsBriefActions")}
              </h2>
              <div className="space-y-2">
                {brief.actions
                  .sort((a, b) => a.priority - b.priority)
                  .map((action, i) => (
                    <Card key={i}>
                      <div className="p-4 flex items-start gap-4">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[color-mix(in_srgb,var(--primary)_12%,transparent)] text-[var(--primary)] text-sm font-bold shrink-0">
                          {action.priority}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-sm font-semibold text-[var(--text-primary)]">{action.title}</h3>
                            {action.target_url && (
                              <a
                                href={action.target_url}
                                className="inline-flex items-center gap-1 text-xs text-[var(--primary)] hover:underline"
                              >
                                <ExternalLink size={12} />
                                <span>Ouvrir</span>
                              </a>
                            )}
                          </div>
                          <p className="text-xs text-[var(--text-secondary)] mt-0.5">{action.why}</p>
                          {action.citations.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {action.citations.map((c, j) => (
                                <span key={j} className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] font-mono">
                                  {c}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </Card>
                  ))}
              </div>
            </div>
          )}

          {/* Sections */}
          {brief.sections.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-[var(--text-primary)] flex items-center gap-2">
                <Database size={18} className="text-[var(--text-tertiary)]" />
                {t("opsBriefSections")}
              </h2>
              {brief.sections.map((section, si) => (
                <Card key={si}>
                  <div className="p-4">
                    <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">{section.title}</h3>
                    <div className="space-y-2">
                      {section.bullets.map((bullet, bi) => {
                        const Icon = SEVERITY_ICON[bullet.severity] || Info;
                        return (
                          <div key={bi} className="flex items-start gap-2.5">
                            <Badge variant={SEVERITY_BADGE[bullet.severity] || "neutral"} className="shrink-0 mt-0.5">
                              <Icon size={12} className="inline mr-1" />
                              {bullet.severity}
                            </Badge>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-[var(--text-secondary)]">{bullet.text}</p>
                              {bullet.citations.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {bullet.citations.map((c, j) => (
                                    <span key={j} className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] font-mono">
                                      {c}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
