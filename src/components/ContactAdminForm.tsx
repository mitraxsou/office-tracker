"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ADMIN_CONTACT_CATEGORIES,
  ADMIN_CONTACT_CATEGORY_LABELS,
  type AdminContactCategory,
  type AdminContactSummary,
} from "@/lib/admin-contact";

type ContactAdminFormProps = {
  initialSubmissions: AdminContactSummary[];
  initialCategory?: AdminContactCategory;
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

export function ContactAdminForm({
  initialSubmissions,
  initialCategory = "issue",
}: ContactAdminFormProps) {
  const router = useRouter();
  const [submissions, setSubmissions] = useState(initialSubmissions);
  const [category, setCategory] = useState<string>(initialCategory);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSubmitted(false);

    const res = await fetch("/api/settings/admin-contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category, message }),
    });

    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to send message");
      return;
    }

    const data = await res.json();
    setSubmissions((prev) => [data.submission, ...prev]);
    setMessage("");
    setSubmitted(true);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <section className="card p-6">
        <h2 className="text-lg font-medium">Send a message</h2>
        <p className="mt-1 text-sm text-muted">
          Report an issue, raise a concern, or share feedback. Admins will review and respond in the
          app.
        </p>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
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
              Message
            </label>
            <textarea
              id="contact-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Describe your issue, concern, or feedback (at least 10 characters)"
              rows={5}
              required
              minLength={10}
              maxLength={2000}
              className="w-full rounded-lg border px-3 py-2 text-sm"
            />
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}
          {submitted && (
            <p className="text-sm text-green-400">
              Message sent. An admin will review it and you will get an in-app notification when they
              respond.
            </p>
          )}

          <button type="submit" disabled={loading} className="btn-primary px-4 py-2 text-sm">
            {loading ? "Sending..." : "Send to admin"}
          </button>
        </form>
      </section>

      {submissions.length > 0 && (
        <section className="card p-6">
          <h2 className="text-lg font-medium">Your messages</h2>
          <ul className="mt-4 space-y-4">
            {submissions.map((submission) => (
              <li
                key={submission.id}
                className="rounded-lg border border-[var(--border)] p-4 text-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">
                    {ADMIN_CONTACT_CATEGORY_LABELS[submission.category]}
                  </span>
                  <StatusBadge status={submission.status} />
                </div>
                <p className="mt-2 whitespace-pre-wrap">{submission.message}</p>
                <p className="mt-2 text-xs text-muted">
                  Sent {new Date(submission.createdAt).toLocaleString("en-IN")}
                  {submission.reviewedAt && (
                    <> · Resolved {new Date(submission.reviewedAt).toLocaleString("en-IN")}</>
                  )}
                </p>
                {submission.adminResponse && (
                  <div className="mt-3 rounded-lg bg-[var(--border)]/40 p-3">
                    <p className="text-xs font-medium text-muted">Admin response</p>
                    <p className="mt-1 whitespace-pre-wrap">{submission.adminResponse}</p>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
