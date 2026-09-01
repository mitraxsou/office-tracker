"use client";

import { useCallback, useEffect, useState } from "react";
import { DateTimeField, dateTimeLocalToIso, toLocalDateTimeInput } from "@/components/DateTimeField";
import { SsidSelect } from "@/components/SsidSelect";

type Visit = {
  id: string;
  startAt: string;
  endAt: string | null;
  source: string;
  ssid: string | null;
};

type Props = {
  userId: string;
  officeSsids: string[];
  onChanged?: () => void;
};

export function AdminVisitManager({ userId, officeSsids, onChanged }: Props) {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");
  const [editSsid, setEditSsid] = useState("");
  const [addStart, setAddStart] = useState("");
  const [addEnd, setAddEnd] = useState("");
  const [addSsid, setAddSsid] = useState(officeSsids[0] ?? "");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/visits?userId=${userId}&limit=50`);
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

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    const res = await fetch("/api/admin/visits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        startAt: dateTimeLocalToIso(addStart),
        endAt: dateTimeLocalToIso(addEnd),
        ssid: addSsid || null,
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to add visit");
      return;
    }
    setMessage("Visit added.");
    setAddStart("");
    setAddEnd("");
    setAddSsid(officeSsids[0] ?? "");
    load();
    onChanged?.();
  }

  async function saveEdit(id: string) {
    setError(null);
    const res = await fetch("/api/admin/visits", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id,
        startAt: dateTimeLocalToIso(editStart),
        endAt: editEnd ? dateTimeLocalToIso(editEnd) : null,
        ssid: editSsid || null,
      }),
    });
    if (!res.ok) {
      setError("Failed to update visit");
      return;
    }
    setEditingId(null);
    load();
    onChanged?.();
  }

  async function deleteVisit(id: string) {
    if (!confirm("Delete this visit?")) return;
    const res = await fetch(`/api/admin/visits?id=${id}`, { method: "DELETE" });
    if (!res.ok) {
      setError("Failed to delete visit");
      return;
    }
    load();
    onChanged?.();
  }

  function startEdit(v: Visit) {
    setEditingId(v.id);
    setEditStart(toLocalDateTimeInput(new Date(v.startAt)));
    setEditEnd(v.endAt ? toLocalDateTimeInput(new Date(v.endAt)) : "");
    setEditSsid(v.ssid ?? officeSsids[0] ?? "");
  }

  return (
    <section className="card p-6">
      <h2 className="mb-4 text-lg font-medium">Visit data</h2>

      <form onSubmit={handleAdd} className="mb-6 grid gap-3 sm:grid-cols-2">
        <p className="text-sm text-muted sm:col-span-2">
          Add a manual visit to correct missing data. Use the date and time pickers.
        </p>
        <DateTimeField label="Start" value={addStart} onChange={setAddStart} required />
        <DateTimeField label="End" value={addEnd} onChange={setAddEnd} required />
        <div className="sm:col-span-2">
          <label className="mb-1 block text-sm text-muted">Office Wi-Fi (SSID)</label>
          <SsidSelect
            officeSsids={officeSsids}
            value={addSsid}
            onChange={setAddSsid}
            allowEmpty={false}
          />
        </div>
        <div className="sm:col-span-2">
          <button type="submit" className="btn-primary px-4 py-2 text-sm">
            Add visit
          </button>
        </div>
      </form>

      {loading && <p className="text-sm text-muted">Loading visits...</p>}
      {!loading && visits.length === 0 && (
        <p className="text-sm text-muted">No visits in range.</p>
      )}

      {visits.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-left text-xs text-muted">
                <th className="py-2 pr-3">Start</th>
                <th className="py-2 pr-3">End</th>
                <th className="py-2 pr-3">Source</th>
                <th className="py-2 pr-3">SSID</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visits.map((v) => (
                <tr key={v.id} className="border-b border-[var(--border)]">
                  {editingId === v.id ? (
                    <>
                      <td className="py-2 pr-3 align-top">
                        <DateTimeField label="" value={editStart} onChange={setEditStart} required />
                      </td>
                      <td className="py-2 pr-3 align-top">
                        <DateTimeField label="" value={editEnd} onChange={setEditEnd} />
                      </td>
                      <td className="py-2 pr-3 text-muted">{v.source}</td>
                      <td className="py-2 pr-3">
                        <SsidSelect
                          officeSsids={officeSsids}
                          value={editSsid}
                          onChange={setEditSsid}
                          allowEmpty={false}
                          className="w-full rounded border px-2 py-1 text-xs"
                        />
                      </td>
                      <td className="py-2">
                        <button
                          type="button"
                          onClick={() => saveEdit(v.id)}
                          className="mr-2 text-xs text-accent hover:underline"
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
                      <td className="py-2 pr-3 text-xs">
                        {new Date(v.startAt).toLocaleString("en-IN")}
                      </td>
                      <td className="py-2 pr-3 text-xs">
                        {v.endAt ? new Date(v.endAt).toLocaleString("en-IN") : "Open"}
                      </td>
                      <td className="py-2 pr-3">{v.source}</td>
                      <td className="py-2 pr-3 font-mono text-xs">{v.ssid ?? "—"}</td>
                      <td className="py-2">
                        <button
                          type="button"
                          onClick={() => startEdit(v)}
                          className="mr-2 text-xs text-accent hover:underline"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteVisit(v.id)}
                          className="text-xs text-red-400 hover:underline"
                        >
                          Delete
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {message && <p className="mt-3 text-sm text-green-400">{message}</p>}
      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
    </section>
  );
}
