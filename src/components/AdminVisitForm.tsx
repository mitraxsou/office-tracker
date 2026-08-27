"use client";

import { useEffect, useState } from "react";

type UserOption = { id: string; email: string };

export function AdminVisitForm() {
  const [users, setUsers] = useState<UserOption[]>([]);
  const [userId, setUserId] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [ssid, setSsid] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/admin/users")
      .then((r) => r.json())
      .then((data) => {
        const list = (data.users ?? []).map((u: { id: string; email: string }) => ({
          id: u.id,
          email: u.email,
        }));
        setUsers(list);
        if (list.length > 0) setUserId(list[0].id);
      })
      .catch(() => setError("Failed to load users"));
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
        startAt: new Date(startAt).toISOString(),
        endAt: new Date(endAt).toISOString(),
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
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-muted">Add a manual visit for any user to correct missing data.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="text-muted">User</span>
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
        <label className="block text-sm">
          <span className="text-muted">SSID (optional)</span>
          <input
            type="text"
            value={ssid}
            onChange={(e) => setSsid(e.target.value)}
            placeholder="OfficeConnect"
            className="mt-1 w-full rounded-lg border px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          <span className="text-muted">Start</span>
          <input
            type="datetime-local"
            value={startAt}
            onChange={(e) => setStartAt(e.target.value)}
            required
            className="mt-1 w-full rounded-lg border px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          <span className="text-muted">End</span>
          <input
            type="datetime-local"
            value={endAt}
            onChange={(e) => setEndAt(e.target.value)}
            required
            className="mt-1 w-full rounded-lg border px-3 py-2"
          />
        </label>
      </div>
      <button type="submit" disabled={loading} className="btn-primary px-4 py-2 disabled:opacity-50">
        {loading ? "Adding..." : "Add visit"}
      </button>
      {message && <p className="text-sm text-green-400">{message}</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}
    </form>
  );
}
