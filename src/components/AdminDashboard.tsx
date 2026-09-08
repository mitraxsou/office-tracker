"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ComplianceTrendChart,
  HoursTrendChart,
  StatusDonutChart,
  type DailyHoursPoint,
} from "@/components/reports/ReportCharts";
import { ComplianceExportButton } from "@/components/reports/ComplianceExportButton";
import {
  exportDailyTrendCsv,
  MonthReportToolbar,
  ReportFilters,
  useTableSort,
} from "@/components/reports/ReportToolbar";
import { currentMonthKey } from "@/lib/month-range";
import { exportToCsv } from "@/lib/report-range";
import { InOfficeNowPanel } from "@/components/InOfficeNowPanel";
import { AgentFollowUpPanel, useAgentFollowUpCount } from "@/components/AgentFollowUpPanel";
import { AdminOrgCalendar } from "@/components/AdminOrgCalendar";

type DailyPoint = { date: string; totalHours: number; compliancePct: number };

type UserRow = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  hoursTarget: number;
  today: {
    totalHours: number;
    metTarget: boolean;
    agentHealthy: boolean;
    inOfficeNow: boolean;
    lastHeartbeat: string | null;
  };
};

type DayDetailUser = {
  userId: string;
  email: string;
  name: string | null;
  hours: number;
  hoursTarget: number;
  metTarget: boolean;
  attended: boolean;
  status: string;
  agentHealthy: boolean;
};

type DayDetailData = {
  date: string;
  isWeekend: boolean;
  totalUsers: number;
  attendedCount: number;
  metTargetCount: number;
  compliancePct: number;
  excludedStale: number;
  excludedOoo: number;
  excludedNoVisit: number;
  users: DayDetailUser[];
};

type ReportsData = {
  summary: {
    totalUsers: number;
    inOfficeNow: number;
    attendedToday: number;
    metTodayPct: number;
    excludedStaleToday: number;
    excludedOooToday: number;
    avgHours: number;
    hoursTarget: number;
  };
  dailyTrend: DailyPoint[];
  statusBreakdown: { inOffice: number; notInOffice: number; noAgent: number };
  users: UserRow[];
  range: { days: number; from: string; to: string; month: string; currentMonth: string };
  auditLog: Array<{
    id: string;
    action: string;
    createdAt: string;
    actorEmail: string;
    targetEmail: string | null;
  }>;
};

