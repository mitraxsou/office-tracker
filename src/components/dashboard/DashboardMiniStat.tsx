export type StatusTone = "success" | "warning" | "neutral" | "muted";

export function toneClass(tone: StatusTone): string {
  if (tone === "success") return "text-green-400";
  if (tone === "warning") return "text-amber-400";
  if (tone === "muted") return "text-muted";
  return "text-foreground";
}

export function DashboardMiniStat({
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
