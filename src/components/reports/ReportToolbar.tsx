"use client";

import { useMemo, useState } from "react";
import { exportToCsv } from "@/lib/report-range";

export type DateRangePreset = {
  label: string;
  days: number;
};

const DEFAULT_PRESETS: DateRangePreset[] = [
  { label: "7 days", days: 7 },
  { label: "14 days", days: 14 },
  { label: "30 days", days: 30 },
  { label: "90 days", days: 90 },
];

type ReportToolbarProps = {
  days: number;
  fromKey: string;
  toKey: string;
  onRangeChange: (params: { days?: number; from?: string; to?: string }) => void;
  onExport?: () => void;
  exportLabel?: string;
  children?: React.ReactNode;
};

export function ReportToolbar({
  days,
  fromKey,
  toKey,
  onRangeChange,
  onExport,
  exportLabel = "Export CSV",
  children,
}: ReportToolbarProps) {
  const [customFrom, setCustomFrom] = useState(fromKey);
  const [customTo, setCustomTo] = useState(toKey);
  const [showCustom, setShowCustom] = useState(false);

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border border-[var(--border)] bg-[var(--background)] p-4">
      <div className="flex flex-wrap gap-2">
        {DEFAULT_PRESETS.map((preset) => (
          <button
            key={preset.days}
            type="button"
            onClick={() => onRangeChange({ days: preset.days })}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              !showCustom && days === preset.days
                ? "bg-[var(--pwc-orange)] text-white"
                : "border border-[var(--border)] text-muted hover:border-[var(--pwc-orange)] hover:text-[var(--pwc-orange)]"
            }`}
          >
            {preset.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setShowCustom((v) => !v)}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            showCustom
              ? "bg-[var(--pwc-orange)] text-white"
              : "border border-[var(--border)] text-muted hover:border-[var(--pwc-orange)]"
          }`}
        >
          Custom
        </button>
      </div>

      {showCustom && (
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs text-muted">
            From
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="mt-1 block rounded border px-2 py-1 text-sm"
            />
          </label>
          <label className="text-xs text-muted">
            To
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="mt-1 block rounded border px-2 py-1 text-sm"
            />
          </label>
          <button
            type="button"
            onClick={() => onRangeChange({ from: customFrom, to: customTo })}
            className="btn-primary px-3 py-1.5 text-xs"
          >
            Apply
          </button>
        </div>
      )}

      <div className="ml-auto flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted">
          {fromKey} to {toKey}
        </span>
        {children}
        {onExport && (
          <button type="button" onClick={onExport} className="btn-secondary px-3 py-1.5 text-xs">
            {exportLabel}
          </button>
        )}
      </div>
    </div>
  );
}

type ReportFiltersProps = {
  search: string;
  onSearchChange: (v: string) => void;
  compliance: "all" | "met" | "not_met";
  onComplianceChange: (v: "all" | "met" | "not_met") => void;
  agentStatus: "all" | "healthy" | "stale" | "in_office";
  onAgentStatusChange: (v: "all" | "healthy" | "stale" | "in_office") => void;
};

export function ReportFilters({
  search,
  onSearchChange,
  compliance,
  onComplianceChange,
  agentStatus,
  onAgentStatusChange,
}: ReportFiltersProps) {
  return (
    <div className="flex flex-wrap gap-3">
      <input
        type="search"
        placeholder="Search user..."
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        className="rounded-lg border px-3 py-1.5 text-sm"
      />
      <select
        value={compliance}
        onChange={(e) => onComplianceChange(e.target.value as ReportFiltersProps["compliance"])}
        className="rounded-lg border px-3 py-1.5 text-sm"
      >
        <option value="all">All compliance</option>
        <option value="met">Met target</option>
        <option value="not_met">Below target</option>
      </select>
      <select
        value={agentStatus}
        onChange={(e) => onAgentStatusChange(e.target.value as ReportFiltersProps["agentStatus"])}
        className="rounded-lg border px-3 py-1.5 text-sm"
      >
        <option value="all">All agent status</option>
        <option value="in_office">In office now</option>
        <option value="healthy">Agent healthy</option>
        <option value="stale">Agent stale</option>
      </select>
    </div>
  );
}

export function useTableSort<T>(rows: T[], defaultKey: keyof T) {
  const [sortKey, setSortKey] = useState<keyof T>(defaultKey);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av === bv) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      const cmp = av < bv ? -1 : 1;
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [rows, sortKey, sortDir]);

  function toggleSort(key: keyof T) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  return { sorted, sortKey, sortDir, toggleSort };
}

export function exportDailyTrendCsv(
  filename: string,
  trend: Array<{ date: string; totalHours: number; compliancePct?: number; metTarget?: boolean }>,
) {
  exportToCsv(
    filename,
    ["Date", "Hours", "Compliance %", "Met target"],
    trend.map((d) => [
      d.date,
      d.totalHours.toFixed(1),
      d.compliancePct !== undefined ? String(d.compliancePct) : d.metTarget ? "Yes" : "No",
      d.metTarget ? "Yes" : "No",
    ]),
  );
}
