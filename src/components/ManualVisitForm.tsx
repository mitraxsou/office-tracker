"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DateTimeField, dateTimeLocalToIso } from "@/components/DateTimeField";
import { DEFAULT_MANUAL_VISIT_DURATION_MINUTES } from "@/lib/constants";

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

export function ManualVisitForm({
  timezone,
  embedded = false,
}: {
  timezone: string;
  embedded?: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [includeCheckout, setIncludeCheckout] = useState(false);

  const defaultEndAt = useMemo(
    () => addMinutesToDateTimeLocal(startAt, DEFAULT_MANUAL_VISIT_DURATION_MINUTES),
    [startAt],
  );

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
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

  const wrapperClass = embedded ? "" : "card p-6";

  return (
    <section className={wrapperClass}>
      <div className={embedded ? "mb-3" : "mb-5"}>
        {!embedded && <h2 className="text-lg font-medium">Manual visit</h2>}
        <p className={`text-sm text-muted ${embedded ? "" : "mt-1"}`}>
          Log a past office session when the agent missed it, or for guest Wi-Fi and Ethernet.
          Enter check-in. If you skip check-out, it defaults to{" "}
          {DEFAULT_MANUAL_VISIT_DURATION_MINUTES} minutes after check-in. Submissions go to admin for
          approval before they count toward compliance.
        </p>
      </div>

      {error && (
        <p className="mb-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>
      )}
      {success && (
        <p className="mb-4 rounded-lg bg-green-500/10 px-3 py-2 text-sm text-green-400">
          {success}
        </p>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
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
    </section>
  );
}
