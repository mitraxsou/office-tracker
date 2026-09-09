"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getYearMonthVisualStatus,
  type YearCompliance,
  type YearMonthVisualStatus,
  yearMonthTooltipText,
} from "@/lib/monthly-progress";
import { currentMonthKey, formatMonthLabel } from "@/lib/month-range";
import { GroupedVisitList } from "@/components/reports/GroupedVisitList";

type YearComplianceMeterProps = {
  compliance: YearCompliance;
  timezone: string;
  hoursTarget: number;
};

type MonthReportData = {
  dailyTrend: Array<{ date: string; totalHours: number; metTarget: boolean }>;
  visits: Array<{
    id: string;
    startAt: string;
    endAt: string | null;
    source: string;
    ssid: string | null;
  }>;
  monthlyProgress: {
    qualifyingDays: number;
    officeVisitDays: number;
    monthlyDaysTarget: number;
  };
};

type OpenRequest = {
  id: string;
  type: "month" | "day";
  monthKey: string | null;
  dayKey: string | null;
  status: string;
};

function monthCellClassName(visual: YearMonthVisualStatus, hasPendingExemption?: boolean): string {
  const pendingRing = hasPendingExemption ? " ring-1 ring-amber-500/50" : "";
  switch (visual) {
    case "compliant":
      return `bg-green-500/15 text-green-400 border border-green-500/30${pendingRing}`;
    case "non_compliant":
      return `bg-red-500/10 text-red-300 border border-red-500/40${pendingRing}`;
    case "in_progress":
      return `bg-[var(--pwc-orange)]/10 text-accent border border-[var(--pwc-orange)]/40${pendingRing}`;
    case "no_data":
      return `border border-dashed border-[var(--border)] text-muted${pendingRing}`;
    case "pending":
      return `border border-dashed border-[var(--border)]/60 text-muted/50${pendingRing}`;
  }
}

function monthAbbrev(monthKey: string, timezone: string): string {
  return formatMonthLabel(monthKey, timezone).split(" ")[0]!.slice(0, 3);
}

