"use client";

import { useState } from "react";
import type { CustomNotifyChannel } from "@/lib/custom-notification";

export function AdminCustomNotificationForm({
  userId,
  userEmail,
}: {
  userId: string;
  userEmail: string;
}) {
  const [message, setMessage] = useState("");
  const [channel, setChannel] = useState<CustomNotifyChannel>("app");
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSend() {
    setSending(true);
    setStatus(null);
    setError(null);
    const response = await fetch(`/api/admin/users/${userId}/custom-notification`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, channel }),
    });
    const data = await response.json().catch(() => ({}));
    setSending(false);
    if (!response.ok) {
      setError(typeof data.error === "string" ? data.error : "Send failed");
      return;
    }
    setMessage("");
    setStatus(
      typeof data.warning === "string" ? data.warning : `Notification sent to ${userEmail}.`,
    );
  }

  return (
    <section className="rounded-lg border border-[var(--border)] p-4">
      <h3 className="text-sm font-medium">Send a custom notification</h3>
      <p className="mt-1 text-xs text-muted">
        One-off message for this user. You choose the channel. This does not follow the user&apos;s
        saved alert defaults.
      </p>
      <label className="mt-3 block text-sm">
        <span className="text-muted">Message</span>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={1000}
          rows={3}
          className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
          placeholder="Example: Please update the My Office Pulse agent today."
        />
      </label>
      <label className="mt-3 block text-sm">
        <span className="text-muted">Delivery channel</span>
        <select
          value={channel}
          onChange={(e) => setChannel(e.target.value as CustomNotifyChannel)}
          className="mt-1 block w-full max-w-xs rounded-lg border px-3 py-2 text-sm"
        >
          <option value="app">In the app</option>
          <option value="teams">Microsoft Teams</option>
          <option value="both">In the app and Microsoft Teams</option>
        </select>
      </label>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleSend}
          disabled={sending || message.trim().length === 0}
          className="btn-primary px-3 py-2 text-sm disabled:opacity-50"
        >
          {sending ? "Sending..." : "Send notification"}
        </button>
        {status && <span className="text-sm text-green-400">{status}</span>}
        {error && <span className="text-sm text-red-400">{error}</span>}
      </div>
    </section>
  );
}
