"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DateTimeField, dateTimeLocalToIso } from "@/components/DateTimeField";
import { DEFAULT_MANUAL_VISIT_DURATION_MINUTES } from "@/lib/constants";
import {
  calendarWeeksForMonth,
  currentMonthKey,
  formatMonthLabel,
  shiftMonth,
} from "@/lib/month-range";
import { dayKeyInTimezone } from "@/lib/timezone-dates";

type ManualVisitMode = "timed" | "markDays";

function CheckInIcon() {
  return (
    <svg
      aria-hidden
      className="h-4 w-4 text-accent"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M11 16l-4-4m0 0l4-4m-4 4h14" />
    </svg>
  );
}

function CheckOutIcon() {
  return (
    <svg
      aria-hidden
      className="h-4 w-4 text-muted"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 16l4-4m0 0l-4-4m4 4H3" />
    </svg>
  );
}

/** Format a datetime-local value as check-in + minutes for the default checkout hint. */
function addMinutesToDateTimeLocal(value: string, minutes: number): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setMinutes(date.getMinutes() + minutes);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatHint(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatDayChip(dayKey: string): string {
  const [y, m, d] = dayKey.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function ManualVisitForm({
  timezone,
  hoursTarget = 5,
  officeStartTime = "09:30",
  embedded = false,
}: {
  timezone: string;
  hoursTarget?: number;
  officeStartTime?: string;
  embedded?: boolean;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<ManualVisitMode>("timed");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [includeCheckout, setIncludeCheckout] = useState(false);
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [monthKey, setMonthKey] = useState(() => currentMonthKey(timezone));

  const todayKey = useMemo(() => dayKeyInTimezone(new Date(), timezone), [timezone]);
  const weeks = useMemo(() => calendarWeeksForMonth(monthKey, 1), [monthKey]);

  const defaultEndAt = useMemo(
    () => addMinutesToDateTimeLocal(startAt, DEFAULT_MANUAL_VISIT_DURATION_MINUTES),
    [startAt],
  );

  const sortedSelected = useMemo(
    () => [...selectedDays].sort(),
    [selectedDays],
  );

  function toggleDay(dayKey: string) {
    if (dayKey > todayKey) return;
    setSelectedDays((prev) =>
      prev.includes(dayKey) ? prev.filter((d) => d !== dayKey) : [...prev, dayKey],
    );
  }

  async function handleTimedSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    const res = await fetch("/api/visits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        startAt: dateTimeLocalToIso(startAt),
        endAt:
          includeCheckout && endAt
            ? dateTimeLocalToIso(endAt)
            : defaultEndAt
              ? dateTimeLocalToIso(defaultEndAt)
              : null,
      }),
    });

    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to save visit");
      return;
    }
    setStartAt("");
    setEndAt("");
    setIncludeCheckout(false);
    setSuccess("Submitted for admin approval. You will see the visit after it is approved.");
    router.refresh();
  }

  async function handleMarkDaysSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (sortedSelected.length === 0) {
      setError("Select at least one day");
      return;
    }
    setLoading(true);
    setError(null);
    setSuccess(null);

    const res = await fetch("/api/visits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "markDays",
        dayKeys: sortedSelected,
      }),
    });

    setLoading(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Failed to submit mark-day requests");
      return;
    }

    const created = Array.isArray(data.requests) ? data.requests.length : 0;
    const failed = Array.isArray(data.failures) ? data.failures.length : 0;
    setSelectedDays([]);
    if (failed > 0) {
      setSuccess(
        `Submitted ${created} day${created === 1 ? "" : "s"} for admin approval. ${failed} could not be submitted (e.g. already pending).`,
      );
    } else {
      setSuccess(
        `Submitted ${created} day${created === 1 ? "" : "s"} for admin approval. Each will count toward compliance only after approval.`,
      );
    }
    router.refresh();
  }

  const wrapperClass = embedded ? "" : "card p-6";
  const targetLabel = Number.isInteger(hoursTarget) ? String(hoursTarget) : hoursTarget.toFixed(1);

  return (
    <section className={wrapperClass}>
      <div className={embedded ? "mb-3" : "mb-5"}>
        {!embedded && <h2 className="text-lg font-medium">Manual visit</h2>}
        <p className={`text-sm text-muted ${embedded ? "" : "mt-1"}`}>
          {mode === "timed" ? (
            <>
              Log a past office session when the agent missed it, or for guest Wi-Fi and Ethernet.
              Enter check-in. If you skip check-out, it defaults to{" "}
              {DEFAULT_MANUAL_VISIT_DURATION_MINUTES} minutes after check-in. Submissions go to admin
              for approval before they count toward compliance.
            </>
          ) : (
            <>
              Mark one or more calendar days as office days. Each day creates a pending request for a{" "}
              {targetLabel}-hour visit (from {officeStartTime} in your timezone). Admin approval is
              required before they count toward compliance.
            </>
          )}
        </p>
      </div>

      <div
        className="mb-4 flex flex-wrap gap-1 rounded-lg border border-[var(--border)] p-1"
        role="tablist"
        aria-label="Manual visit mode"
      >
        {(
          [
            { id: "timed" as const, label: "Timed check-in" },
            { id: "markDays" as const, label: "Mark day(s) visited" },
          ] as const
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={mode === item.id}
            onClick={() => {
              setMode(item.id);
              setError(null);
              setSuccess(null);
            }}
            className={`flex-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
              mode === item.id
                ? "bg-[var(--pwc-orange-muted)] text-accent"
                : "text-muted hover:text-foreground"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {error && (
        <p className="mb-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>
      )}
      {success && (
        <p className="mb-4 rounded-lg bg-green-500/10 px-3 py-2 text-sm text-green-400">
          {success}
        </p>
      )}

      {mode === "timed" ? (
        <form onSubmit={handleTimedSubmit} className="space-y-4">
          <div className="rounded-lg border border-[var(--border)] p-4">
            <div className="mb-3 flex items-center gap-2">
              <CheckInIcon />
              <p className="text-sm font-medium">Check-in</p>
            </div>
            <DateTimeField
              label="When you arrived"
              value={startAt}
              onChange={setStartAt}
              required
            />
          </div>

          <label className="flex items-start gap-3 rounded-lg border border-[var(--border)] px-4 py-3 text-sm">
            <input
              type="checkbox"
              checked={includeCheckout}
              onChange={(e) => {
                setIncludeCheckout(e.target.checked);
                if (!e.target.checked) setEndAt("");
              }}
              className="mt-0.5"
            />
            <span>
              <span className="font-medium">Set a different check-out time</span>
              <span className="mt-0.5 block text-xs text-muted">
                Leave unchecked to use check-in + {DEFAULT_MANUAL_VISIT_DURATION_MINUTES} minutes
                {defaultEndAt ? ` (${formatHint(defaultEndAt)})` : ""}.
              </span>
            </span>
          </label>

          {includeCheckout && (
            <div className="rounded-lg border border-[var(--border)] p-4">
              <div className="mb-3 flex items-center gap-2">
                <CheckOutIcon />
                <p className="text-sm font-medium">Check-out</p>
              </div>
              <DateTimeField label="When you left" value={endAt} onChange={setEndAt} required />
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={loading}
              className="btn-primary px-4 py-2 disabled:opacity-50"
            >
              {loading ? "Submitting..." : "Submit for approval"}
            </button>
            <p className="text-xs text-muted">Timezone: {timezone}</p>
          </div>
        </form>
      ) : (
        <form onSubmit={handleMarkDaysSubmit} className="space-y-4">
          <div className="rounded-lg border border-[var(--border)] p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-sm font-medium">Select days</p>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setMonthKey((m) => shiftMonth(m, -1))}
                  className="rounded-md px-2 py-1 text-xs text-muted hover:bg-[var(--background)] hover:text-foreground"
                  aria-label="Previous month"
                >
                  ‹
                </button>
                <span className="min-w-[8.5rem] text-center text-xs font-medium">
                  {formatMonthLabel(monthKey, timezone)}
                </span>
                <button
                  type="button"
                  onClick={() => setMonthKey((m) => shiftMonth(m, 1))}
                  className="rounded-md px-2 py-1 text-xs text-muted hover:bg-[var(--background)] hover:text-foreground"
                  aria-label="Next month"
                >
                  ›
                </button>
              </div>
            </div>

            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  {WEEKDAY_LABELS.map((label) => (
                    <th
                      key={label}
                      className="pb-1 text-center text-[10px] font-medium text-muted"
                    >
                      {label.slice(0, 1)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {weeks.map((week, wi) => (
                  <tr key={wi}>
                    {week.map((cell, ci) => {
                      if (!cell.dayKey) {
                        return <td key={ci} className="p-0.5" />;
                      }
                      const selected = selectedDays.includes(cell.dayKey);
                      const isFuture = cell.dayKey > todayKey;
                      const isToday = cell.dayKey === todayKey;
                      return (
                        <td key={ci} className="p-0.5">
                          <button
                            type="button"
                            disabled={isFuture}
                            onClick={() => toggleDay(cell.dayKey!)}
                            aria-pressed={selected}
                            className={`flex h-8 w-full items-center justify-center rounded-md text-xs transition-colors ${
                              selected
                                ? "bg-[var(--pwc-orange)] font-medium text-white"
                                : isFuture
                                  ? "cursor-not-allowed text-muted/40"
                                  : isToday
                                    ? "bg-[var(--pwc-orange-muted)] text-accent hover:ring-1 hover:ring-[var(--pwc-orange)]/50"
                                    : "text-foreground hover:bg-[var(--background)]"
                            }`}
                          >
                            {cell.dayOfMonth}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>

            {sortedSelected.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {sortedSelected.map((dayKey) => (
                  <button
                    key={dayKey}
                    type="button"
                    onClick={() => toggleDay(dayKey)}
                    className="inline-flex items-center gap-1 rounded-md bg-[var(--pwc-orange-muted)] px-2 py-0.5 text-[11px] text-accent"
                    title="Remove day"
                  >
                    {formatDayChip(dayKey)}
                    <span aria-hidden>×</span>
                  </button>
                ))}
              </div>
            )}

            <p className="mt-3 text-xs text-muted">
              Each selected day → one {targetLabel}h visit starting at {officeStartTime}. Still needs
              admin approval.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={loading || sortedSelected.length === 0}
              className="btn-primary px-4 py-2 disabled:opacity-50"
            >
              {loading
                ? "Submitting..."
                : sortedSelected.length === 0
                  ? "Submit for approval"
                  : `Submit ${sortedSelected.length} day${sortedSelected.length === 1 ? "" : "s"} for approval`}
            </button>
            <p className="text-xs text-muted">Timezone: {timezone}</p>
          </div>
        </form>
      )}
    </section>
  );
}
