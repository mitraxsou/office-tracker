"use client";

import { useEffect, useState } from "react";
import { DateTimeField, dateTimeLocalToIso, toLocalDateTimeInput } from "@/components/DateTimeField";
import { SsidSelect } from "@/components/SsidSelect";
import { formatTime } from "@/lib/visits";
import type { SelectedDayVisit } from "@/lib/admin-user-report-date";

type Props = {
  open: boolean;
  onClose: () => void;
  userId: string;
  dayKey: string;
  timezone: string;
  officeSsids: string[];
  visits: SelectedDayVisit[];
  onChanged: () => void;
};

function defaultCheckInLocal(dayKey: string, todayKey: string): string {
  if (dayKey === todayKey) {
    return toLocalDateTimeInput(new Date());
  }
  return `${dayKey}T09:00`;
}

export function AdminCorrectDayModal({
  open,
  onClose,
  userId,
  dayKey,
  timezone,
  officeSsids,
  visits,
  onChanged,
}: Props) {
  const todayKey = toLocalDateTimeInput(new Date()).slice(0, 10);
  const [addStart, setAddStart] = useState(() => defaultCheckInLocal(dayKey, todayKey));
  const [addEnd, setAddEnd] = useState("");
  const [addCheckout, setAddCheckout] = useState(false);
  const [addSsid, setAddSsid] = useState(officeSsids[0] ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");
  const [editOpenVisit, setEditOpenVisit] = useState(false);
  const [editSsid, setEditSsid] = useState("");

  useEffect(() => {
    if (!open) return;
    setAddStart(defaultCheckInLocal(dayKey, todayKey));
    setAddEnd("");
    setAddCheckout(false);
    setAddSsid(officeSsids[0] ?? "");
    setEditingId(null);
    setError(null);
    setMessage(null);
  }, [open, dayKey, todayKey, officeSsids]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
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
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Failed to add visit");
      return;
    }
    setMessage(addCheckout ? "Visit added." : "Open visit added.");
    setAddCheckout(false);
    setAddEnd("");
    onChanged();
  }

  async function saveEdit(id: string) {
    setBusy(true);
    setError(null);
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
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Failed to update visit");
      return;
    }
    setEditingId(null);
    setMessage("Visit updated.");
    onChanged();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center sm:p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex max-h-[92vh] w-full max-w-lg flex-col rounded-t-2xl border border-[var(--border)] bg-[var(--background-elevated)] shadow-xl sm:max-h-[85vh] sm:rounded-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="correct-day-title"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
          <div>
            <h3 id="correct-day-title" className="text-lg font-medium">
              Correct this day
            </h3>
            <p className="text-sm text-muted">
              Add or edit visits for {dayKey}. Hours follow Visit rows only.
            </p>
          </div>
          <button type="button" onClick={onClose} className="btn-secondary min-h-11 px-3 text-sm">
            Close
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
          {error && <p className="text-sm text-red-400">{error}</p>}
          {message && <p className="text-sm text-green-400">{message}</p>}

          <form onSubmit={handleAdd} className="space-y-3 rounded-lg border border-[var(--border)] p-3">
            <p className="text-sm font-medium">Add visit</p>
            <DateTimeField label="Check-in" value={addStart} onChange={setAddStart} required />
            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                checked={addCheckout}
                onChange={(e) => {
                  setAddCheckout(e.target.checked);
                  if (!e.target.checked) setAddEnd("");
                }}
                className="mt-0.5"
              />
              <span>Add check-out time</span>
            </label>
            {addCheckout && (
              <DateTimeField label="Check-out" value={addEnd} onChange={setAddEnd} />
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
            <button
              type="submit"
              disabled={busy}
              className="btn-primary w-full min-h-11 px-4 py-2 text-sm disabled:opacity-50 sm:w-auto"
            >
              Add visit
            </button>
          </form>

          <div>
            <p className="mb-2 text-sm font-medium">
              Visits on this day ({visits.length})
            </p>
            {visits.length === 0 ? (
              <p className="text-sm text-muted">No visits yet. Add one above.</p>
            ) : (
              <ul className="space-y-3">
                {visits.map((visit) => {
                  const editing = editingId === visit.id;
                  return (
                    <li
                      key={visit.id}
                      className="rounded-lg border border-[var(--border)] p-3 text-sm"
                    >
                      {editing ? (
                        <div className="space-y-2">
                          <DateTimeField
                            label="Start"
                            value={editStart}
                            onChange={setEditStart}
                            required
                          />
                          <label className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={editOpenVisit}
                              onChange={(e) => {
                                setEditOpenVisit(e.target.checked);
                                if (e.target.checked) setEditEnd("");
                              }}
                            />
                            Open visit (no check-out)
                          </label>
                          {!editOpenVisit && (
                            <DateTimeField label="End" value={editEnd} onChange={setEditEnd} />
                          )}
                          <SsidSelect
                            officeSsids={officeSsids}
                            value={editSsid}
                            onChange={setEditSsid}
                            allowEmpty
                          />
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void saveEdit(visit.id)}
                              className="btn-primary min-h-11 px-3 text-sm"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              className="btn-secondary min-h-11 px-3 text-sm"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p>
                              {formatTime(new Date(visit.startAt), timezone)}
                              {" → "}
                              {visit.endAt
                                ? formatTime(new Date(visit.endAt), timezone)
                                : "Open"}
                            </p>
                            <p className="text-xs text-muted">
                              {visit.source}
                              {visit.ssid ? ` · ${visit.ssid}` : ""}
                              {visit.startedPreviousDay ? " · Started previous day" : ""}
                            </p>
                          </div>
                          <button
                            type="button"
                            className="btn-secondary min-h-11 px-3 text-xs"
                            onClick={() => {
                              setEditingId(visit.id);
                              setEditStart(toLocalDateTimeInput(new Date(visit.startAt)));
                              setEditEnd(
                                visit.endAt ? toLocalDateTimeInput(new Date(visit.endAt)) : "",
                              );
                              setEditOpenVisit(visit.endAt === null);
                              setEditSsid(visit.ssid ?? officeSsids[0] ?? "");
                            }}
                          >
                            Edit
                          </button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
