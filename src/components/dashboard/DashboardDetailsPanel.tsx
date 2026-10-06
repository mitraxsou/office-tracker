"use client";

import { useState } from "react";
import { VisitList } from "@/components/VisitList";
import { ManualVisitForm } from "@/components/ManualVisitForm";

type Visit = {
  id: string;
  startAt: Date;
  endAt: Date | null;
  source: string;
  ssid: string | null;
};

type TabId = "visits" | "manual";

type DashboardDetailsPanelProps = {
  visits: Visit[];
  timezone: string;
  visitCount: number;
};

const TABS: { id: TabId; label: string }[] = [
  { id: "visits", label: "Visits" },
  { id: "manual", label: "Manual visit" },
];

export function DashboardDetailsPanel({
  visits,
  timezone,
  visitCount,
}: DashboardDetailsPanelProps) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<TabId>("visits");

  const summary =
    visitCount === 0
      ? "No visits yet today"
      : `${visitCount} visit${visitCount === 1 ? "" : "s"} today`;

  return (
    <section className="card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--background)]"
        aria-expanded={open}
      >
        <div>
          <p className="text-sm font-medium">Activity details</p>
          <p className="text-xs text-muted">{summary}</p>
        </div>
        <span className="text-muted" aria-hidden>
          {open ? "−" : "+"}
        </span>
      </button>

      {open && (
        <div className="border-t border-[var(--border)] px-4 pb-4 pt-3">
          <div className="mb-3 flex flex-wrap gap-1">
            {TABS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  tab === item.id
                    ? "bg-[var(--pwc-orange-muted)] text-accent"
                    : "text-muted hover:text-foreground"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {tab === "visits" && (
            <div>
              <p className="mb-2 text-xs text-muted">Office sessions recorded for today.</p>
              <VisitList visits={visits} timezone={timezone} />
            </div>
          )}

          {tab === "manual" && <ManualVisitForm timezone={timezone} embedded />}
        </div>
      )}
    </section>
  );
}
