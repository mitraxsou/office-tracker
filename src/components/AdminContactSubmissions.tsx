"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ADMIN_CONTACT_CATEGORY_LABELS,
  type AdminContactCategory,
  type AdminContactMessageView,
  type AdminContactThreadSummary,
} from "@/lib/admin-contact";

type AdminContactRow = AdminContactThreadSummary & {
  user: { id: string; email: string; name: string | null };
  closedByEmail: string | null;
};

type ThreadDetail = AdminContactRow & {
  messages: AdminContactMessageView[];
};

function StatusBadge({ status }: { status: string }) {
  const styles =
    status === "open"
      ? "bg-amber-500/20 text-amber-300"
      : "bg-green-500/20 text-green-400";
  return (
    <span className={`rounded px-2 py-0.5 text-xs capitalize ${styles}`}>{status}</span>
  );
}

function MessageThread({ messages }: { messages: AdminContactMessageView[] }) {
  if (messages.length === 0) return null;
  return (
    <div className="mt-3 space-y-2 border-t border-[var(--border)] pt-3">
      {messages.map((m) => (
        <div
          key={m.id}
          className={`rounded-lg px-3 py-2 text-sm ${
            m.authorRole === "admin"
              ? "border border-[var(--pwc-orange)]/20 bg-[var(--pwc-orange)]/5"
              : "bg-[var(--background)]"
          }`}
        >
          <p className="text-xs text-muted">
            {m.authorRole === "admin" ? "Admin" : "User"} ·{" "}
            {new Date(m.createdAt).toLocaleString("en-IN")}
          </p>
          <p className="mt-1 whitespace-pre-wrap">{m.body}</p>
        </div>
      ))}
    </div>
  );
}

export function AdminContactSubmissions() {
  const [statusFilter, setStatusFilter] = useState<"open" | "closed" | "all">("open");
  const [threads, setThreads] = useState<AdminContactRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [threadDetail, setThreadDetail] = useState<ThreadDetail | null>(null);
  const [replyText, setReplyText] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/admin/admin-contact?status=${statusFilter}&limit=50`);
    setLoading(false);
    if (!res.ok) {
      setError("Failed to load admin contact conversations");
      return;
    }
    const data = await res.json();
    setThreads(data.threads ?? data.submissions ?? []);
  }, [statusFilter]);

  const loadThread = useCallback(async (threadId: string) => {
    const res = await fetch(`/api/admin/admin-contact/${threadId}`);
    if (!res.ok) {
      setError("Failed to load conversation");
      return;
    }
    const data = await res.json();
    setThreadDetail(data.thread ?? null);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (expandedId) {
      loadThread(expandedId);
    } else {
      setThreadDetail(null);
    }
  }, [expandedId, loadThread]);

  async function sendReply(threadId: string) {
    const body = replyText.trim();
    if (body.length < 2) return;
    setActionLoading(true);
    setError(null);
    const res = await fetch(`/api/admin/admin-contact/${threadId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    });
    setActionLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to send message");
      return;
    }
    setReplyText("");
    await loadThread(threadId);
    await load();
  }

  async function closeThread(threadId: string) {
    setActionLoading(true);
    setError(null);
    const res = await fetch(`/api/admin/admin-contact/${threadId}/close`, {
      method: "POST",
    });
    setActionLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to close conversation");
      return;
    }
    await loadThread(threadId);
    await load();
  }

  async function reopenThread(threadId: string) {
    setActionLoading(true);
    setError(null);
    const res = await fetch(`/api/admin/admin-contact/${threadId}/reopen`, {
      method: "POST",
    });
    setActionLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to reopen conversation");
      return;
    }
    await loadThread(threadId);
    await load();
  }

  return (
    <section className="card p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-medium">Reach out to admin</h2>
          <p className="text-sm text-muted">
            User conversations about issues, concerns, and feedback. Reply in the thread; either
            side can close or reopen.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(["open", "closed", "all"] as const).map((s) => (
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
      {!loading && threads.length === 0 && (
        <p className="text-sm text-muted">No conversations in this filter.</p>
      )}

      <ul className="space-y-4">
        {threads.map((row) => {
          const expanded = expandedId === row.id;
          const detail = expanded && threadDetail?.id === row.id ? threadDetail : null;
          const preview = row.latestMessage?.body ?? row.message;

          return (
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
                  <p className="mt-2 line-clamp-2 whitespace-pre-wrap">{preview}</p>
                  <p className="mt-1 text-xs text-muted">
                    Started {new Date(row.createdAt).toLocaleString("en-IN")}
                    {row.messageCount > 1 && ` · ${row.messageCount} messages`}
                    {row.closedAt && (
                      <>
                        {" "}
                        · Closed {new Date(row.closedAt).toLocaleString("en-IN")}
                        {row.closedByEmail && ` by ${row.closedByEmail}`}
                      </>
                    )}
                  </p>
                </div>
                <StatusBadge status={row.status} />
              </div>

              {expanded && detail && <MessageThread messages={detail.messages} />}

              <div className="mt-3 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setExpandedId(expanded ? null : row.id);
                    setReplyText("");
                    setError(null);
                  }}
                  className="text-xs text-accent hover:underline"
                >
                  {expanded
                    ? "Hide conversation"
                    : row.status === "open"
                      ? "Open chat"
                      : "View history"}
                </button>
              </div>

              {expanded && detail && row.status === "open" && (
                <div className="mt-3 space-y-2 border-t border-[var(--border)] pt-3">
                  <textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Reply to user..."
                    rows={3}
                    className="w-full rounded-lg border px-3 py-2 text-xs"
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={actionLoading || replyText.trim().length < 2}
                      onClick={() => sendReply(row.id)}
                      className="btn-primary px-3 py-1 text-xs"
                    >
                      {actionLoading ? "Sending..." : "Send message"}
                    </button>
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() => closeThread(row.id)}
                      className="text-xs text-muted hover:underline"
                    >
                      Close conversation
                    </button>
                  </div>
                </div>
              )}

              {expanded && detail && row.status === "closed" && (
                <div className="mt-3 border-t border-[var(--border)] pt-3">
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={() => reopenThread(row.id)}
                    className="text-xs text-accent hover:underline"
                  >
                    Reopen conversation
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
