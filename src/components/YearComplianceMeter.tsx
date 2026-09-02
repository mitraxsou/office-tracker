"use client";

import { useCallback, useEffect, useState } from "react";
import type { YearCompliance } from "@/lib/monthly-progress";
import { formatMonthLabel } from "@/lib/month-range";

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

function monthChipTitle(
  month: YearCompliance["monthDetails"][number],
  timezone: string,
): string {
  const label = formatMonthLabel(month.monthKey, timezone);
  if (month.status === "pending") {
    return `${label}: Not started yet`;
  }
  if (month.status === "pre_pilot") {
    return `${label}: Data not available - app not active`;
  }
  if (month.status === "exemption") {
    return `${label}: Exempted by admin (${month.qualifyingDays}/${month.monthlyDaysTarget} days logged)`;
  }
  if (month.status === "earned") {
    return `${label}: ${month.qualifyingDays}/${month.monthlyDaysTarget} days`;
  }
  return `${label}: ${month.qualifyingDays}/${month.monthlyDaysTarget} days`;
}

function monthChipClassName(month: YearCompliance["monthDetails"][number]): string {
  if (month.status === "pre_pilot") {
    return "bg-green-500/10 text-green-300/80 border border-dashed border-green-500/30";
  }
  if (month.status === "exemption") {
    return "bg-green-500/10 text-green-300 border border-dashed border-green-500/40";
  }
  if (month.status === "earned") {
    return "bg-green-500/15 text-green-400 border border-green-500/30";
  }
  if (month.hasPendingExemption) {
    return "border border-dashed border-amber-500/50 text-amber-300";
  }
  if (month.status === "pending") {
    return "border border-dashed border-[var(--border)] text-muted/60";
  }
  return "border border-[var(--border)] text-muted";
}

export function YearComplianceMeter({ compliance, timezone }: YearComplianceMeterProps) {
  const [openRequests, setOpenRequests] = useState<OpenRequest[]>([]);
  const [requestMonth, setRequestMonth] = useState<string | null>(null);
  const [requestType, setRequestType] = useState<"month" | "day">("month");
  const [requestDay, setRequestDay] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadRequests = useCallback(async () => {
    const res = await fetch("/api/settings/compliance-exemption");
    if (!res.ok) return;
    const data = await res.json();
    setOpenRequests(data.openRequests ?? []);
  }, []);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  const pct = Math.min(100, (compliance.compliantMonths / compliance.monthsInYear) * 100);
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

  return (
    <div className="card p-6">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-sm text-muted">Year compliance ({compliance.year})</p>
          <p className="mt-1 text-4xl font-bold">
            {compliance.compliantMonths}
            <span className="text-lg font-normal text-muted">
              {" "}
              / {compliance.monthsInYear} month{compliance.monthsInYear === 1 ? "" : "s"}
            </span>
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-sm font-medium ${allElapsedCompliant ? "badge-met" : "badge-pending"}`}
        >
          {fullYearCompliant
            ? "Full year met"
            : allElapsedCompliant
              ? "All months met so far"
              : "Monthly days target"}
        </span>
      </div>
      <p className="mt-2 text-xs text-muted">
        Months where you hit the office-days target ({compliance.monthDetails[0]?.monthlyDaysTarget ?? 8}{" "}
        qualifying days per month), including pre-pilot months and admin exemptions.
      </p>
      <div className="progress-track mt-4 h-3 overflow-hidden rounded-full">
        <div
          className={`h-full rounded-full transition-all ${fullYearCompliant || allElapsedCompliant ? "progress-fill-met" : "progress-fill"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {compliance.monthDetails.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {compliance.monthDetails.map((month) => {
            const pending = pendingForMonth(month.monthKey);
            const canRequest =
              month.status === "not_met" &&
              !pending;
            return (
              <span key={month.monthKey} className="inline-flex items-center gap-1">
                <button
                  type="button"
                  title={monthChipTitle(month, timezone)}
                  onClick={() => canRequest && openRequestDialog(month.monthKey)}
                  className={`rounded-md px-2 py-1 text-xs font-medium ${monthChipClassName(month)} ${canRequest ? "cursor-pointer hover:opacity-90" : "cursor-default"}`}
                >
                  {formatMonthLabel(month.monthKey, timezone).split(" ")[0]}
                </button>
                {pending && (
                  <button
                    type="button"
                    onClick={() => cancelRequest(pending.id)}
                    className="text-[10px] text-amber-300 hover:underline"
                    title="Cancel pending exemption request"
                  >
                    Cancel
                  </button>
                )}
              </span>
            );
          })}
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
