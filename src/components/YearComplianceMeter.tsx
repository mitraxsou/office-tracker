"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getYearMonthVisualStatus,
  type YearCompliance,
  type YearMonthVisualStatus,
  yearMonthTooltipText,
} from "@/lib/monthly-progress";
import { currentMonthKey, formatMonthLabel } from "@/lib/month-range";

type YearComplianceMeterProps = {
  compliance: YearCompliance;
  timezone: string;
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

export function YearComplianceMeter({ compliance, timezone }: YearComplianceMeterProps) {
  const [openRequests, setOpenRequests] = useState<OpenRequest[]>([]);
  const [requestMonth, setRequestMonth] = useState<string | null>(null);
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

  const allElapsedCompliant =
    compliance.monthsElapsed > 0 && compliance.compliantMonths === compliance.monthsElapsed;
  const fullYearCompliant = compliance.compliantMonths === compliance.monthsInYear;

  async function submitRequest() {
    if (!requestMonth) return;
    setSubmitting(true);
    setError(null);
    const res = await fetch("/api/settings/compliance-exemption", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: requestType,
        monthKey: requestType === "month" ? requestMonth : undefined,
        dayKey: requestType === "day" ? requestDay : undefined,
        message: message.trim() || undefined,
      }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to submit request");
      return;
    }
    setRequestMonth(null);
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

  function openRequestDialog(monthKey: string) {
    setRequestMonth(monthKey);
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

  return (
    <div className="card p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Year compliance ({compliance.fiscalYearLabel})</p>
          <p className="mt-1 text-xs text-muted">
            {targetDays} qualifying days per month. Green = met target or admin exemption. Empty
            months do not count as compliant.
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
              const canRequest =
                (month.status === "not_met" || month.status === "no_data") && !pending;
              const tooltip = yearMonthTooltipText(month, currentMonth, timezone);

              return (
                <div key={month.monthKey} className="flex flex-col items-stretch gap-1">
                  <span className="group relative">
                    <button
                      type="button"
                      title={tooltip}
                      onClick={() => canRequest && openRequestDialog(month.monthKey)}
                      className={`flex w-full flex-col items-center justify-center rounded-md px-2 py-3 text-xs font-semibold transition-opacity ${monthCellClassName(visual, month.hasPendingExemption)} ${canRequest ? "cursor-pointer hover:opacity-90" : "cursor-default"}`}
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
                      title="Cancel pending exemption request"
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

      {requestMonth && (
        <div className="mt-4 rounded-lg border border-[var(--border)] p-4">
          <p className="text-sm font-medium">
            Request HR exemption for {formatMonthLabel(requestMonth, timezone)}
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
            <span className="text-muted">Reason (optional)</span>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              placeholder="e.g. client travel, medical leave"
            />
          </label>
          {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={submitting || (requestType === "day" && !requestDay)}
              onClick={() => void submitRequest()}
              className="btn-primary px-3 py-1.5 text-sm disabled:opacity-50"
            >
              {submitting ? "Submitting..." : "Submit exemption request"}
            </button>
            <button
              type="button"
              onClick={() => setRequestMonth(null)}
              className="text-sm text-muted hover:underline"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
