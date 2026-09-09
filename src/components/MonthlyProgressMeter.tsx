type MonthlyProgressMeterProps = {
  qualifyingDays: number;
  monthlyDaysTarget: number;
  metTarget: boolean;
  monthKey: string;
  totalHours?: number;
  compact?: boolean;
};

export function MonthlyProgressMeter({
  qualifyingDays,
  monthlyDaysTarget,
  metTarget,
  monthKey,
  totalHours,
  compact = false,
}: MonthlyProgressMeterProps) {
  const pct = Math.min(100, (qualifyingDays / monthlyDaysTarget) * 100);
  const remaining = Math.max(0, monthlyDaysTarget - qualifyingDays);
  const [year, month] = monthKey.split("-");
  const monthLabel = new Date(Number(year), Number(month) - 1, 1).toLocaleString("en-IN", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className={compact ? "card h-full p-4" : "card p-6"}>
      <div className="flex items-end justify-between gap-2">
        <div className="min-w-0">
          <p className={compact ? "text-xs text-muted" : "text-sm text-muted"}>
            {compact ? monthLabel : `Office days this month (${monthLabel})`}
          </p>
          <p className={`mt-0.5 font-bold ${compact ? "text-2xl" : "mt-1 text-4xl"}`}>
            {qualifyingDays}
            <span className={`font-normal text-muted ${compact ? "text-sm" : "text-lg"}`}>
              {" "}/ {monthlyDaysTarget} days
            </span>
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full font-medium ${compact ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm"} ${metTarget ? "badge-met" : "badge-pending"}`}
        >
          {metTarget ? "Target met" : `${remaining} day${remaining === 1 ? "" : "s"} to go`}
        </span>
      </div>
      <p className={`text-xs text-muted ${compact ? "mt-1.5" : "mt-2"}`}>
        {compact
          ? totalHours !== undefined
            ? `${totalHours.toFixed(1)}h total this month`
            : "Days meeting daily hours target"
          : "A day counts when you meet the daily hours target in office."}
        {!compact && totalHours !== undefined && (
          <>
            {" "}
            Total this month: <strong className="text-foreground">{totalHours.toFixed(1)}h</strong>.
          </>
        )}
      </p>
      <div className={`progress-track overflow-hidden rounded-full ${compact ? "mt-2 h-2" : "mt-4 h-3"}`}>
        <div
          className={`h-full rounded-full transition-all ${metTarget ? "progress-fill-met" : "progress-fill"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
