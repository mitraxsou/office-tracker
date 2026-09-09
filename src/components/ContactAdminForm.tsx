"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ADMIN_CONTACT_CATEGORIES,
  ADMIN_CONTACT_CATEGORY_LABELS,
  type AdminContactCategory,
  type AdminContactMessageView,
  type AdminContactThreadSummary,
} from "@/lib/admin-contact";

type ContactAdminFormProps = {
  initialThreads: AdminContactThreadSummary[];
  initialCategory?: AdminContactCategory;
};

type ThreadDetail = AdminContactThreadSummary & {
  messages: AdminContactMessageView[];
  closedByEmail: string | null;
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
            {m.authorRole === "admin" ? "Admin" : "You"} ·{" "}
            {new Date(m.createdAt).toLocaleString("en-IN")}
          </p>
          <p className="mt-1 whitespace-pre-wrap">{m.body}</p>
        </div>
      ))}
    </div>
  );
}

export function ContactAdminForm({
  initialThreads,
  initialCategory = "issue",
}: ContactAdminFormProps) {
  const router = useRouter();
  const [threads, setThreads] = useState(initialThreads);
  const [category, setCategory] = useState<string>(initialCategory);
  const [newMessage, setNewMessage] = useState("");
  const [createLoading, setCreateLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [threadDetail, setThreadDetail] = useState<ThreadDetail | null>(null);
  const [replyText, setReplyText] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [showNewForm, setShowNewForm] = useState(initialThreads.length === 0);

  const loadThreads = useCallback(async () => {
    const res = await fetch("/api/settings/admin-contact");
    if (!res.ok) return;
    const data = await res.json();
    setThreads(data.threads ?? data.submissions ?? []);
  }, []);

  const loadThread = useCallback(async (threadId: string) => {
    const res = await fetch(`/api/settings/admin-contact/${threadId}`);
    if (!res.ok) {
      setError("Failed to load conversation");
      return;
    }
    const data = await res.json();
    setThreadDetail(data.thread ?? null);
  }, []);

  useEffect(() => {
    if (expandedId) {
      loadThread(expandedId);
    } else {
      setThreadDetail(null);
    }
  }, [expandedId, loadThread]);

  async function handleCreateThread(e: React.FormEvent) {
    e.preventDefault();
    setCreateLoading(true);
    setError(null);

    const res = await fetch("/api/settings/admin-contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category, message: newMessage }),
    });

    setCreateLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to start conversation");
      return;
    }

    const data = await res.json();
    const thread = data.thread ?? data.submission;
    setThreads((prev) => [thread, ...prev]);
    setNewMessage("");
    setShowNewForm(false);
    setExpandedId(thread.id);
    router.refresh();
  }

  async function sendReply(threadId: string) {
    const body = replyText.trim();
    if (body.length < 2) return;
    setActionLoading(true);
    setError(null);
    const res = await fetch(`/api/settings/admin-contact/${threadId}/messages`, {
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
    await loadThreads();
  }

  async function closeThread(threadId: string) {
    setActionLoading(true);
    setError(null);
    const res = await fetch(`/api/settings/admin-contact/${threadId}/close`, {
      method: "POST",
    });
    setActionLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to close conversation");
      return;
    }
    await loadThread(threadId);
    await loadThreads();
  }

  async function reopenThread(threadId: string) {
    setActionLoading(true);
    setError(null);
    const res = await fetch(`/api/settings/admin-contact/${threadId}/reopen`, {
      method: "POST",
    });
    setActionLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to reopen conversation");
      return;
    }
    await loadThread(threadId);
    await loadThreads();
  }

  const openCount = threads.filter((t) => t.status === "open").length;

  return (
    <div className="space-y-6">
      <section className="card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-medium">Conversations</h2>
            <p className="mt-1 text-sm text-muted">
              Chat with admins about issues, concerns, or feedback. Either side can close or reopen
              a conversation at any time.
            </p>
          </div>
          {openCount > 0 && (
            <span className="rounded-full bg-amber-500/20 px-2.5 py-0.5 text-xs font-medium text-amber-300">
              {openCount} open
            </span>
          )}
        </div>

        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

        {!showNewForm && (
          <button
            type="button"
            onClick={() => setShowNewForm(true)}
            className="btn-primary mt-4 px-4 py-2 text-sm"
          >
            Start new conversation
          </button>
        )}

        {showNewForm && (
          <form onSubmit={handleCreateThread} className="mt-4 space-y-4 border-t border-[var(--border)] pt-4">
            <h3 className="text-sm font-medium">New conversation</h3>
            <div>
              <label htmlFor="contact-category" className="mb-1 block text-sm font-medium">
                Category
              </label>
              <select
                id="contact-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm"
              >
                {ADMIN_CONTACT_CATEGORIES.map((value) => (
                  <option key={value} value={value}>
                    {ADMIN_CONTACT_CATEGORY_LABELS[value]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="contact-message" className="mb-1 block text-sm font-medium">
                First message
              </label>
              <textarea
                id="contact-message"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Describe your issue, concern, or feedback (at least 10 characters)"
                rows={5}
                required
                minLength={10}
                maxLength={2000}
                className="w-full rounded-lg border px-3 py-2 text-sm"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <button type="submit" disabled={createLoading} className="btn-primary px-4 py-2 text-sm">
                {createLoading ? "Starting..." : "Start conversation"}
              </button>
              {threads.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setShowNewForm(false);
                    setNewMessage("");
                  }}
                  className="text-sm text-muted hover:underline"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        )}
      </section>

      {threads.length > 0 && (
        <section className="card p-6">
          <h2 className="text-lg font-medium">Your conversations</h2>
          <ul className="mt-4 space-y-4">
            {threads.map((thread) => {
              const expanded = expandedId === thread.id;
              const detail = expanded && threadDetail?.id === thread.id ? threadDetail : null;
              const preview = thread.latestMessage?.body ?? thread.message;

              return (
                <li
                  key={thread.id}
                  className="rounded-lg border border-[var(--border)] p-4 text-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">
                      {ADMIN_CONTACT_CATEGORY_LABELS[thread.category]}
                    </span>
                    <StatusBadge status={thread.status} />
                  </div>
                  <p className="mt-2 line-clamp-2 whitespace-pre-wrap text-muted">{preview}</p>
                  <p className="mt-2 text-xs text-muted">
                    Started {new Date(thread.createdAt).toLocaleString("en-IN")}
                    {thread.messageCount > 1 && ` · ${thread.messageCount} messages`}
                    {thread.closedAt && (
                      <> · Closed {new Date(thread.closedAt).toLocaleString("en-IN")}</>
                    )}
                  </p>

                  {expanded && detail && <MessageThread messages={detail.messages} />}

                  <div className="mt-3 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setExpandedId(expanded ? null : thread.id);
                        setReplyText("");
                        setError(null);
                      }}
                      className="text-xs text-accent hover:underline"
                    >
                      {expanded
                        ? "Hide conversation"
                        : thread.status === "open"
                          ? "Open chat"
                          : "View history"}
                    </button>
                  </div>

                  {expanded && detail && thread.status === "open" && (
                    <div className="mt-3 space-y-2 border-t border-[var(--border)] pt-3">
                      <textarea
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder="Type a message..."
                        rows={3}
                        className="w-full rounded-lg border px-3 py-2 text-sm"
                      />
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={actionLoading || replyText.trim().length < 2}
                          onClick={() => sendReply(thread.id)}
                          className="btn-primary px-3 py-1.5 text-xs"
                        >
                          {actionLoading ? "Sending..." : "Send message"}
                        </button>
                        <button
                          type="button"
                          disabled={actionLoading}
                          onClick={() => closeThread(thread.id)}
                          className="text-xs text-muted hover:underline"
                        >
                          Close conversation
                        </button>
                      </div>
                    </div>
                  )}

                  {expanded && detail && thread.status === "closed" && (
                    <div className="mt-3 border-t border-[var(--border)] pt-3">
                      <button
                        type="button"
                        disabled={actionLoading}
                        onClick={() => reopenThread(thread.id)}
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
      )}
    </div>
  );
}
