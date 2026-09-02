import type { YearCompliance } from "@/lib/monthly-progress";
import { formatMonthLabel } from "@/lib/month-range";

type YearComplianceMeterProps = {
  compliance: YearCompliance;
  timezone: string;
};

export function YearComplianceMeter({ compliance, timezone }: YearComplianceMeterProps) {
  const pct =
    compliance.monthsElapsed > 0
      ? Math.min(100, (compliance.compliantMonths / compliance.monthsElapsed) * 100)
      : 0;
  const allCompliant =
    compliance.monthsElapsed > 0 && compliance.compliantMonths === compliance.monthsElapsed;

  return (
    <div className="card p-6">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-sm text-muted">Year compliance ({compliance.year})</p>
          <p className="mt-1 text-4xl font-bold">
            {compliance.compliantMonths}
            <span className="text-lg font-normal text-muted">
              {" "}
              / {compliance.monthsElapsed} month{compliance.monthsElapsed === 1 ? "" : "s"}
            </span>
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-sm font-medium ${allCompliant ? "badge-met" : "badge-pending"}`}
        >
          {allCompliant ? "All months met" : "Monthly days target"}
        </span>
      </div>
      <p className="mt-2 text-xs text-muted">
        Months where you hit the office-days target ({compliance.monthDetails[0]?.monthlyDaysTarget ?? 8}{" "}
        qualifying days per month).
      </p>
      <div className="progress-track mt-4 h-3 overflow-hidden rounded-full">
        <div
          className={`h-full rounded-full transition-all ${allCompliant ? "progress-fill-met" : "progress-fill"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {compliance.monthDetails.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {compliance.monthDetails.map((month) => (
            <span
              key={month.monthKey}
              title={`${formatMonthLabel(month.monthKey, timezone)}: ${month.qualifyingDays}/${month.monthlyDaysTarget} days`}
              className={`rounded-md px-2 py-1 text-xs font-medium ${
                month.metTarget
                  ? "bg-green-500/15 text-green-400"
                  : "border border-[var(--border)] text-muted"
              }`}
            >
              {formatMonthLabel(month.monthKey, timezone).split(" ")[0]}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
