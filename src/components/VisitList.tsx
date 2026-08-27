import { formatHours, formatTime } from "@/lib/visits";
import { DEFAULT_TIMEZONE } from "@/lib/constants";

type Visit = {
  id: string;
  startAt: Date;
  endAt: Date | null;
  source: string;
  ssid: string | null;
};

export function VisitList({
  visits,
  timezone = DEFAULT_TIMEZONE,
}: {
  visits: Visit[];
  timezone?: string;
}) {
  if (visits.length === 0) {
    return <p className="text-sm text-muted">No visits recorded yet today.</p>;
  }

  return (
    <ul className="divide-y divide-[var(--border)]">
      {visits.map((visit) => {
        const end = visit.endAt ?? new Date();
        const durationMs = Math.max(0, end.getTime() - visit.startAt.getTime());
        const hours = durationMs / (1000 * 60 * 60);
        return (
          <li key={visit.id} className="flex items-center justify-between py-3">
            <div>
              <p className="font-medium">
                {formatTime(visit.startAt, timezone)} –{" "}
                {visit.endAt ? formatTime(visit.endAt, timezone) : "now"}
              </p>
              <p className="text-sm text-muted">
                {visit.source === "manual" ? "Manual" : "Wi-Fi"}
                {visit.ssid ? ` · ${visit.ssid}` : ""}
              </p>
            </div>
            <span className="text-sm font-medium text-accent">{formatHours(hours)}</span>
          </li>
        );
      })}
    </ul>
  );
}
