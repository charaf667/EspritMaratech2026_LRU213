"use client";

import { useI18n } from "@/i18n";
import type { Priority } from "@/lib/mock-data";

const COLORS: Record<Priority, string> = {
  overdue: "var(--color-badge-overdue)",
  urgent: "var(--color-badge-urgent)",
  normal: "var(--color-badge-normal)",
};

export default function PriorityBadge({ priority }: { priority: Priority }) {
  const { t } = useI18n();
  return (
    <span
      role="status"
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: "var(--radius)",
        backgroundColor: COLORS[priority],
        color: "#fff",
        fontSize: "0.75rem",
        fontWeight: 600,
      }}
    >
      {t(priority)}
    </span>
  );
}
