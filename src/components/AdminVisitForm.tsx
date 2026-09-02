"use client";

import { useEffect, useId, useState } from "react";
import { DateTimeField, dateTimeLocalToIso } from "@/components/DateTimeField";
import { SsidManualInput } from "@/components/SsidManualInput";

type UserOption = { id: string; email: string };

export function AdminVisitForm() {
  const ssidInputId = useId();
  const [users, setUsers] = useState<UserOption[]>([]);
  const [officeSsids, setOfficeSsids] = useState<string[]>([]);
  const [userId, setUserId] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [ssid, setSsid] = useState("");
  const [includeCheckout, setIncludeCheckout] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    Promise.all([fetch("/api/admin/users"), fetch("/api/admin/config")])
      .then(async ([usersRes, configRes]) => {
        const usersData = await usersRes.json();
        const configData = await configRes.json();
        const list = (usersData.users ?? []).map((u: { id: string; email: string }) => ({
          id: u.id,
          email: u.email,
        }));
        const ssids: string[] = configData.config?.officeSsids ?? [];
        setUsers(list);
        setOfficeSsids(ssids);
        if (list.length > 0) setUserId(list[0].id);
      })
      .catch(() => setError("Failed to load form data"));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    setError(null);

    const res = await fetch("/api/admin/visits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        startAt: dateTimeLocalToIso(startAt),
        endAt: includeCheckout && endAt ? dateTimeLocalToIso(endAt) : null,
        ssid: ssid.trim() || null,
      }),
    });

    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to add visit");
      return;
    }

    setMessage("Visit added.");
    setStartAt("");
    setEndAt("");
    setSsid("");
    setIncludeCheckout(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-muted">Add a manual visit for any user to correct missing data.</p>

      <div className="rounded-lg border border-[var(--border)] p-4">
        <label className="block text-sm">
          <span className="font-medium">User</span>
          <select
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            className="mt-1 w-full rounded-lg border px-3 py-2"
          >
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.email}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-[var(--border)] p-4">
          <p className="mb-3 text-sm font-medium">Check-in</p>
          <DateTimeField label="Start" value={startAt} onChange={setStartAt} required />
        </div>

        <div className="rounded-lg border border-[var(--border)] p-4">
          <p className="mb-3 text-sm font-medium">Check-out</p>
          <label className="mb-3 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={includeCheckout}
              onChange={(e) => {
                setIncludeCheckout(e.target.checked);
                if (!e.target.checked) setEndAt("");
              }}
            />
            <span className="text-muted">Include end time</span>
          </label>
          {includeCheckout && (
            <DateTimeField label="End" value={endAt} onChange={setEndAt} />
          )}
        </div>
      </div>

      <div className="rounded-lg border border-[var(--border)] p-4">
        <SsidManualInput
          id={ssidInputId}
          value={ssid}
          onChange={setSsid}
          officeSsids={officeSsids}
        />
      </div>

      <button type="submit" disabled={loading} className="btn-primary px-4 py-2 disabled:opacity-50">
        {loading ? "Adding..." : "Add visit"}
      </button>
      {message && <p className="text-sm text-green-400">{message}</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}
    </form>
  );
}
