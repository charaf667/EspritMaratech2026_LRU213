"use client";

import { useI18n } from "@/i18n";
import type { Family } from "@/lib/mock-data";
import Badge from "./ds/Badge";
import type { BadgeVariant } from "./ds/Badge";
import type { Priority } from "@/lib/mock-data";

const PRIORITY_BADGE: Record<Priority, BadgeVariant> = {
  overdue: "critical",
  urgent: "warning",
  normal: "neutral",
};

interface FieldListProps {
  items: Family[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export default function FieldList({
  items,
  selectedId,
  onSelect,
}: FieldListProps) {
  const { t } = useI18n();

  if (items.length === 0) {
    return <p className="p-4 text-[var(--text-tertiary)]">{t("noItems")}</p>;
  }

  return (
    <ul
      role="list"
      aria-label={t("list")}
      className="list-none overflow-auto flex-1"
    >
      {items.map((item) => (
        <li key={item.id}>
          <button
            onClick={() => onSelect(item.id)}
            aria-current={selectedId === item.id ? "true" : undefined}
            className={`block w-full text-start px-4 py-3 border-b border-[var(--border-subtle)] cursor-pointer transition-colors min-h-[var(--touch-target-min)] ${
              selectedId === item.id
                ? "bg-[color-mix(in_srgb,var(--primary)_8%,transparent)]"
                : "hover:bg-[var(--bg-secondary)]"
            }`}
          >
            <div className="flex justify-between items-center gap-2">
              <strong className="text-[var(--text-primary)]">{item.name}</strong>
              <Badge variant={PRIORITY_BADGE[item.priority]}>
                {t(item.priority)}
              </Badge>
            </div>
            <div className="text-sm text-[var(--text-secondary)] mt-1">
              {item.address}
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}