export function AdminDashboard({
  fiscalYearStartMonth,
  fiscalYearEndMonth,
}: {
  fiscalYearStartMonth: number;
  fiscalYearEndMonth: number;
}) {
  const [monthKey, setMonthKey] = useState(() => currentMonthKey("Asia/Kolkata"));
  const [fromKey, setFromKey] = useState("");
  const [toKey, setToKey] = useState("");
  const [data, setData] = useState<ReportsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [dayDetail, setDayDetail] = useState<DayDetailData | null>(null);
  const [dayPicker, setDayPicker] = useState("");
  const [search, setSearch] = useState("");
  const [compliance, setCompliance] = useState<"all" | "met" | "not_met">("all");
  const [agentStatus, setAgentStatus] = useState<"all" | "healthy" | "stale" | "in_office">("all");
  const [inOfficePanelOpen, setInOfficePanelOpen] = useState(false);
  const [followUpPanelOpen, setFollowUpPanelOpen] = useState(false);
  const [followUpCount, setFollowUpCount] = useAgentFollowUpCount(!loading && !!data);
  const [viewTab, setViewTab] = useState<"charts" | "calendar">("charts");
  const [calendarMonthKey, setCalendarMonthKey] = useState(() => currentMonthKey("Asia/Kolkata"));

  const load = useCallback(
    async (month: string, silent = false) => {
      if (!silent) setLoading(true);
      else setRefreshing(true);

      const qs = new URLSearchParams();
      if (month) qs.set("month", month);

      const res = await fetch(`/api/admin/reports?${qs}`);
      if (!silent) setLoading(false);
      else setRefreshing(false);

      if (!res.ok) {
        if (!silent) setError("Failed to load reports");
        return;
      }
      setError(null);
      const json = await res.json();
      setData(json);
      setMonthKey(json.range.month);
      setFromKey(json.range.from);
      setToKey(json.range.to);
      setCalendarMonthKey(json.range.month);
      setSelectedDate(null);
      setDayDetail(null);
    },
    [],
  );

  useEffect(() => {
    void load("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadDayDetail(date: string) {
    const res = await fetch(`/api/admin/reports/day?date=${date}`);
    if (res.ok) {
      const json: DayDetailData = await res.json();
      setDayDetail(json);
      setSelectedDate(date);
      setDayPicker(date);
    }
  }

  async function handleBarClick(date: string) {
    if (selectedDate === date) {
      setSelectedDate(null);
      setDayDetail(null);
      return;
    }
    await loadDayDetail(date);
  }

  const filteredUsers = useMemo(() => {
    if (!data) return [];
    return data.users.filter((u) => {
      if (search) {
        const q = search.toLowerCase();
        if (!u.email.toLowerCase().includes(q) && !(u.name?.toLowerCase().includes(q) ?? false)) {
          return false;
        }
      }
      if (compliance === "met" && !u.today.metTarget) return false;
      if (compliance === "not_met" && u.today.metTarget) return false;
      if (agentStatus === "in_office" && !u.today.inOfficeNow) return false;
      if (agentStatus === "healthy" && !u.today.agentHealthy) return false;
      if (agentStatus === "stale" && u.today.agentHealthy) return false;
      return true;
    });
  }, [data, search, compliance, agentStatus]);

  const { sorted, toggleSort, sortKey, sortDir } = useTableSort(filteredUsers, "email");

  const chartData: DailyHoursPoint[] = useMemo(
    () =>
      (data?.dailyTrend ?? []).map((d) => ({
        date: d.date,
        totalHours: d.totalHours,
        compliancePct: d.compliancePct,
        metTarget: d.compliancePct >= 50,
      })),
    [data],
  );

  const displayUsers = useMemo(() => {
    if (selectedDate && dayDetail) {
      return dayDetail.users
        .filter((u) => u.attended)
        .map((d) => ({
          id: d.userId,
          email: d.email,
          name: d.name,
          role: "user",
          hoursTarget: d.hoursTarget,
          status: d.status,
          today: {
            totalHours: d.hours,
            metTarget: d.metTarget,
            agentHealthy: d.agentHealthy,
            inOfficeNow: false,
            lastHeartbeat: null,
          },
        }));
    }
    return sorted;
  }, [selectedDate, dayDetail, sorted]);

  const excludedDayUsers = useMemo(() => {
    if (!selectedDate || !dayDetail) return [];
    return dayDetail.users.filter((u) => !u.attended);
  }, [selectedDate, dayDetail]);

  return (
    <div className="space-y-6">
      <MonthReportToolbar monthKey={monthKey} onMonthChange={(m) => load(m)}>
        {refreshing && <span className="text-xs text-muted">Refreshing...</span>}
        <ComplianceExportButton
          hrefBase="/api/admin/reports/export"
          monthKey={monthKey}
          showFyOption
          label="Download org report"
          fiscalYearStartMonth={fiscalYearStartMonth}
          fiscalYearEndMonth={fiscalYearEndMonth}
        />
        <button
          type="button"
          onClick={() => {
            if (data) {
              exportDailyTrendCsv(`admin-office-hours-${monthKey}.csv`, chartData);
            }
          }}
          className="btn-secondary px-3 py-1.5 text-xs"
        >
          Quick chart CSV
        </button>
        <button
          type="button"
          onClick={() => load(monthKey, true)}
          className="btn-secondary px-3 py-1.5 text-xs"
        >
          Refresh
        </button>
      </MonthReportToolbar>

      {loading && !data && <p className="text-muted">Loading reports...</p>}
      {error && !data && <p className="text-red-400">{error}</p>}

      {data && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <SummaryCard label="Total users" value={String(data.summary.totalUsers)} />
            <SummaryCard
              label="In office now"
              value={String(data.summary.inOfficeNow)}
              onClick={() => setInOfficePanelOpen(true)}
              clickable
            />
            <SummaryCard
              label="Agents needing follow-up"
              value={followUpCount === null ? "..." : String(followUpCount)}
              onClick={() => setFollowUpPanelOpen(true)}
              clickable
            />
            <SummaryCard
              label="Attended today"
              value={String(data.summary.attendedToday)}
              sub={`${data.summary.metTodayPct}% met ${data.summary.hoursTarget}h target`}
            />
            <SummaryCard
              label="Avg hours (attended)"
              value={`${data.summary.avgHours}h`}
            />
          </div>

          <section className="card p-4">
            <div className="mb-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setViewTab("charts")}
                className={`rounded-md px-3 py-1.5 text-xs ${
                  viewTab === "charts"
                    ? "bg-[var(--pwc-orange)]/15 text-accent ring-1 ring-[var(--pwc-orange)]"
                    : "border border-[var(--border)] text-muted hover:text-accent"
                }`}
              >
                Charts
              </button>
              <button
                type="button"
                onClick={() => setViewTab("calendar")}
                className={`rounded-md px-3 py-1.5 text-xs ${
                  viewTab === "calendar"
                    ? "bg-[var(--pwc-orange)]/15 text-accent ring-1 ring-[var(--pwc-orange)]"
                    : "border border-[var(--border)] text-muted hover:text-accent"
                }`}
              >
                Calendar
              </button>
            </div>

            <div className="flex flex-wrap items-end gap-3">
              <label className="text-sm">
                <span className="mb-1 block text-xs text-muted">Day drill-down</span>
                <input
                  type="date"
                  value={dayPicker}
                  onChange={(e) => setDayPicker(e.target.value)}
                  className="rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-sm"
                />
              </label>
              <button
                type="button"
                className="btn-secondary px-3 py-1.5 text-xs"
                disabled={!dayPicker}
                onClick={() => void loadDayDetail(dayPicker)}
              >
                View day
              </button>
              {selectedDate && (
                <button
                  type="button"
                  className="text-xs text-accent hover:underline"
                  onClick={() => {
                    setSelectedDate(null);
                    setDayDetail(null);
                    setDayPicker("");
                  }}
                >
                  Clear day view
                </button>
              )}
            </div>
          </section>

          {selectedDate && dayDetail && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <SummaryCard label="Attended" value={String(dayDetail.attendedCount)} />
              <SummaryCard label="Met target" value={String(dayDetail.metTargetCount)} />
              <SummaryCard
                label="Compliance"
                value={`${dayDetail.compliancePct}%`}
                sub="Met target / attended (not all users)"
              />
              <SummaryCard label="Excluded (OOO)" value={String(dayDetail.excludedOoo)} />
              <SummaryCard label="Excluded (stale agent)" value={String(dayDetail.excludedStale)} />
            </div>
          )}

          <InOfficeNowPanel
            open={inOfficePanelOpen}
            onClose={() => setInOfficePanelOpen(false)}
          />

          <AgentFollowUpPanel
            open={followUpPanelOpen}
            onClose={() => setFollowUpPanelOpen(false)}
            initialCount={followUpCount ?? undefined}
            onCountChange={setFollowUpCount}
          />

          {viewTab === "calendar" ? (
            <section className="card p-6">
              <h2 className="mb-4 text-lg font-medium">Org office calendar ({calendarMonthKey})</h2>
              <AdminOrgCalendar
                monthKey={calendarMonthKey}
                selectedDate={selectedDate}
                onMonthChange={setCalendarMonthKey}
                onSelectDate={(dayKey) => void loadDayDetail(dayKey)}
              />
            </section>
          ) : (
            <>
          <div className="grid gap-4 lg:grid-cols-2">
            <section className="card p-6">
              <HoursTrendChart
                data={chartData}
                targetHours={data.summary.hoursTarget}
                title={`Org office hours (${monthKey})`}
                selectedDate={selectedDate}
                onBarClick={handleBarClick}
              />
              {selectedDate && dayDetail && (
                <p className="mt-2 text-xs text-muted">
                  {dayDetail.isWeekend
                    ? "Weekend day: stale agents are not penalized in compliance."
                    : "Compliance counts only users who attended. OOO and stale-agent users are excluded."}
                </p>
              )}
            </section>
            <section className="card p-6">
              <ComplianceTrendChart
                data={chartData}
                title="Compliance rate (% attended users met target)"
              />
            </section>
          </div>

          <section className="card p-6">
            <StatusDonutChart breakdown={data.statusBreakdown} title="Users by status today" />
          </section>
            </>
          )}

          <section className="card p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-medium">
                {selectedDate ? `Attended on ${selectedDate}` : "Users today"}
              </h2>
              {!selectedDate && (
                <ReportFilters
                  search={search}
                  onSearchChange={setSearch}
                  compliance={compliance}
                  onComplianceChange={setCompliance}
                  agentStatus={agentStatus}
                  onAgentStatusChange={setAgentStatus}
                />
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] text-left text-muted">
                    <th className="cursor-pointer py-2 pr-4" onClick={() => toggleSort("email")}>
                      User {sortKey === "email" ? (sortDir === "asc" ? "↑" : "↓") : ""}
                    </th>
                    <th className="py-2 pr-4">Hours</th>
                    <th className="py-2 pr-4">Target met</th>
                    {!selectedDate && (
                      <>
                        <th className="py-2 pr-4">Agent</th>
                        <th className="py-2 pr-4">Last pulse</th>
                        <th className="py-2">Report</th>
                      </>
                    )}
                    {selectedDate && <th className="py-2">Agent</th>}
                  </tr>
                </thead>
                <tbody>
                  {displayUsers.map((u) => (
                    <tr key={u.id} className="border-b border-[var(--border)]">
                      <td className="py-3 pr-4">
                        <div className="font-medium">{u.email}</div>
                        {u.name && <div className="text-xs text-muted">{u.name}</div>}
                      </td>
                      <td className="py-3 pr-4">
                        {u.today.totalHours.toFixed(1)}h / {u.hoursTarget}h
                      </td>
                      <td className="py-3 pr-4">
                        <span className={u.today.metTarget ? "text-green-400" : "text-accent"}>
                          {u.today.metTarget ? "Yes" : "No"}
                        </span>
                      </td>
                      {!selectedDate && (
                        <>
                          <td className="py-3 pr-4">
                            {u.today.agentHealthy ? "Healthy" : "Stale"}
                          </td>
                          <td className="py-3 pr-4 text-xs text-muted">
                            {u.today.lastHeartbeat
                              ? new Date(u.today.lastHeartbeat).toLocaleString("en-IN")
                              : "None"}
                          </td>
                          <td className="py-3">
                            <Link
                              href={`/admin/reports/users/${u.id}`}
                              className="text-xs text-accent hover:underline"
                            >
                              View report
                            </Link>
                          </td>
                        </>
                      )}
                      {selectedDate && (
                        <td className="py-3">
                          {u.today.agentHealthy ? "Healthy" : "Stale"}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {selectedDate && excludedDayUsers.length > 0 && (
              <div className="mt-4 rounded border border-[var(--border)] bg-[var(--background)] p-4">
                <h3 className="text-sm font-medium">Excluded from compliance</h3>
                <ul className="mt-2 space-y-1 text-xs text-muted">
                  {excludedDayUsers.map((u) => (
                    <li key={u.userId}>
                      {u.email}
                      {" - "}
                      {u.status === "excluded_ooo"
                        ? "Out of office"
                        : u.status === "excluded_stale"
                          ? "Stale agent (untrusted data)"
                          : "No office visit"}
                      {u.hours > 0 ? ` (${u.hours.toFixed(1)}h logged)` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {!selectedDate && (
              <button
                type="button"
                className="btn-secondary mt-3 px-3 py-1 text-xs"
                onClick={() => {
                  exportToCsv(
                    `users-today-${fromKey}.csv`,
                    ["Email", "Name", "Hours", "Target", "Met", "Agent"],
                    filteredUsers.map((u) => [
                      u.email,
                      u.name ?? "",
                      u.today.totalHours.toFixed(1),
                      String(u.hoursTarget),
                      u.today.metTarget ? "Yes" : "No",
                      u.today.agentHealthy ? "Healthy" : "Stale",
                    ]),
                  );
                }}
              >
                Export filtered users
              </button>
            )}
          </section>

          <section className="card p-6">
            <h2 className="mb-4 text-lg font-medium">Admin activity log</h2>
            {data.auditLog.length === 0 ? (
              <p className="text-sm text-muted">No admin actions yet.</p>
            ) : (
              <ul className="divide-y divide-[var(--border)] text-sm">
                {data.auditLog.map((log) => (
                  <li key={log.id} className="py-2">
                    <span className="text-muted">
                      {new Date(log.createdAt).toLocaleString("en-IN")}
                    </span>
                    {" · "}
                    <span className="font-medium">{log.action.replace(/_/g, " ")}</span>
                    {" by "}
                    {log.actorEmail}
                    {log.targetEmail && <> for {log.targetEmail}</>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  sub,
  onClick,
  clickable,
}: {
  label: string;
  value: string;
  sub?: string;
  onClick?: () => void;
  clickable?: boolean;
}) {
  const className = [
    "card p-4 text-left",
    clickable ? "cursor-pointer transition-colors hover:border-[var(--pwc-orange)]" : "",
  ]
    .filter(Boolean)
    .join(" ");

  if (clickable && onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        <p className="text-xs text-muted">{label}</p>
        <p className="mt-1 text-2xl font-semibold text-accent">{value}</p>
        {sub && <p className="mt-1 text-xs text-muted">{sub}</p>}
        <p className="mt-1 text-xs text-muted">Click to view list</p>
      </button>
    );
  }

  return (
    <div className={className}>
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
      {sub && <p className="mt-1 text-xs text-muted">{sub}</p>}
    </div>
  );
}
