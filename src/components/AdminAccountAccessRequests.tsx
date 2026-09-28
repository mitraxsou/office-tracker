"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type AccessRequest = {
  id: string;
  email: string;
  name: string | null;
  message: string | null;
  status: string;
  adminNote: string | null;
  createdUserId: string | null;
  createdAt: string;
};

export function AdminAccountAccessRequests() {
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/account-access-requests?status=open");
      if (!res.ok) {
        setError("Failed to load account requests");
        return;
      }
      const data = (await res.json()) as { requests: AccessRequest[] };
      setRequests(data.requests);
    } catch {
      setError("Failed to load account requests");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function review(id: string, action: "approve" | "reject") {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/account-access-requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, adminNote: notes[id] ?? "" }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? `Failed to ${action}`);
        return;
      }
      await load();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="card p-6">
      <h2 className="text-lg font-medium">Account access requests</h2>
      <p className="mt-1 text-sm text-muted">
        People who asked for an account while OTP self-registration is closed (or preferred admin
        review). Approve creates the user so they can sign in with Teams OTP.
      </p>

      {loading && <p className="mt-4 text-sm text-muted">Loading...</p>}
      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

      {!loading && requests.length === 0 && (
        <p className="mt-4 text-sm text-muted">No open account requests.</p>
      )}

      <ul className="mt-4 space-y-4">
        {requests.map((row) => (
          <li key={row.id} className="rounded-lg border border-[var(--border)] p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-medium">{row.name ?? "No name"}</p>
                <p className="font-mono text-sm text-muted">{row.email}</p>
                <p className="mt-1 text-xs text-muted">
                  Requested {new Date(row.createdAt).toLocaleString("en-IN")}
                </p>
              </div>
              {row.createdUserId && (
                <Link
                  href={`/admin/reports/users/${row.createdUserId}`}
                  className="text-xs text-accent hover:underline"
                >
                  Open user report
                </Link>
              )}
            </div>
            {row.message && (
              <p className="mt-2 whitespace-pre-wrap text-sm text-muted">{row.message}</p>
            )}
            <label className="mt-3 block text-xs text-muted">Admin note (optional)</label>
            <input
              type="text"
              value={notes[row.id] ?? ""}
              onChange={(e) => setNotes((prev) => ({ ...prev, [row.id]: e.target.value }))}
              className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busyId === row.id}
                onClick={() => void review(row.id, "approve")}
                className="btn-primary px-3 py-1.5 text-sm disabled:opacity-50"
              >
                {busyId === row.id ? "Working..." : "Approve & create account"}
              </button>
              <button
                type="button"
                disabled={busyId === row.id}
                onClick={() => void review(row.id, "reject")}
                className="btn-secondary px-3 py-1.5 text-sm disabled:opacity-50"
              >
                Reject
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
