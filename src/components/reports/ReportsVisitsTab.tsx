"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { VisitList } from "@/components/VisitList";
import { MonthReportToolbar } from "@/components/reports/ReportToolbar";
import { currentMonthKey } from "@/lib/month-range";
import { formatDate } from "@/lib/visits";

type VisitJson = {
  id: string;
  startAt: string;
  endAt: string | null;
  source: string;
  ssid: string | null;
};

type VisitRow = {
  id: string;
  startAt: Date;
  endAt: Date | null;
  source: string;
  ssid: string | null;
};

function parseVisits(rows: VisitJson[]): VisitRow[] {
  return rows.map((v) => ({
    id: v.id,
    startAt: new Date(v.startAt),
    endAt: v.endAt ? new Date(v.endAt) : null,
    source: v.source,
    ssid: v.ssid,
  }));
}

export function ReportsVisitsTab() {
  const [scope, setScope] = useState<"month" | "recent">("recent");
  const [monthKey, setMonthKey] = useState(() => currentMonthKey("Asia/Kolkata"));
  const [timezone, setTimezone] = useState("Asia/Kolkata");
  const [visits, setVisits] = useState<VisitRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    if (scope === "recent") {
      const tzQs = new URLSearchParams({ month: monthKey });
      const [visitsRes, tzRes] = await Promise.all([
        fetch("/api/visits"),
        fetch(`/api/user/reports?${tzQs}`),
      ]);
      setLoading(false);
      if (tzRes.ok) {
        const tzJson = (await tzRes.json()) as { user?: { timezone: string } };
        if (tzJson.user?.timezone) setTimezone(tzJson.user.timezone);
      }
      if (!visitsRes.ok) {
        setError("Failed to load recent visits.");
        return;
      }
      const json = (await visitsRes.json()) as { visits: VisitJson[] };
      setVisits(parseVisits(json.visits ?? []));
      return;
    }

    const qs = new URLSearchParams({ month: monthKey });
    const res = await fetch(`/api/user/reports?${qs}`);
    setLoading(false);
    if (!res.ok) {
      setError("Failed to load visits for this month.");
      return;
    }
    const json = (await res.json()) as {
      visits: VisitJson[];
      user: { timezone: string };
    };
    setTimezone(json.user?.timezone ?? "Asia/Kolkata");
    setVisits(parseVisits(json.visits ?? []));
  }, [scope, monthKey]);

  useEffect(() => {
    void load();
  }, [load]);

  const grouped = useMemo(() => {
    return visits.reduce<Record<string, VisitRow[]>>((acc, visit) => {
      const key = formatDate(visit.startAt, timezone);
      acc[key] = acc[key] ?? [];
      acc[key].push(visit);
      return acc;
    }, {});
  }, [visits, timezone]);

  const dayKeys = useMemo(() => Object.keys(grouped), [grouped]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div
          className="inline-flex rounded-lg border border-[var(--border)] p-0.5 text-sm"
          role="group"
          aria-label="Visit list scope"
        >
          <button
            type="button"
            onClick={() => setScope("month")}
            className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
              scope === "month"
                ? "bg-[var(--pwc-orange)]/15 text-accent"
                : "text-muted hover:text-accent"
            }`}
          >
            This month
          </button>
          <button
            type="button"
            onClick={() => setScope("recent")}
            className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
              scope === "recent"
                ? "bg-[var(--pwc-orange)]/15 text-accent"
                : "text-muted hover:text-accent"
            }`}
          >
            Recent 50
          </button>
        </div>
      </div>
      {scope === "month" && (
        <MonthReportToolbar monthKey={monthKey} timezone={timezone} onMonthChange={setMonthKey} />
      )}

      <p className="text-sm text-muted">
        {scope === "recent"
          ? "Your last 50 visits across all months. Use Report issue if auto-tracking missed office time."
          : "All visits in the selected month. Use Report issue to request an admin correction."}
      </p>

      {loading && <p className="text-muted">Loading visits...</p>}
      {error && !loading && <p className="text-red-400">{error}</p>}
      {!loading && !error && dayKeys.length === 0 && (
        <p className="text-muted">No visits in this view yet.</p>
      )}
      {!loading &&
        !error &&
        dayKeys.map((day) => (
          <section key={day} className="card p-6">
            <h2 className="mb-4 font-medium text-accent">{day}</h2>
            <VisitList visits={grouped[day] ?? []} timezone={timezone} />
          </section>
        ))}
    </div>
  );
}