export function YearComplianceMeter({ compliance, timezone, hoursTarget }: YearComplianceMeterProps) {
  const [openRequests, setOpenRequests] = useState<OpenRequest[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [monthReport, setMonthReport] = useState<MonthReportData | null>(null);
  const [monthLoading, setMonthLoading] = useState(false);
  const [monthError, setMonthError] = useState<string | null>(null);
  const [requestType, setRequestType] = useState<"month" | "day">("month");
  const [requestDay, setRequestDay] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const currentMonth = currentMonthKey(timezone);

  const loadRequests = useCallback(async () => {
    const res = await fetch("/api/settings/compliance-exemption");
    if (!res.ok) return;
    const data = await res.json();
    setOpenRequests(data.openRequests ?? []);
  }, []);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  useEffect(() => {
    if (!selectedMonth) {
      setMonthReport(null);
      setMonthError(null);
      return;
    }

    let cancelled = false;
    setMonthLoading(true);
    setMonthError(null);

    void fetch(`/api/user/reports?month=${encodeURIComponent(selectedMonth)}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to load month details");
        return res.json() as Promise<MonthReportData>;
      })
      .then((data) => {
        if (!cancelled) setMonthReport(data);
      })
      .catch(() => {
        if (!cancelled) setMonthError("Failed to load office days for this month.");
      })
      .finally(() => {
        if (!cancelled) setMonthLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedMonth]);

  const allElapsedCompliant =
    compliance.monthsElapsed > 0 && compliance.compliantMonths === compliance.monthsElapsed;
  const fullYearCompliant = compliance.compliantMonths === compliance.monthsInYear;

  async function submitRequest() {
    if (!selectedMonth) return;
    setSubmitting(true);
    setError(null);
    const res = await fetch("/api/settings/compliance-exemption", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: requestType,
        monthKey: requestType === "month" ? selectedMonth : undefined,
        dayKey: requestType === "day" ? requestDay : undefined,
        message: message.trim() || undefined,
      }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to notify admin");
      return;
    }
    setSelectedMonth(null);
    setRequestDay("");
    setMessage("");
    await loadRequests();
    window.location.reload();
  }

  async function cancelRequest(id: string) {
    const res = await fetch(`/api/settings/compliance-exemption?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (!res.ok) return;
    await loadRequests();
    window.location.reload();
  }

  function selectMonth(monthKey: string) {
    setSelectedMonth(monthKey);
    setRequestType("month");
    setRequestDay(`${monthKey}-01`);
    setMessage("");
    setError(null);
  }

  const pendingForMonth = (monthKey: string) =>
    openRequests.find(
      (r) =>
        r.status === "open" &&
        (r.monthKey === monthKey || (r.dayKey && r.dayKey.startsWith(`${monthKey}-`))),
    );

  const targetDays = compliance.monthDetails[0]?.monthlyDaysTarget ?? 8;
  const selectedMonthDetail = compliance.monthDetails.find((m) => m.monthKey === selectedMonth);
  const canRequestExemption =
    !!selectedMonthDetail &&
    (selectedMonthDetail.status === "not_met" || selectedMonthDetail.status === "no_data") &&
    !pendingForMonth(selectedMonth!);

  return (
    <div className="card p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Year compliance ({compliance.fiscalYearLabel})</p>
          <p className="mt-1 text-xs text-muted">
            {targetDays} qualifying days per month. Green = met target or HR exemption logged by
            admin. Click a month to view details or notify admin of an HR exemption you already have.
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-3 py-1 text-sm font-medium ${allElapsedCompliant ? "badge-met" : "badge-pending"}`}
        >
          {fullYearCompliant
            ? "Full year met"
            : allElapsedCompliant
              ? "All months met so far"
              : "Monthly days target"}
        </span>
      </div>

      {compliance.monthDetails.length > 0 && (
        <div className="mt-4">
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
            {compliance.monthDetails.map((month) => {
              const visual = getYearMonthVisualStatus(month, currentMonth);
              const pending = pendingForMonth(month.monthKey);
              const canSelect = month.status !== "pending";
              const tooltip = yearMonthTooltipText(month, currentMonth, timezone);
              const isSelected = selectedMonth === month.monthKey;

              return (
                <div key={month.monthKey} className="flex flex-col items-stretch gap-1">
                  <span className="group relative">
                    <button
                      type="button"
                      title={tooltip}
                      onClick={() => canSelect && selectMonth(month.monthKey)}
                      className={`flex w-full flex-col items-center justify-center rounded-md px-2 py-3 text-xs font-semibold transition-opacity ${monthCellClassName(visual, month.hasPendingExemption)} ${canSelect ? "cursor-pointer hover:opacity-90" : "cursor-default"} ${isSelected ? "ring-2 ring-[var(--pwc-orange)]/70" : ""}`}
                    >
                      {monthAbbrev(month.monthKey, timezone)}
                    </button>
                    <span
                      role="tooltip"
                      className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1 hidden w-52 -translate-x-1/2 rounded-md border border-[var(--border)] bg-[var(--background-elevated)] px-2.5 py-2 text-center text-[11px] leading-snug text-muted shadow-lg group-hover:block group-focus-within:block"
                    >
                      {tooltip}
                    </span>
                  </span>
                  {pending && (
                    <button
                      type="button"
                      onClick={() => cancelRequest(pending.id)}
                      className="text-center text-[10px] text-amber-300 hover:underline"
                      title="Cancel pending HR exemption notification"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-muted">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm bg-green-500/40" />
              Compliant
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm bg-[var(--pwc-orange)]/50" />
              In progress
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm bg-red-500/40" />
              Non-compliant
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm border border-dashed border-[var(--border)]" />
              No data
            </span>
          </div>
        </div>
      )}

      {selectedMonth && (
        <div className="mt-4 rounded-lg border border-[var(--border)] p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <p className="text-sm font-medium">
              {formatMonthLabel(selectedMonth, timezone)} office days
            </p>
            <button
              type="button"
              onClick={() => setSelectedMonth(null)}
              className="text-sm text-muted hover:underline"
            >
              Close
            </button>
          </div>

          {monthLoading && (
            <p className="mt-3 text-sm text-muted">Loading office days...</p>
          )}
          {monthError && <p className="mt-3 text-sm text-red-400">{monthError}</p>}
          {monthReport && !monthLoading && (
            <>
              <p className="mt-2 text-xs text-muted">
                {monthReport.monthlyProgress.qualifyingDays}/
                {monthReport.monthlyProgress.monthlyDaysTarget} qualifying days ·{" "}
                {monthReport.monthlyProgress.officeVisitDays} day
                {monthReport.monthlyProgress.officeVisitDays === 1 ? "" : "s"} with office
                presence
              </p>
              <div className="mt-4">
                {monthReport.visits.length === 0 ? (
                  <p className="text-sm text-muted">No office visits recorded this month.</p>
                ) : (
                  <GroupedVisitList
                    visits={monthReport.visits}
                    dailyTrend={monthReport.dailyTrend}
                    timezone={timezone}
                    hoursTarget={hoursTarget}
                  />
                )}
              </div>
            </>
          )}

          {canRequestExemption && (
            <div className="mt-4 border-t border-[var(--border)] pt-4">
              <p className="text-sm font-medium">
                Notify admin of HR exemption for {formatMonthLabel(selectedMonth, timezone)}
              </p>
              <p className="mt-1 text-xs text-muted">
                If you have HR approval for this month or day, tell admin so they can log it here.
                This month will show as compliant only after admin logs the exemption.
              </p>
              <div className="mt-3 flex flex-wrap gap-3 text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="exemption-type"
                    checked={requestType === "month"}
                    onChange={() => setRequestType("month")}
                  />
                  Whole month
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="exemption-type"
                    checked={requestType === "day"}
                    onChange={() => setRequestType("day")}
                  />
                  Single day
                </label>
              </div>
              {requestType === "day" && (
                <label className="mt-3 block text-sm">
                  <span className="text-muted">Day (YYYY-MM-DD)</span>
                  <input
                    type="date"
                    value={requestDay}
                    onChange={(e) => setRequestDay(e.target.value)}
                    className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                  />
                </label>
              )}
              <label className="mt-3 block text-sm">
                <span className="text-muted">Details for admin (optional)</span>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={2}
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                  placeholder="e.g. approved leave reference, client travel dates"
                />
              </label>
              {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
              <div className="mt-3">
                <button
                  type="button"
                  disabled={submitting || (requestType === "day" && !requestDay)}
                  onClick={() => void submitRequest()}
                  className="btn-primary px-3 py-1.5 text-sm disabled:opacity-50"
                >
                  {submitting ? "Submitting..." : "Notify admin"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
