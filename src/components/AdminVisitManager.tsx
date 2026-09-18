"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DateTimeField, dateTimeLocalToIso, toLocalDateTimeInput } from "@/components/DateTimeField";
import { SsidSelect } from "@/components/SsidSelect";
import { dayKeyInTimezone, formatHours, formatTime } from "@/lib/visits";

type Visit = {
  id: string;
  startAt: string;
  endAt: string | null;
  source: string;
  ssid: string | null;
};

type DayGroup = {
  dayKey: string;
  visits: Visit[];
};

type Props = {
  userId: string;
  officeSsids: string[];
  timezone: string;
  onChanged?: () => void;
  /** Prefill day filter and add-visit date when set. */
  focusDay?: string | null;
};

const NO_SSID = "__none__";

function CheckInIcon() {
  return (
    <svg
      aria-hidden
      className="h-4 w-4 text-accent"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M11 16l-4-4m0 0l4-4m-4 4h14" />
    </svg>
  );
}

function CheckOutIcon() {
  return (
    <svg
      aria-hidden
      className="h-4 w-4 text-muted"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 16l4-4m0 0l-4-4m4 4H3" />
    </svg>
  );
}

function visitHours(visit: Visit): number | null {
  if (!visit.endAt) return null;
  const ms = new Date(visit.endAt).getTime() - new Date(visit.startAt).getTime();
  return Math.max(0, ms) / (1000 * 60 * 60);
}

