type MonthlyProgressMeterProps = {
  qualifyingDays: number;
  monthlyDaysTarget: number;
  metTarget: boolean;
  monthKey: string;
};

export function MonthlyProgressMeter({
  qualifyingDays,
  monthlyDaysTarget,
  metTarget,
  monthKey,
}: MonthlyProgressMeterProps) {
  const pct = Math.min(100, (qualifyingDays / monthlyDaysTarget) * 100);
  const remaining = Math.max(0, monthlyDaysTarget - qualifyingDays);
  const [year, month] = monthKey.split("-");
  const monthLabel = new Date(Number(year), Number(month) - 1, 1).toLocaleString("en-IN", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="card p-6">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-sm text-muted">Office days this month ({monthLabel})</p>
          <p className="mt-1 text-4xl font-bold">
            {qualifyingDays}
            <span className="text-lg font-normal text-muted"> / {monthlyDaysTarget} days</span>
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-sm font-medium ${metTarget ? "badge-met" : "badge-pending"}`}
        >
          {metTarget ? "Target met" : `${remaining} day${remaining === 1 ? "" : "s"} to go`}
        </span>
      </div>
      <p className="mt-2 text-xs text-muted">
        A day counts when you meet the daily hours target in office.
      </p>
      <div className="progress-track mt-4 h-3 overflow-hidden rounded-full">
        <div
          className={`h-full rounded-full transition-all ${metTarget ? "progress-fill-met" : "progress-fill"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
