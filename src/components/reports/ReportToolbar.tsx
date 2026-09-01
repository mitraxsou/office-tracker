"use client";

import { useMemo, useState } from "react";
import { formatMonthLabel, shiftMonth } from "@/lib/month-range";
import { exportToCsv } from "@/lib/report-range";

type MonthReportToolbarProps = {
  monthKey: string;
  timezone?: string;
  onMonthChange: (monthKey: string) => void;
  onExport?: () => void;
  exportLabel?: string;
  children?: React.ReactNode;
};

export function MonthReportToolbar({
  monthKey,
  timezone = "Asia/Kolkata",
  onMonthChange,
  onExport,
  exportLabel = "Export CSV",
  children,
}: MonthReportToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--background)] p-4">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onMonthChange(shiftMonth(monthKey, -1))}
          className="rounded-md border border-[var(--border)] px-2.5 py-1.5 text-sm text-muted transition-colors hover:border-[var(--pwc-orange)] hover:text-[var(--pwc-orange)]"
          aria-label="Previous month"
        >
          ‹
        </button>
        <span className="min-w-[10rem] text-center text-sm font-medium">
          {formatMonthLabel(monthKey, timezone)}
        </span>
        <button
          type="button"
          onClick={() => onMonthChange(shiftMonth(monthKey, 1))}
          className="rounded-md border border-[var(--border)] px-2.5 py-1.5 text-sm text-muted transition-colors hover:border-[var(--pwc-orange)] hover:text-[var(--pwc-orange)]"
          aria-label="Next month"
        >
          ›
        </button>
        <label className="sr-only" htmlFor="month-picker">
          Jump to month
        </label>
        <input
          id="month-picker"
          type="month"
          value={monthKey}
          onChange={(e) => {
            if (e.target.value) onMonthChange(e.target.value);
          }}
          className="rounded-md border border-[var(--border)] px-2 py-1 text-xs"
        />
      </div>

      <div className="ml-auto flex flex-wrap items-center gap-2">
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

/** @deprecated Use MonthReportToolbar. Kept for export helpers. */
export function ReportToolbar({
  monthKey,
  timezone,
  onMonthChange,
  onExport,
  exportLabel,
  children,
}: {
  monthKey: string;
  timezone?: string;
  onMonthChange: (monthKey: string) => void;
  onExport?: () => void;
  exportLabel?: string;
  children?: React.ReactNode;
}) {
  return (
    <MonthReportToolbar
      monthKey={monthKey}
      timezone={timezone}
      onMonthChange={onMonthChange}
      onExport={onExport}
      exportLabel={exportLabel}
    >
      {children}
    </MonthReportToolbar>
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