export function AdminVisitManager({
  userId,
  officeSsids,
  timezone,
  onChanged,
  focusDay = null,
}: Props) {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");
  const [editSsid, setEditSsid] = useState("");
  const [editOpenVisit, setEditOpenVisit] = useState(false);

  const [addStart, setAddStart] = useState("");
  const [addEnd, setAddEnd] = useState("");
  const [addSsid, setAddSsid] = useState(officeSsids[0] ?? "");
  const [addCheckout, setAddCheckout] = useState(false);

  const [filterSsid, setFilterSsid] = useState("all");
  const [filterDay, setFilterDay] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/visits?userId=${userId}&limit=100`);
    setLoading(false);
    if (!res.ok) {
      setError("Failed to load visits");
      return;
    }
    const data = await res.json();
    setVisits(data.visits ?? []);
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!focusDay) return;
    setFilterDay(focusDay);
    setAddStart((current) => {
      if (current && current.startsWith(focusDay)) return current;
      return `${focusDay}T09:00`;
    });
  }, [focusDay]);

  const ssidOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const visit of visits) {
      const key = visit.ssid ?? NO_SSID;
      if (!seen.has(key)) seen.set(key, visit.ssid ?? "No SSID");
    }
    return [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [visits]);

  const filtered = useMemo(() => {
    return visits.filter((visit) => {
      if (filterSsid !== "all" && (visit.ssid ?? NO_SSID) !== filterSsid) return false;
      if (filterDay && dayKeyInTimezone(new Date(visit.startAt), timezone) !== filterDay) {
        return false;
      }
      return true;
    });
  }, [visits, filterSsid, filterDay, timezone]);

  const groups = useMemo<DayGroup[]>(() => {
    const byDay = new Map<string, Visit[]>();
    for (const visit of filtered) {
      const dayKey = dayKeyInTimezone(new Date(visit.startAt), timezone);
      const rows = byDay.get(dayKey) ?? [];
      rows.push(visit);
      byDay.set(dayKey, rows);
    }
    return [...byDay.entries()]
      .map(([dayKey, dayVisits]) => ({
        dayKey,
        visits: dayVisits.sort(
          (a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime(),
        ),
      }))
      .sort((a, b) => b.dayKey.localeCompare(a.dayKey));
  }, [filtered, timezone]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setBusy(true);
    const res = await fetch("/api/admin/visits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        startAt: dateTimeLocalToIso(addStart),
        endAt: addCheckout && addEnd ? dateTimeLocalToIso(addEnd) : null,
        ssid: addSsid || null,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to add visit");
      return;
    }
    setMessage(addCheckout ? "Visit added." : "Open visit added.");
    setAddStart("");
    setAddEnd("");
    setAddCheckout(false);
    setAddSsid(officeSsids[0] ?? "");
    load();
    onChanged?.();
  }

  async function handleDelete(visit: Visit) {
    const startLabel = formatTime(new Date(visit.startAt), timezone);
    const endLabel = visit.endAt
      ? formatTime(new Date(visit.endAt), timezone)
      : "open";
    if (
      !confirm(
        `Delete this visit (${startLabel} to ${endLabel}, ${visit.source})? This cannot be undone.`,
      )
    ) {
      return;
    }
    setError(null);
    setMessage(null);
    setBusy(true);
    const res = await fetch(`/api/admin/visits?id=${encodeURIComponent(visit.id)}`, {
      method: "DELETE",
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to delete visit");
      return;
    }
    if (editingId === visit.id) {
      setEditingId(null);
    }
    setMessage("Visit deleted.");
    load();
    onChanged?.();
  }

  async function saveEdit(id: string) {
    setError(null);
    setBusy(true);
    const res = await fetch("/api/admin/visits", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id,
        startAt: dateTimeLocalToIso(editStart),
        endAt: editOpenVisit || !editEnd ? null : dateTimeLocalToIso(editEnd),
        ssid: editSsid || null,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to update visit");
      return;
    }
    setEditingId(null);
    setMessage("Visit updated.");
    load();
    onChanged?.();
  }

  function startEdit(visit: Visit) {
    setEditingId(visit.id);
    setEditStart(toLocalDateTimeInput(new Date(visit.startAt)));
    setEditEnd(visit.endAt ? toLocalDateTimeInput(new Date(visit.endAt)) : "");
    setEditOpenVisit(visit.endAt === null);
    setEditSsid(visit.ssid ?? officeSsids[0] ?? "");
  }

  return (
    <section id="visit-data" className="card scroll-mt-20 p-6">
      <h2 className="mb-1 text-lg font-medium">Visit data</h2>
      <p className="mb-5 text-sm text-muted">
        Add a visit when the agent missed one, correct times on an existing entry, or delete
        incorrect records. Times use the calendar pickers and are saved in {timezone}.
        {focusDay ? (
          <>
            {" "}
            Showing and adding for <span className="text-accent">{focusDay}</span>.
          </>
        ) : null}
      </p>

      <form onSubmit={handleAdd} className="mb-6 space-y-4">
        <div className="rounded-lg border border-[var(--border)] p-4">
          <div className="mb-3 flex items-center gap-2">
            <CheckInIcon />
            <p className="text-sm font-medium">Check-in</p>
          </div>
          <DateTimeField label="When they arrived" value={addStart} onChange={setAddStart} required />
        </div>

        <label className="flex items-start gap-3 rounded-lg border border-[var(--border)] px-4 py-3 text-sm">
          <input
            type="checkbox"
            checked={addCheckout}
            onChange={(e) => {
              setAddCheckout(e.target.checked);
              if (!e.target.checked) setAddEnd("");
            }}
            className="mt-0.5"
          />
          <span>
            <span className="font-medium">Add check-out time</span>
            <span className="mt-0.5 block text-xs text-muted">
              Leave unchecked for an open visit. The agent or a manual check-out can close it later.
            </span>
          </span>
        </label>

        {addCheckout && (
          <div className="rounded-lg border border-[var(--border)] p-4">
            <div className="mb-3 flex items-center gap-2">
              <CheckOutIcon />
              <p className="text-sm font-medium">Check-out</p>
              <span className="rounded bg-[var(--pwc-orange-muted)] px-2 py-0.5 text-xs text-accent">
                Optional
              </span>
            </div>
            <DateTimeField label="When they left" value={addEnd} onChange={setAddEnd} />
          </div>
        )}

        <div>
          <label className="mb-1 block text-sm text-muted">Office Wi-Fi (SSID)</label>
          <SsidSelect
            officeSsids={officeSsids}
            value={addSsid}
            onChange={setAddSsid}
            allowEmpty={false}
          />
        </div>

        <button type="submit" disabled={busy} className="btn-primary px-4 py-2 text-sm disabled:opacity-50">
          Add visit
        </button>
      </form>

      <div className="mb-3 flex flex-wrap items-end gap-3 border-t border-[var(--border)] pt-5">
        <label className="text-sm">
          <span className="mb-1 block text-muted">Wi-Fi name</span>
          <select
            value={filterSsid}
            onChange={(e) => setFilterSsid(e.target.value)}
            className="rounded-lg border px-3 py-2 text-sm"
          >
            <option value="all">All Wi-Fi names</option>
            {ssidOptions.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-muted">Day</span>
          <input
            type="date"
            value={filterDay}
            onChange={(e) => setFilterDay(e.target.value)}
            className="picker-input rounded-lg border px-3 py-2 text-sm"
          />
        </label>
        {(filterSsid !== "all" || filterDay) && (
          <button
            type="button"
            onClick={() => {
              setFilterSsid("all");
              setFilterDay("");
            }}
            className="btn-secondary px-3 py-2 text-sm"
          >
            Clear filters
          </button>
        )}
        <p className="ml-auto text-xs text-muted">
          {filtered.length} of {visits.length} visits shown
        </p>
      </div>

      {loading && <p className="text-sm text-muted">Loading visits...</p>}
      {!loading && visits.length === 0 && <p className="text-sm text-muted">No visits in range.</p>}
      {!loading && visits.length > 0 && filtered.length === 0 && (
        <p className="text-sm text-muted">No visits match these filters.</p>
      )}

      <div className="space-y-4">
        {groups.map((group) => {
          return (
            <div key={group.dayKey} className="rounded-lg border border-[var(--border)]">
              <div className="flex flex-wrap items-center gap-3 border-b border-[var(--border)] px-3 py-2">
                <span className="text-sm font-medium">{group.dayKey}</span>
                <span className="text-xs text-muted">
                  {group.visits.length} visit{group.visits.length === 1 ? "" : "s"}
                </span>
              </div>

              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] text-left text-xs text-muted">
                    <th className="py-2 pl-3 pr-3">Start</th>
                    <th className="py-2 pr-3">End</th>
                    <th className="py-2 pr-3">Duration</th>
                    <th className="py-2 pr-3">Source</th>
                    <th className="py-2 pr-3">SSID</th>
                    <th className="py-2 pr-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {group.visits.map((visit) => {
                    const hours = visitHours(visit);
                    return (
                      <tr key={visit.id} className="border-b border-[var(--border)] last:border-0">
                        {editingId === visit.id ? (
                          <>
                            <td className="py-2 pl-3 pr-3 align-top">
                              <DateTimeField label="" value={editStart} onChange={setEditStart} required />
                            </td>
                            <td className="py-2 pr-3 align-top" colSpan={2}>
                              <label className="mb-2 flex items-center gap-2 text-xs">
                                <input
                                  type="checkbox"
                                  checked={editOpenVisit}
                                  onChange={(e) => {
                                    setEditOpenVisit(e.target.checked);
                                    if (e.target.checked) setEditEnd("");
                                  }}
                                />
                                Leave open (no check-out)
                              </label>
                              {!editOpenVisit && (
                                <DateTimeField label="" value={editEnd} onChange={setEditEnd} />
                              )}
                            </td>
                            <td className="py-2 pr-3 align-top text-muted">{visit.source}</td>
                            <td className="py-2 pr-3 align-top">
                              <SsidSelect
                                officeSsids={officeSsids}
                                value={editSsid}
                                onChange={setEditSsid}
                                allowEmpty={false}
                                className="w-full rounded border px-2 py-1 text-xs"
                              />
                            </td>
                            <td className="py-2 pr-3 align-top">
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => saveEdit(visit.id)}
                                className="mr-2 text-xs text-accent hover:underline disabled:opacity-40"
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingId(null)}
                                className="text-xs text-muted hover:underline"
                              >
                                Cancel
                              </button>
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="py-2 pl-3 pr-3 text-xs">
                              {formatTime(new Date(visit.startAt), timezone)}
                            </td>
                            <td className="py-2 pr-3 text-xs">
                              {visit.endAt ? (
                                formatTime(new Date(visit.endAt), timezone)
                              ) : (
                                <span className="text-accent">Open</span>
                              )}
                            </td>
                            <td className="py-2 pr-3 text-xs text-muted">
                              {hours === null ? "-" : formatHours(hours)}
                            </td>
                            <td className="py-2 pr-3 text-xs">{visit.source}</td>
                            <td className="py-2 pr-3 font-mono text-xs">{visit.ssid ?? "-"}</td>
                            <td className="py-2 pr-3">
                              <button
                                type="button"
                                onClick={() => startEdit(visit)}
                                className="mr-2 text-xs text-accent hover:underline"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => void handleDelete(visit)}
                                className="text-xs text-red-400 hover:underline disabled:opacity-40"
                              >
                                Delete
                              </button>
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>

      {message && <p className="mt-3 text-sm text-green-400">{message}</p>}
      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
    </section>
  );
}
