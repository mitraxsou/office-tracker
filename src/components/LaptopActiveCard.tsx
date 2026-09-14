import { formatTime } from "@/lib/visits";

type LaptopActiveCardProps = {
  laptopActiveHours: number;
  firstAgentOnAt?: Date | null;
  timezone?: string;
};

const TOOLTIP =
  "Total time today your laptop was on with the My Office Pulse agent running. Sleep and long gaps between pulses are excluded.";

export function LaptopActiveCard({
  laptopActiveHours,
  firstAgentOnAt,
  timezone,
}: LaptopActiveCardProps) {
  return (
    <div className="card border border-[var(--border)] p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm text-muted">Agent uptime today</p>
        <MetricHelp tooltip={TOOLTIP} />
      </div>
      <p className="mt-1 text-2xl font-semibold">
        {laptopActiveHours.toFixed(1)}
        <span className="text-base font-normal text-muted">h</span>
      </p>
      <p className="mt-1 text-xs text-muted">
        {firstAgentOnAt && timezone
          ? `First switch-on ${formatTime(firstAgentOnAt, timezone)}.`
          : "Reported by your laptop agent."}
      </p>
    </div>
  );
}

function MetricHelp({ tooltip }: { tooltip: string }) {
  return (
    <span className="group relative inline-flex shrink-0">
      <button
        type="button"
        className="flex h-4 w-4 items-center justify-center rounded-full border border-[var(--border)] text-[10px] leading-none text-muted transition-colors hover:border-[var(--pwc-orange)] hover:text-[var(--pwc-orange)]"
        aria-label="Metric help"
      >
        ?
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute right-0 top-full z-20 mt-1 hidden w-56 rounded-md border border-[var(--border)] bg-[var(--background-elevated)] px-2.5 py-2 text-left text-[11px] leading-snug text-muted shadow-lg group-hover:block group-focus-within:block"
      >
        {tooltip}
      </span>
    </span>
  );
}
