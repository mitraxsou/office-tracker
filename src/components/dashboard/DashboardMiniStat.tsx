import { MetricHelp } from "@/components/MetricHelp";

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
      <p
        className={`mt-0.5 text-sm font-semibold tabular-nums leading-snug sm:text-base ${toneClass(tone)}`}
      >
        {value}
      </p>
    </div>
  );
}
