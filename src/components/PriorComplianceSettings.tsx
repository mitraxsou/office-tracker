"use client";

import { useCallback, useEffect, useState } from "react";
import { formatMonthLabel } from "@/lib/month-range";
import type { PriorComplianceDeclarationSummary } from "@/lib/prior-compliance";

type Props = {
  timezone: string;
};

export function PriorComplianceSettings({ timezone }: Props) {
  const [eligibleMonthKeys, setEligibleMonthKeys] = useState<string[]>([]);
  const [declarations, setDeclarations] = useState<PriorComplianceDeclarationSummary[]>([]);
  const [monthlyDaysTarget, setMonthlyDaysTarget] = useState(8);
  const [monthKey, setMonthKey] = useState("");
  const [typicalCheckInTime, setTypicalCheckInTime] = useState("09:30");
  const [qualifyingDaysCount, setQualifyingDaysCount] = useState(8);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/settings/prior-compliance");
    setLoading(false);
    if (!res.ok) return;
    const data = await res.json();
    setEligibleMonthKeys(data.eligibleMonthKeys ?? []);
    setDeclarations(data.declarations ?? []);
    setMonthlyDaysTarget(data.monthlyDaysTarget ?? 8);
    setQualifyingDaysCount(data.monthlyDaysTarget ?? 8);
    if ((data.eligibleMonthKeys ?? []).length > 0) {
      setMonthKey(data.eligibleMonthKeys[0]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const declaredMonthKeys = new Set(declarations.map((d) => d.monthKey));
  const availableMonths = eligibleMonthKeys.filter((key) => !declaredMonthKeys.has(key));

  async function submit() {
    if (!monthKey) return;
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    const res = await fetch("/api/settings/prior-compliance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source: "settings",
        message: message.trim() || undefined,
        months: [
          {
            monthKey,
            typicalCheckInTime,
            qualifyingDaysCount,
          },
        ],
      }),
    });

    setSubmitting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Could not submit declaration");
      return;
    }

    setSuccess("Submitted for admin review.");
    setMessage("");
    await load();
  }

  async function cancelRequest(id: string) {
    const res = await fetch(`/api/settings/prior-compliance?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (!res.ok) return;
    await load();
  }

  if (loading) {
    return (
      <section className="card p-6">
        <p className="text-sm text-muted">Loading prior compliance...</p>
      </section>
    );
  }

  if (eligibleMonthKeys.length === 0 && declarations.length === 0) {
    return null;
  }

  return (
    <section className="card p-6">
      <h2 className="text-lg font-medium">Prior office compliance</h2>
      <p className="mt-1 text-sm text-muted">
        Declare months you were office-compliant before Office Pulse had your data. Changes require
        admin approval.
      </p>

      {declarations.length > 0 && (
        <ul className="mt-4 space-y-2 text-sm">
          {declarations.map((row) => (
            <li
              key={row.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--border)] px-3 py-2"
            >
              <span>
                {formatMonthLabel(row.monthKey, timezone)} · check-in {row.typicalCheckInTime} ·{" "}
                {row.qualifyingDaysCount} days ·{" "}
                <span className="capitalize text-muted">{row.status}</span>
              </span>
              {row.status === "open" && (
                <button
                  type="button"
                  onClick={() => void cancelRequest(row.id)}
                  className="text-xs text-amber-300 hover:underline"
                >
                  Cancel
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {availableMonths.length > 0 && (
        <div className="mt-4 space-y-3 rounded-lg border border-[var(--border)] p-4">
          <p className="text-sm font-medium">Add a month</p>
          <label className="block text-sm">
            <span className="text-muted">Month</span>
            <select
              value={monthKey}
              onChange={(e) => setMonthKey(e.target.value)}
              className="mt-1 w-full rounded-lg border px-3 py-2"
            >
              {availableMonths.map((key) => (
                <option key={key} value={key}>
                  {formatMonthLabel(key, timezone)}
                </option>
              ))}
            </select>
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="text-muted">Typical check-in</span>
              <input
                type="time"
                value={typicalCheckInTime}
                onChange={(e) => setTypicalCheckInTime(e.target.value)}
                className="mt-1 w-full rounded-lg border px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              <span className="text-muted">Qualifying days</span>
              <input
                type="number"
                min={1}
                max={monthlyDaysTarget}
                value={qualifyingDaysCount}
                onChange={(e) => setQualifyingDaysCount(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border px-3 py-2"
              />
            </label>
          </div>
          <label className="block text-sm">
            <span className="text-muted">Note for admin (optional)</span>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-lg border px-3 py-2"
            />
          </label>
          {error && <p className="text-sm text-red-400">{error}</p>}
          {success && <p className="text-sm text-green-500">{success}</p>}
          <button
            type="button"
            disabled={submitting || !monthKey}
            onClick={() => void submit()}
            className="btn-primary px-4 py-2 text-sm disabled:opacity-50"
          >
            {submitting ? "Submitting..." : "Submit for admin review"}
          </button>
        </div>
      )}
    </section>
  );
}
