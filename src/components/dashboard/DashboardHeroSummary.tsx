import { formatTime } from "@/lib/visits";
import { toneClass, type StatusTone } from "@/components/dashboard/DashboardMiniStat";

type DashboardHeroSummaryProps = {
  totalHours: number;
  targetHours: number;
  metTarget: boolean;
  dayKey: string;
  timezone: string;
  lastSyncedLabel: string;
  lastSyncedTone: StatusTone;
  lastOfficeActivityLabel: string;
  lastOfficeActivityTone: StatusTone;
  openVisitStartAt: Date | null;
  openVisitSsid: string | null;
};

export function DashboardHeroSummary({
  totalHours,
  targetHours,
  metTarget,
  dayKey,
  timezone,
  lastSyncedLabel,
  lastSyncedTone,
  lastOfficeActivityLabel,
  lastOfficeActivityTone,
  openVisitStartAt,
  openVisitSsid,
}: DashboardHeroSummaryProps) {
  const pct = Math.min(100, (totalHours / targetHours) * 100);
  const remaining = Math.max(0, targetHours - totalHours);

  return (
    <section className="card p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted sm:text-sm">Today&apos;s office time</p>
          <p className="mt-0.5 text-3xl font-bold sm:text-4xl">
            {totalHours.toFixed(1)}
            <span className="text-base font-normal text-muted sm:text-lg"> / {targetHours}h</span>
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium sm:px-3 sm:text-sm ${metTarget ? "badge-met" : "badge-pending"}`}
        >
          {metTarget ? "Target met" : `${remaining.toFixed(1)}h left`}
        </span>
      </div>

      <div className="progress-track mt-3 h-2 overflow-hidden rounded-full sm:h-2.5">
        <div
          className={`h-full rounded-full transition-all ${metTarget ? "progress-fill-met" : "progress-fill"}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      {openVisitStartAt && (
        <p className="mt-3 text-xs text-muted">
          Open visit since{" "}
          <strong className="text-accent">{formatTime(openVisitStartAt, timezone)}</strong>
          {openVisitSsid ? ` on ${openVisitSsid}` : ""}
        </p>
      )}

      <div className="mt-3 space-y-1 border-t border-[var(--border)] pt-3 text-xs text-muted">
        <p>
          Last synced:{" "}
          <span className={toneClass(lastSyncedTone)}>{lastSyncedLabel}</span>
        </p>
        <p>
          Last office activity:{" "}
          <span className={toneClass(lastOfficeActivityTone)}>{lastOfficeActivityLabel}</span>
        </p>
      </div>

      <p className="mt-2 text-[11px] text-muted">
        {dayKey} · First check-in to last check-out counts toward today&apos;s target.
      </p>
    </section>
  );
}
