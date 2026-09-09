"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AdminGrantComplianceExemption({ userId }: { userId: string }) {
  const router = useRouter();
  const [type, setType] = useState<"month" | "day">("month");
  const [monthKey, setMonthKey] = useState("");
  const [dayKey, setDayKey] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleGrant(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    const res = await fetch(`/api/admin/users/${userId}/compliance-exemption`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type,
        monthKey: type === "month" ? monthKey : undefined,
        dayKey: type === "day" ? dayKey : undefined,
        message: message.trim() || undefined,
      }),
    });

    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to log exemption");
      return;
    }

    setSuccess(true);
    setMonthKey("");
    setDayKey("");
    setMessage("");
    router.refresh();
  }

  return (
    <section className="card p-6">
      <h2 className="mb-1 text-lg font-medium">Log HR exemption</h2>
      <p className="mb-4 text-sm text-muted">
        Record an HR exemption for this user (whole month or single day). Use when the user has HR
        approval.
      </p>
      <form onSubmit={handleGrant} className="space-y-3">
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="grant-type"
              checked={type === "month"}
              onChange={() => setType("month")}
            />
            Whole month
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="grant-type"
              checked={type === "day"}
              onChange={() => setType("day")}
            />
            Single day
          </label>
        </div>
        {type === "month" ? (
          <label className="block text-sm">
            <span className="text-muted">Month (YYYY-MM)</span>
            <input
              type="month"
              value={monthKey}
              onChange={(e) => setMonthKey(e.target.value)}
              required
              className="mt-1 w-full max-w-xs rounded-lg border px-3 py-2 text-sm"
            />
          </label>
        ) : (
          <label className="block text-sm">
            <span className="text-muted">Day</span>
            <input
              type="date"
              value={dayKey}
              onChange={(e) => setDayKey(e.target.value)}
              required
              className="mt-1 w-full max-w-xs rounded-lg border px-3 py-2 text-sm"
            />
          </label>
        )}
        <label className="block text-sm">
          <span className="text-muted">Note (optional)</span>
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
            placeholder="e.g. approved leave"
          />
        </label>
        {error && <p className="text-sm text-red-400">{error}</p>}
        {success && <p className="text-sm text-green-400">HR exemption logged.</p>}
        <button type="submit" disabled={loading} className="btn-primary px-4 py-2 text-sm disabled:opacity-50">
          {loading ? "Logging..." : "Log exemption"}
        </button>
      </form>
    </section>
  );
}
