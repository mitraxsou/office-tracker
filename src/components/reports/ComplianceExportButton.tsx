"use client";

import { currentMonthKey } from "@/lib/month-range";
import {
  currentFyParam,
  formatFiscalYearSpanLabel,
  normalizeFiscalYearConfig,
} from "@/lib/fiscal-year";

type ComplianceExportButtonProps = {
  hrefBase: string;
  monthKey: string;
  timezone?: string;
  label?: string;
  showFyOption?: boolean;
  fiscalYearStartMonth?: number;
  fiscalYearEndMonth?: number;
};

export function ComplianceExportButton({
  hrefBase,
  monthKey,
  timezone = "Asia/Kolkata",
  label = "Download Excel report",
  showFyOption = false,
  fiscalYearStartMonth,
  fiscalYearEndMonth,
}: ComplianceExportButtonProps) {
  const fyConfig = normalizeFiscalYearConfig({
    startMonth: fiscalYearStartMonth,
    endMonth: fiscalYearEndMonth,
  });
  const monthHref = `${hrefBase}?month=${encodeURIComponent(monthKey)}`;
  const fyParam = currentFyParam(timezone, fyConfig);
  const fyHref = `${hrefBase}?fy=${encodeURIComponent(fyParam)}`;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <a href={monthHref} className="btn-secondary px-3 py-1.5 text-xs">
        {label} ({monthKey})
      </a>
      {showFyOption && (
        <a href={fyHref} className="btn-secondary px-3 py-1.5 text-xs">
          Download FY report ({formatFiscalYearSpanLabel(fyConfig)})
        </a>
      )}
    </div>
  );
}

export function defaultExportMonth(timezone = "Asia/Kolkata") {
  return currentMonthKey(timezone);
}
