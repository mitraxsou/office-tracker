"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ADMIN_CONTACT_CATEGORY_LABELS, type AdminContactCategory } from "@/lib/admin-contact";

type AdminContactRow = {
  id: string;
  category: AdminContactCategory;
  message: string;
  status: string;
  adminResponse: string | null;
  createdAt: string;
  reviewedAt: string | null;
  user: { id: string; email: string; name: string | null };
  reviewedByEmail: string | null;
};

export function AdminContactSubmissions() {
  const [statusFilter, setStatusFilter] = useState<"open" | "resolved" | "all">("open");
  const [submissions, setSubmissions] = useState<AdminContactRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [adminResponse, setAdminResponse] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/admin/admin-contact?status=${statusFilter}&limit=50`);
    setLoading(false);
    if (!res.ok) {
      setError("Failed to load admin contact messages");
      return;
    }
    const data = await res.json();
    setSubmissions(data.submissions ?? []);
  }, [statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  async function resolveSubmission(id: string) {
    setError(null);
    const res = await fetch(`/api/admin/admin-contact/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "resolved",
        adminResponse: adminResponse.trim(),
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to resolve submission");
      return;
    }
    setResolvingId(null);
    setAdminResponse("");
    load();
  }

  return (
    <section className="card p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-medium">Reach out to admin</h2>
          <p className="text-sm text-muted">
            User issues, concerns, and feedback. Respond and mark resolved; the user gets an in-app
            notification.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(["open", "resolved", "all"] as const).map((s) => (
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
      {!loading && submissions.length === 0 && (
        <p className="text-sm text-muted">No messages in this filter.</p>
      )}

      <ul className="space-y-4">
        {submissions.map((row) => (
          <li key={row.id} className="rounded-lg border border-[var(--border)] p-4 text-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <Link
                  href={`/admin/reports/users/${row.user.id}`}
                  className="font-medium text-accent hover:underline"
                >
                  {row.user.email}
                </Link>
                <p className="mt-1 font-medium">{ADMIN_CONTACT_CATEGORY_LABELS[row.category]}</p>
                <p className="mt-2 whitespace-pre-wrap">{row.message}</p>
                <p className="mt-1 text-xs text-muted">
                  Submitted {new Date(row.createdAt).toLocaleString("en-IN")}
                  {row.reviewedAt && (
                    <>
                      {" "}
                      · Resolved {new Date(row.reviewedAt).toLocaleString("en-IN")}
                      {row.reviewedByEmail && ` by ${row.reviewedByEmail}`}
                    </>
                  )}
                </p>
                {row.adminResponse && (
                  <p className="mt-2 text-xs text-muted">
                    Your response: {row.adminResponse}
                  </p>
                )}
              </div>
              <span
                className={`rounded px-2 py-0.5 text-xs capitalize ${
                  row.status === "open"
                    ? "bg-amber-500/20 text-amber-300"
                    : "bg-green-500/20 text-green-400"
                }`}
              >
                {row.status}
              </span>
            </div>

            {row.status === "open" && (
              <div className="mt-3 border-t border-[var(--border)] pt-3">
                {resolvingId === row.id ? (
                  <div className="space-y-2">
                    <textarea
                      value={adminResponse}
                      onChange={(e) => setAdminResponse(e.target.value)}
                      placeholder="Response to user (required)"
                      rows={3}
                      className="w-full rounded-lg border px-3 py-2 text-xs"
                    />
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => resolveSubmission(row.id)}
                        className="btn-primary px-3 py-1 text-xs"
                      >
                        Send response and resolve
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setResolvingId(null);
                          setAdminResponse("");
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
                    onClick={() => setResolvingId(row.id)}
                    className="text-xs text-accent hover:underline"
                  >
                    Respond
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
