"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type ProfileChangeRequest = {
  id: string;
  status: string;
  currentName: string | null;
  currentEmail: string;
  requestedName: string | null;
  requestedEmail: string | null;
  message: string | null;
  adminNote: string | null;
  createdAt: string;
  reviewedAt: string | null;
  user: { id: string; email: string; name: string | null };
  reviewedByEmail: string | null;
};

function formatDelta(r: ProfileChangeRequest) {
  const parts: string[] = [];
  if (r.requestedName !== null && r.requestedName !== r.currentName) {
    parts.push(`Name: ${r.currentName ?? "(none)"} → ${r.requestedName}`);
  }
  if (r.requestedEmail && r.requestedEmail !== r.currentEmail) {
    parts.push(`Email: ${r.currentEmail} → ${r.requestedEmail}`);
  }
  return parts.join(" · ") || "No changes";
}

export function AdminProfileChangeRequests() {
  const [statusFilter, setStatusFilter] = useState<"open" | "approved" | "rejected" | "all">("open");
  const [requests, setRequests] = useState<ProfileChangeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [adminNote, setAdminNote] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/admin/profile-change-requests?status=${statusFilter}&limit=50`);
    setLoading(false);
    if (!res.ok) {
      setError("Failed to load profile change requests");
      return;
    }
    const data = await res.json();
    setRequests(data.requests ?? []);
  }, [statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  async function resolveRequest(id: string, status: "approved" | "rejected") {
    setError(null);
    const res = await fetch(`/api/admin/profile-change-requests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status,
        adminNote: adminNote.trim() || undefined,
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to update request");
      return;
    }
    setResolvingId(null);
    setAdminNote("");
    load();
  }

  return (
    <section className="card p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-medium">Profile change requests</h2>
          <p className="text-sm text-muted">
            Users and admins can request display name or PwC email updates. Any admin can approve
            to update the account.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(["open", "approved", "rejected", "all"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={`rounded-lg px-3 py-1.5 text-xs capitalize ${
                statusFilter === s
                  ? "bg-[var(--pwc-orange)]/20 font-medium text-accent"
                  : "text-muted hover:bg-[var(--border)]"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {loading && <p className="text-sm text-muted">Loading...</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}
      {!loading && requests.length === 0 && (
        <p className="text-sm text-muted">No requests in this filter.</p>
      )}

      <ul className="space-y-4">
        {requests.map((r) => (
          <li key={r.id} className="rounded-lg border border-[var(--border)] p-4 text-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <Link
                  href={`/admin/reports/users/${r.user.id}`}
                  className="font-medium text-accent hover:underline"
                >
                  {r.user.email}
                </Link>
                {r.user.name && <p className="text-xs text-muted">{r.user.name}</p>}
                <p className="mt-1 text-muted">{formatDelta(r)}</p>
                {r.message && <p className="mt-2">{r.message}</p>}
                <p className="mt-1 text-xs text-muted">
                  Requested {new Date(r.createdAt).toLocaleString("en-IN")}
                  {r.reviewedAt && (
                    <>
                      {" "}
                      · {r.status} {new Date(r.reviewedAt).toLocaleString("en-IN")}
                      {r.reviewedByEmail && ` by ${r.reviewedByEmail}`}
                    </>
                  )}
                </p>
                {r.adminNote && (
                  <p className="mt-1 text-xs text-muted">Admin note: {r.adminNote}</p>
                )}
              </div>
              <span
                className={`rounded px-2 py-0.5 text-xs capitalize ${
                  r.status === "open"
                    ? "bg-amber-500/20 text-amber-300"
                    : r.status === "approved"
                      ? "bg-green-500/20 text-green-400"
                      : "bg-[var(--border)] text-muted"
                }`}
              >
                {r.status}
              </span>
            </div>

            {r.status === "open" && (
              <div className="mt-3 border-t border-[var(--border)] pt-3">
                {resolvingId === r.id ? (
                  <div className="space-y-2">
                    <textarea
                      value={adminNote}
                      onChange={(e) => setAdminNote(e.target.value)}
                      placeholder="Optional note to user"
                      rows={2}
                      className="w-full rounded-lg border px-3 py-2 text-xs"
                    />
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => resolveRequest(r.id, "approved")}
                        className="btn-primary px-3 py-1 text-xs"
                      >
                        Approve profile change
                      </button>
                      <button
                        type="button"
                        onClick={() => resolveRequest(r.id, "rejected")}
                        className="btn-secondary px-3 py-1 text-xs"
                      >
                        Reject
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setResolvingId(null);
                          setAdminNote("");
                        }}
                        className="text-xs text-muted hover:underline"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setResolvingId(r.id)}
                    className="text-xs text-accent hover:underline"
                  >
                    Review request
                  </button>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
