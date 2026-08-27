type ProgressMeterProps = {
  totalHours: number;
  targetHours: number;
  metTarget: boolean;
};

export function ProgressMeter({ totalHours, targetHours, metTarget }: ProgressMeterProps) {
  const pct = Math.min(100, (totalHours / targetHours) * 100);
  const remaining = Math.max(0, targetHours - totalHours);

  return (
    <div className="card p-6">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-sm text-muted">Today&apos;s office time</p>
          <p className="mt-1 text-4xl font-bold">
            {totalHours.toFixed(1)}
            <span className="text-lg font-normal text-muted"> / {targetHours}h</span>
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-sm font-medium ${metTarget ? "badge-met" : "badge-pending"}`}>
          {metTarget ? "Target met" : `${remaining.toFixed(1)}h remaining`}
        </span>
      </div>
      <div className="progress-track mt-4 h-3 overflow-hidden rounded-full">
        <div
          className={`h-full rounded-full transition-all ${metTarget ? "progress-fill-met" : "progress-fill"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
