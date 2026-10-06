import Link from "next/link";
import { auditTimezoneOptions } from "@/lib/audit-actions";
import type { AuditSearchInput } from "@/lib/audit-search";

export function AuditSearchForm({
  filters,
  timezone,
}: {
  filters: {
    target: string;
    actor: string;
    action: string;
    from: string;
    to: string;
  };
  timezone: string;
}) {
  const tzOptions = auditTimezoneOptions(timezone);
  return (
    <form className="card grid gap-3 p-4 md:grid-cols-6">
      <input
        name="target"
        defaultValue={filters.target}
        placeholder="Target user"
        className="rounded-lg border px-3 py-2 text-sm"
      />
      <input
        name="actor"
        defaultValue={filters.actor}
        placeholder="Actor or admin"
        className="rounded-lg border px-3 py-2 text-sm"
      />
      <input
        name="action"
        defaultValue={filters.action}
        placeholder="Action type"
        className="rounded-lg border px-3 py-2 text-sm"
      />
      <input
        type="date"
        name="from"
        defaultValue={filters.from}
        aria-label="From date"
        className="picker-input rounded-lg border px-3 py-2 text-sm"
      />
      <input
        type="date"
        name="to"
        defaultValue={filters.to}
        aria-label="To date"
        className="picker-input rounded-lg border px-3 py-2 text-sm"
      />
      <label className="block text-sm">
        <span className="sr-only">Display timezone</span>
        <select
          name="tz"
          defaultValue={timezone}
          className="w-full rounded-lg border px-3 py-2 text-sm"
          aria-label="Display timezone"
        >
          {tzOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <div className="flex flex-wrap items-center gap-2 md:col-span-6">
        <button type="submit" className="btn-primary px-4 py-2 text-sm">
          Search
        </button>
        <Link href="/admin/audit" className="btn-secondary px-4 py-2 text-sm">
          Clear
        </Link>
        <Link href="/admin/guide#audit" className="text-sm text-accent hover:underline">
          How to read this log (SOP)
        </Link>
        <Link href="/admin/guide#audit-actions" className="text-sm text-accent hover:underline">
          What each action means
        </Link>
        <span className="text-xs text-muted">
          Times are stored in UTC and shown in the timezone you pick. Date filters still use calendar
          days.
        </span>
      </div>
    </form>
  );
}

export function auditPageHref(
  filters: AuditSearchInput & { tz?: string },
  page: number,
) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...filters, page })) {
    if (value) params.set(key, String(value));
  }
  return `/admin/audit?${params.toString()}`;
}
