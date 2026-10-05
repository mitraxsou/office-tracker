import { formatTime } from "@/lib/visits";
import { toneClass, type StatusTone } from "@/components/dashboard/DashboardMiniStat";

type DashboardHeroSummaryProps = {
  totalHours: number;
  confirmedHours: number;
  targetHours: number;
  metTarget: boolean;
  inOfficeNow: boolean;
  dayKey: string;
  timezone: string;
  lastSyncedLabel: string;
  lastSyncedTone: StatusTone;
  lastOfficeActivityLabel: string;
  lastOfficeActivityTone: StatusTone;
  confirmedThroughLabel: string | null;
  openVisitStartAt: Date | null;
  openVisitSsid: string | null;
};

export function DashboardHeroSummary({
  totalHours,
  confirmedHours,
  targetHours,
  metTarget,
  inOfficeNow,
  dayKey,
  timezone,
  lastSyncedLabel,
  lastSyncedTone,
  lastOfficeActivityLabel,
  lastOfficeActivityTone,
  confirmedThroughLabel,
  openVisitStartAt,
  openVisitSsid,
}: DashboardHeroSummaryProps) {
  const remaining = Math.max(0, targetHours - totalHours);
  const estimatedHours = Math.max(0, totalHours - confirmedHours);
  const confirmedPct = Math.min(100, (confirmedHours / targetHours) * 100);
  const estimatedPct = Math.min(100 - confirmedPct, (estimatedHours / targetHours) * 100);
  const showEstimate = inOfficeNow && estimatedHours > 0.004;

  return (
    <section className="card card-brand card-wash p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted sm:text-sm">Today&apos;s office time</p>
          <p className="mt-0.5 text-3xl font-bold sm:text-4xl">
            {totalHours.toFixed(1)}
            <span className="text-base font-normal text-muted sm:text-lg"> / {targetHours}h</span>
          </p>
          {showEstimate && (
            <p className="mt-1 text-xs text-muted">
              <span className="text-foreground">{confirmedHours.toFixed(1)}h confirmed</span>
              {" · "}
              <span className="text-[var(--pwc-yellow)]">{estimatedHours.toFixed(1)}h estimated</span>
              {" until the next agent sync"}
            </p>
          )}
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium sm:px-3 sm:text-sm ${metTarget ? "badge-met" : "badge-pending"}`}
        >
          {metTarget ? "Target met" : `${remaining.toFixed(1)}h left`}
        </span>
      </div>

      <div className="progress-track mt-3 flex h-2 overflow-hidden rounded-full sm:h-2.5">
        <div
          className={`h-full ${metTarget && !showEstimate ? "progress-fill-met" : "progress-fill"}`}
          style={{ width: `${confirmedPct}%` }}
        />
        {showEstimate && (
          <div className="h-full progress-fill-estimated" style={{ width: `${estimatedPct}%` }} />
        )}
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

      {confirmedThroughLabel && (
        <p className="mt-2 text-xs text-foreground">{confirmedThroughLabel}</p>
      )}

      <p className="mt-2 text-[11px] text-muted">
        {dayKey} · Orange is time confirmed by the agent. Yellow is estimated from first check-in
        while you still look in office. The day total is final after the last agent sync.
      </p>
    </section>
  );
}
