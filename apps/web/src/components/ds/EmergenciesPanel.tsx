"use client";

import { useState, useEffect } from "react";
import { useI18n } from "@/i18n";
import type { TranslationKey } from "@/i18n";
import {
  apiListEmergencies, apiAcknowledgeEmergency, apiSetEmergencyStatus,
  apiAddEmergencyNote, apiAssignEmergency, apiGetUsers, apiUserToUser,
  type EmergencyIncident, USE_API,
} from "@/lib/api";
import type { User } from "@/lib/mock-data";
import { Card, CardHeader, Badge, Button, Chip, Input, Modal } from "@/components/ds";
import type { BadgeVariant } from "@/components/ds";
import {
  AlertTriangle, Check, Clock, MessageSquare, Send,
  UserPlus, MapPin, ChevronDown, ChevronUp,
} from "lucide-react";

const STATUS_BADGE: Record<string, BadgeVariant> = {
  open: "critical",
  acknowledged: "warning",
  in_progress: "info",
  resolved: "success",
};

const STATUS_KEY: Record<string, TranslationKey> = {
  open: "emergencyStatusOpen",
  acknowledged: "emergencyStatusAcknowledged",
  in_progress: "emergencyStatusInProgress",
  resolved: "emergencyStatusResolved",
};

export default function EmergenciesPanel() {
  const { t } = useI18n();
  const [incidents, setIncidents] = useState<EmergencyIncident[]>([]);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [noteInputs, setNoteInputs] = useState<Record<string, string>>({});
  const [users, setUsers] = useState<User[]>([]);
  const [assignModalId, setAssignModalId] = useState<string | null>(null);

  const loadIncidents = () => {
    if (!USE_API) return;
    apiListEmergencies(statusFilter ?? undefined).then(({ data }) => {
      if (data) setIncidents(data);
    });
  };

  useEffect(() => {
    loadIncidents();
    const interval = setInterval(loadIncidents, 15000);
    return () => clearInterval(interval);
  }, [statusFilter]);

  useEffect(() => {
    if (!USE_API) return;
    apiGetUsers().then(({ data }) => {
      if (data) setUsers(data.map(apiUserToUser));
    });
  }, []);

  const handleAcknowledge = async (id: string) => {
    const { data } = await apiAcknowledgeEmergency(id);
    if (data) setIncidents((prev) => prev.map((i) => i.id === id ? data : i));
  };

  const handleSetStatus = async (id: string, status: string) => {
    const { data } = await apiSetEmergencyStatus(id, status);
    if (data) setIncidents((prev) => prev.map((i) => i.id === id ? data : i));
  };

  const handleAddNote = async (id: string) => {
    const note = noteInputs[id]?.trim();
    if (!note) return;
    await apiAddEmergencyNote(id, note);
    setNoteInputs((prev) => ({ ...prev, [id]: "" }));
    loadIncidents();
  };

  const handleAssign = async (incidentId: string, userId: string) => {
    const { data } = await apiAssignEmergency(incidentId, userId);
    if (data) setIncidents((prev) => prev.map((i) => i.id === incidentId ? data : i));
    setAssignModalId(null);
  };

  const filtered = statusFilter
    ? incidents.filter((i) => i.status === statusFilter)
    : incidents;

  const activeStatuses = ["open", "acknowledged", "in_progress"];

  return (
    <section>
      <Card>
        <CardHeader>
          <h3 className="text-base font-semibold text-[var(--text-primary)] flex items-center gap-2">
            <AlertTriangle size={18} className="text-[var(--critical)]" />
            {t("emergencyIncidents")}
          </h3>
        </CardHeader>

        {/* Status filter chips */}
        <div className="flex gap-2 mb-[var(--space-3)] overflow-x-auto">
          <Chip selected={statusFilter === null} onToggle={() => setStatusFilter(null)}>
            {t("complaintAll")}
          </Chip>
          {activeStatuses.map((s) => (
            <Chip
              key={s}
              selected={statusFilter === s}
              onToggle={() => setStatusFilter(statusFilter === s ? null : s)}
            >
              {t(STATUS_KEY[s])}
            </Chip>
          ))}
        </div>

        {/* Incidents list */}
        {filtered.length === 0 ? (
          <p className="text-sm text-[var(--text-tertiary)] py-4 text-center">
            {t("emergencyNoIncidents")}
          </p>
        ) : (
          <div className="space-y-[var(--space-2)]">
            {filtered.map((incident) => {
              const isExpanded = expandedId === incident.id;

              return (
                <div
                  key={incident.id}
                  className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-secondary)] overflow-hidden"
                >
                  {/* Incident header */}
                  <button
                    type="button"
                    onClick={() => setExpandedId(isExpanded ? null : incident.id)}
                    className="w-full text-start p-[var(--space-3)] cursor-pointer hover:bg-[var(--bg-tertiary)] transition-colors"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <Badge variant={STATUS_BADGE[incident.status] ?? "neutral"}>
                          {t(STATUS_KEY[incident.status] ?? "emergencyStatusOpen")}
                        </Badge>
                        <span className="font-medium text-sm text-[var(--text-primary)] truncate">
                          {incident.emergency_type_label}
                        </span>
                      </div>
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-[var(--text-tertiary)]">
                      <span>{incident.triggered_by_name}</span>
                      <span>{new Date(incident.created_at).toLocaleString()}</span>
                      {incident.lat && incident.lng && (
                        <span className="flex items-center gap-1">
                          <MapPin size={12} />
                          {incident.lat.toFixed(3)}, {incident.lng.toFixed(3)}
                        </span>
                      )}
                    </div>
                    {incident.summary && (
                      <p className="text-sm text-[var(--text-secondary)] mt-1 line-clamp-1">
                        {incident.summary}
                      </p>
                    )}
                  </button>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="border-t border-[var(--border-subtle)] p-[var(--space-3)] space-y-[var(--space-3)]">
                      {/* Details */}
                      {incident.details && (
                        <p className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap">
                          {incident.details}
                        </p>
                      )}

                      {/* Actions */}
                      <div className="flex flex-wrap gap-2">
                        {incident.status === "open" && (
                          <Button
                            variant="primary"
                            size="sm"
                            icon={<Check size={14} />}
                            onClick={() => handleAcknowledge(incident.id)}
                          >
                            {t("emergencyAcknowledge")}
                          </Button>
                        )}
                        {incident.status !== "resolved" && (
                          <>
                            {incident.status !== "in_progress" && (
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => handleSetStatus(incident.id, "in_progress")}
                              >
                                {t("emergencyStatusInProgress")}
                              </Button>
                            )}
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => handleSetStatus(incident.id, "resolved")}
                            >
                              {t("emergencyStatusResolved")}
                            </Button>
                          </>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<UserPlus size={14} />}
                          onClick={() => setAssignModalId(incident.id)}
                        >
                          {t("emergencyAssign")}
                        </Button>
                      </div>

                      {/* Assigned to */}
                      {incident.assigned_to_name && (
                        <p className="text-xs text-[var(--text-tertiary)]">
                          {t("emergencyAssign")}: <strong>{incident.assigned_to_name}</strong>
                        </p>
                      )}

                      {/* Add note */}
                      <div className="flex gap-2">
                        <Input
                          placeholder={t("emergencyAddNote")}
                          value={noteInputs[incident.id] ?? ""}
                          onChange={(e) => setNoteInputs((prev) => ({ ...prev, [incident.id]: e.target.value }))}
                          icon={<MessageSquare size={16} />}
                        />
                        <Button
                          variant="primary"
                          size="sm"
                          icon={<Send size={14} />}
                          disabled={!noteInputs[incident.id]?.trim()}
                          onClick={() => handleAddNote(incident.id)}
                        >
                          {t("save")}
                        </Button>
                      </div>

                      {/* Timeline */}
                      {incident.timeline && incident.timeline.length > 0 && (
                        <div>
                          <h4 className="text-xs font-semibold text-[var(--text-secondary)] mb-2 uppercase">
                            {t("emergencyTimeline")}
                          </h4>
                          <div className="space-y-2">
                            {incident.timeline.map((entry) => (
                              <div key={entry.id} className="flex gap-2 text-xs">
                                <div className="w-2 h-2 mt-1.5 rounded-full bg-[var(--primary)] shrink-0" />
                                <div>
                                  <span className="text-[var(--text-primary)] font-medium">
                                    {entry.actor_name}
                                  </span>
                                  {" — "}
                                  <span className="text-[var(--text-secondary)]">{entry.action}</span>
                                  {entry.note && (
                                    <p className="text-[var(--text-tertiary)] mt-0.5">{entry.note}</p>
                                  )}
                                  <p className="text-[var(--text-tertiary)] mt-0.5">
                                    {new Date(entry.created_at).toLocaleString()}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Assign Modal */}
      {assignModalId && (
        <Modal
          open
          onClose={() => setAssignModalId(null)}
          title={t("emergencyAssign")}
        >
          <div className="space-y-[var(--space-2)]">
            {users.map((u) => (
              <Button
                key={u.id}
                variant="ghost"
                size="sm"
                className="w-full text-start"
                onClick={() => handleAssign(assignModalId, u.id)}
              >
                {u.firstName} {u.lastName} ({u.role})
              </Button>
            ))}
          </div>
        </Modal>
      )}
    </section>
  );
}
