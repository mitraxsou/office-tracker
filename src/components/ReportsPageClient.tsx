"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { UserReportsDashboard } from "@/components/UserReportsDashboard";
import { ReportsVisitsTab } from "@/components/reports/ReportsVisitsTab";
import { UserCorrectionRequests } from "@/components/UserCorrectionRequests";

const TABS = [
  { id: "summary", label: "Summary", href: "/reports" },
  { id: "visits", label: "Visits", href: "/reports?tab=visits" },
  { id: "corrections", label: "Corrections", href: "/reports?tab=corrections" },
] as const;

export type ReportsTabId = (typeof TABS)[number]["id"];

export function parseReportsTab(raw: string | null): ReportsTabId {
  if (raw === "visits" || raw === "corrections") return raw;
  return "summary";
}

export function ReportsPageClient({
  fiscalYearStartMonth,
  fiscalYearEndMonth,
}: {
  fiscalYearStartMonth: number;
  fiscalYearEndMonth: number;
}) {
  const searchParams = useSearchParams();
  const tab = parseReportsTab(searchParams.get("tab"));

  return (
    <div className="space-y-6">
      <nav
        className="card-wash flex flex-wrap gap-1 rounded-lg border border-[var(--border)] p-1"
        aria-label="Reports sections"
      >
        {TABS.map((item) => {
          const active = tab === item.id;
          return (
            <Link
              key={item.id}
              href={item.href}
              className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                active
                  ? "bg-[var(--pwc-orange)]/15 text-accent"
                  : "text-muted hover:bg-[var(--border)]/40 hover:text-accent"
              }`}
              aria-current={active ? "page" : undefined}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      {tab === "summary" && (
        <UserReportsDashboard
          fiscalYearStartMonth={fiscalYearStartMonth}
          fiscalYearEndMonth={fiscalYearEndMonth}
        />
      )}
      {tab === "visits" && <ReportsVisitsTab />}
      {tab === "corrections" && <UserCorrectionRequests />}
    </div>
  );
}
