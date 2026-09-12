import { formatTime } from "@/lib/visits";

type StatusTone = "success" | "warning" | "neutral" | "muted";

type DashboardHeroSummaryProps = {
  totalHours: number;
  targetHours: number;
  metTarget: boolean;
  laptopActiveHours: number;
  firstCheckIn: Date | null;
  dayKey: string;
  timezone: string;
  inOfficeNow: boolean;
  agentStatusValue: string;
  agentStatusTone: StatusTone;
  lastHeartbeatLabel: string;
  lastHeartbeatTone: StatusTone;
  openVisitStartAt: Date | null;
  openVisitSsid: string | null;
};

const LAPTOP_TOOLTIP =
  "Time from your first agent activity today to your last (or now if the agent is still running). Counts whenever the My Office Pulse agent is active on your laptop, not only on office Wi-Fi.";

export function DashboardHeroSummary({
  totalHours,
  targetHours,
  metTarget,
  laptopActiveHours,
  firstCheckIn,
  dayKey,
  timezone,
  inOfficeNow,
  agentStatusValue,
  agentStatusTone,
  lastHeartbeatLabel,
  lastHeartbeatTone,
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

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <MiniStat
          label="In office"
          value={inOfficeNow ? "Yes" : "No"}
          tone={inOfficeNow ? "success" : "neutral"}
        />
        <MiniStat label="Agent" value={agentStatusValue} tone={agentStatusTone} />
        <MiniStat
          label="First check-in"
          value={firstCheckIn ? formatTime(firstCheckIn, timezone) : "None"}
          tone={firstCheckIn ? "success" : "muted"}
        />
        <MiniStat
          label="Laptop active"
          value={`${laptopActiveHours.toFixed(1)}h`}
          tooltip={LAPTOP_TOOLTIP}
        />
      </div>

      {openVisitStartAt && (
        <p className="mt-3 text-xs text-muted">
          Open visit since{" "}
          <strong className="text-accent">{formatTime(openVisitStartAt, timezone)}</strong>
          {openVisitSsid ? ` on ${openVisitSsid}` : ""}
        </p>
      )}

      <p className="mt-3 border-t border-[var(--border)] pt-3 text-xs text-muted">
        Last activity:{" "}
        <span className={toneClass(lastHeartbeatTone)}>{lastHeartbeatLabel}</span>
      </p>

      <p className="mt-2 text-[11px] text-muted">
        {dayKey} · First check-in to last check-out counts toward today&apos;s target.
      </p>
    </section>
  );
}

function toneClass(tone: StatusTone): string {
  if (tone === "success") return "text-green-400";
  if (tone === "warning") return "text-amber-400";
  if (tone === "muted") return "text-muted";
  return "text-foreground";
}

function MiniStat({
  label,
  value,
  tone = "neutral",
  tooltip,
}: {
  label: string;
  value: string;
  tone?: StatusTone;
  tooltip?: string;
}) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 py-2 sm:px-3">
      <div className="flex items-center justify-between gap-1">
        <p className="text-[10px] uppercase tracking-wide text-muted sm:text-xs">{label}</p>
        {tooltip && <MetricHelp tooltip={tooltip} />}
      </div>
      <p className={`mt-0.5 truncate text-sm font-semibold sm:text-base ${toneClass(tone)}`}>
        {value}
      </p>
    </div>
  );
}

function MetricHelp({ tooltip }: { tooltip: string }) {
  return (
    <span className="group relative inline-flex shrink-0">
      <button
        type="button"
        className="flex h-3.5 w-3.5 items-center justify-center rounded-full border border-[var(--border)] text-[9px] leading-none text-muted transition-colors hover:border-[var(--pwc-orange)] hover:text-[var(--pwc-orange)]"
        aria-label="Metric help"
      >
        ?
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute right-0 top-full z-20 mt-1 hidden w-52 rounded-md border border-[var(--border)] bg-[var(--background-elevated)] px-2.5 py-2 text-left text-[11px] leading-snug text-muted shadow-lg group-hover:block group-focus-within:block"
      >
        {tooltip}
      </span>
    </span>
  );
}
