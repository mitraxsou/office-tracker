"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  buildAdminUserReportHref,
  monthKeyFromDayKey,
  shiftDayKey,
} from "@/lib/admin-user-report-date";
import { dayKeyInTimezone } from "@/lib/timezone-dates";
import { formatHours, formatTime } from "@/lib/visits";

const STORAGE_KEY = "admin-office-day-roster-open";

export type OfficeDayRosterUser = {
  userId: string;
  email: string;
  name: string | null;
  hours: number;
  hoursTarget: number;
  metTarget: boolean;
  firstInAt: string | null;
  lastOutAt: string | null;
};

type Props = {
  selectedDate: string | null;
  timezone: string;
  users: OfficeDayRosterUser[];
  loading?: boolean;
  onSelectDate: (dayKey: string) => void;
};

function formatInOut(
  iso: string | null,
  timezone: string,
  emptyLabel: string,
): string {
  if (!iso) return emptyLabel;
  return formatTime(new Date(iso), timezone);
}

export function AdminOfficeDayRoster({
  selectedDate,
  timezone,
  users,
  loading = false,
  onSelectDate,
}: Props) {
  const todayKey = dayKeyInTimezone(new Date(), timezone);
  const dayKey = selectedDate ?? todayKey;
  const isToday = dayKey === todayKey;

  const [open, setOpen] = useState(true);

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored === "0") setOpen(false);
      if (stored === "1") setOpen(true);
    } catch {
      /* ignore */
    }
  }, []);

  function toggleOpen(next: boolean) {
    setOpen(next);
    try {
      sessionStorage.setItem(STORAGE_KEY, next ? "1" : "0");
    } catch {
      /* ignore */
    }
  }

  const attended = useMemo(
    () =>
      [...users].sort((a, b) => {
        const aIn = a.firstInAt ?? "";
        const bIn = b.firstInAt ?? "";
        return aIn.localeCompare(bIn) || a.email.localeCompare(b.email);
      }),
    [users],
  );

  return (
    <details
      className="card overflow-hidden"
      open={open}
      onToggle={(e) => toggleOpen((e.target as HTMLDetailsElement).open)}
    >
      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 px-4 py-3 marker:content-none [&::-webkit-details-marker]:hidden">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-wide text-muted">Day attendance</p>
          <h2 className="text-lg font-medium">
            In office that day
            <span className="ml-2 text-sm font-normal text-muted">
              ({attended.length}
              {isToday ? " today" : ""})
            </span>
          </h2>
          <p className="text-xs text-muted">
            Attended users with in/out times. Open a row to correct that day.
          </p>
        </div>
        <span className="rounded-md border border-[var(--border)] px-3 py-1.5 text-xs text-muted">
          {open ? "Hide" : "Show"}
        </span>
      </summary>

      <div className="space-y-3 border-t border-[var(--border)] px-4 py-4">
        <div className="flex flex-wrap items-end gap-2">
          <button
            type="button"
            className="btn-secondary min-h-11 px-3 py-1.5 text-xs"
            onClick={() => onSelectDate(todayKey)}
            aria-pressed={isToday}
          >
            Today
          </button>
          <button
            type="button"
            className="btn-secondary min-h-11 px-3 py-1.5 text-xs"
            onClick={() => onSelectDate(shiftDayKey(dayKey, -1))}
          >
            Previous
          </button>
          <button
            type="button"
            className="btn-secondary min-h-11 px-3 py-1.5 text-xs"
            onClick={() => onSelectDate(shiftDayKey(dayKey, 1))}
          >
            Next
          </button>
          <label className="text-sm">
            <span className="mb-1 block text-xs text-muted">Date</span>
            <input
              type="date"
              value={dayKey}
              onChange={(e) => {
                if (e.target.value) onSelectDate(e.target.value);
              }}
              className="picker-input min-h-11 rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-sm"
            />
          </label>
        </div>

        {loading ? (
          <p className="text-sm text-muted">Loading day roster...</p>
        ) : attended.length === 0 ? (
          <p className="text-sm text-muted">
            No one attended on {dayKey}. Pick another day or open a user report to add a visit.
          </p>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] text-left text-xs text-muted">
                    <th className="py-2 pr-3">Person</th>
                    <th className="py-2 pr-3">In</th>
                    <th className="py-2 pr-3">Out</th>
                    <th className="py-2 pr-3">Hours</th>
                    <th className="py-2">Open day</th>
                  </tr>
                </thead>
                <tbody>
                  {attended.map((u) => {
                    const href = buildAdminUserReportHref(u.userId, {
                      month: monthKeyFromDayKey(dayKey),
                      date: dayKey,
                    });
                    return (
                      <tr key={u.userId} className="border-b border-[var(--border)]">
                        <td className="py-2.5 pr-3">
                          <div className="font-medium">{u.name ?? u.email}</div>
                          {u.name ? (
                            <div className="text-xs text-muted">{u.email}</div>
                          ) : null}
                        </td>
                        <td className="py-2.5 pr-3">
                          {formatInOut(u.firstInAt, timezone, "-")}
                        </td>
                        <td className="py-2.5 pr-3">
                          {u.lastOutAt
                            ? formatInOut(u.lastOutAt, timezone, "-")
                            : isToday
                              ? "Still in"
                              : "-"}
                        </td>
                        <td className="py-2.5 pr-3">
                          <span className={u.metTarget ? "text-green-400" : ""}>
                            {formatHours(u.hours)}
                          </span>
                          <span className="text-xs text-muted"> / {u.hoursTarget}h</span>
                        </td>
                        <td className="py-2.5">
                          <Link href={href} className="text-xs text-accent hover:underline">
                            Open day
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <ul className="space-y-2 md:hidden">
              {attended.map((u) => {
                const href = buildAdminUserReportHref(u.userId, {
                  month: monthKeyFromDayKey(dayKey),
                  date: dayKey,
                });
                return (
                  <li
                    key={u.userId}
                    className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-3"
                  >
                    <div className="font-medium">{u.name ?? u.email}</div>
                    {u.name ? <div className="text-xs text-muted">{u.email}</div> : null}
                    <div className="mt-1 text-sm text-muted">
                      In {formatInOut(u.firstInAt, timezone, "-")}
                      {" · "}
                      Out{" "}
                      {u.lastOutAt
                        ? formatInOut(u.lastOutAt, timezone, "-")
                        : isToday
                          ? "Still in"
                          : "-"}
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className={u.metTarget ? "text-sm text-green-400" : "text-sm"}>
                        {formatHours(u.hours)} / {u.hoursTarget}h
                      </span>
                      <Link
                        href={href}
                        className="btn-secondary min-h-11 px-3 py-1.5 text-xs"
                      >
                        Open day
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </details>
  );
}
