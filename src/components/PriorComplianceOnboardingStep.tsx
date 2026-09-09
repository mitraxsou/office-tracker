"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatMonthLabel } from "@/lib/month-range";

type MonthSelection = {
  monthKey: string;
  selected: boolean;
  typicalCheckInTime: string;
  qualifyingDaysCount: number;
};

type Props = {
  timezone: string;
  onComplete?: () => void;
};

export function PriorComplianceOnboardingStep({ timezone, onComplete }: Props) {
  const router = useRouter();
  const [months, setMonths] = useState<MonthSelection[]>([]);
  const [monthlyDaysTarget, setMonthlyDaysTarget] = useState(8);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/settings/prior-compliance")
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to load");
        return res.json();
      })
      .then((data) => {
        const eligible: string[] = data.eligibleMonthKeys ?? [];
        setMonthlyDaysTarget(data.monthlyDaysTarget ?? 8);
        setMonths(
          eligible.map((monthKey) => ({
            monthKey,
            selected: false,
            typicalCheckInTime: "09:30",
            qualifyingDaysCount: data.monthlyDaysTarget ?? 8,
          })),
        );
      })
      .catch(() => setError("Could not load eligible months"))
      .finally(() => setLoading(false));
  }, []);

  function updateMonth(monthKey: string, patch: Partial<MonthSelection>) {
    setMonths((prev) =>
      prev.map((month) => (month.monthKey === monthKey ? { ...month, ...patch } : month)),
    );
  }

  async function submit(skip = false) {
    setSaving(true);
    setError(null);

    const selected = months.filter((month) => month.selected);
    const res = await fetch("/api/settings/prior-compliance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        skip,
        source: "onboarding",
        message: message.trim() || undefined,
        months: selected.map((month) => ({
          monthKey: month.monthKey,
          typicalCheckInTime: month.typicalCheckInTime,
          qualifyingDaysCount: month.qualifyingDaysCount,
        })),
      }),
    });

    setSaving(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Could not save declarations");
      return;
    }

    onComplete?.();
    router.refresh();
  }

  if (loading) {
    return <p className="text-sm text-muted">Loading prior months...</p>;
  }

  if (months.length === 0) {
    return null;
  }

  const selectedCount = months.filter((month) => month.selected).length;

  return (
    <section className="card border border-[var(--pwc-orange)]/40 p-6">
      <h2 className="text-lg font-semibold">Prior office compliance</h2>
      <p className="mt-2 text-sm text-muted">
        We do not have office data from before you joined. Tell us which months you were already
        compliant and your typical check-in time. Admin will review before your year compliance
        updates.
      </p>

      <div className="mt-4 space-y-3">
        {months.map((month) => (
          <div
            key={month.monthKey}
            className="rounded-lg border border-[var(--border)] p-4 text-sm"
          >
            <label className="flex items-center gap-2 font-medium">
              <input
                type="checkbox"
                checked={month.selected}
                onChange={(e) => updateMonth(month.monthKey, { selected: e.target.checked })}
              />
              {formatMonthLabel(month.monthKey, timezone)}
            </label>

            {month.selected && (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="text-xs text-muted">Typical check-in (24h)</span>
                  <input
                    type="time"
                    value={month.typicalCheckInTime}
                    onChange={(e) =>
                      updateMonth(month.monthKey, { typicalCheckInTime: e.target.value })
                    }
                    className="mt-1 w-full rounded-lg border px-3 py-2"
                    required
                  />
                </label>
                <label className="block">
                  <span className="text-xs text-muted">Qualifying office days</span>
                  <input
                    type="number"
                    min={1}
                    max={monthlyDaysTarget}
                    value={month.qualifyingDaysCount}
                    onChange={(e) =>
                      updateMonth(month.monthKey, {
                        qualifyingDaysCount: Number(e.target.value),
                      })
                    }
                    className="mt-1 w-full rounded-lg border px-3 py-2"
                  />
                </label>
              </div>
            )}
          </div>
        ))}
      </div>

      {selectedCount > 0 && (
        <label className="mt-4 block text-sm">
          <span className="text-muted">Note for admin (optional)</span>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={2}
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
            placeholder="e.g. was in office full-time before joining Office Pulse"
          />
        </label>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={saving}
          onClick={() => void submit(false)}
          className="btn-primary px-4 py-2 disabled:opacity-50"
        >
          {saving
            ? "Submitting..."
            : selectedCount > 0
              ? `Submit ${selectedCount} month${selectedCount === 1 ? "" : "s"} for review`
              : "Continue without declaring"}
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => void submit(true)}
          className="text-sm text-muted hover:underline"
        >
          Skip - no prior compliance
        </button>
      </div>

      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
    </section>
  );
}
