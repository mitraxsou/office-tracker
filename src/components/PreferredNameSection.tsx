"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type PreferredNameSectionProps = {
  preferredName: string | null;
  legalName: string | null;
};

/**
 * Greeting-only display name. Does not change the legal account name or email.
 */
export function PreferredNameSection({
  preferredName: initialPreferredName,
  legalName,
}: PreferredNameSectionProps) {
  const router = useRouter();
  const [value, setValue] = useState(initialPreferredName ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const fallbackHint = legalName?.trim()
    ? `Falls back to "${legalName.trim().split(/\s+/)[0]}" from your account name.`
    : "Falls back to your account name or email local-part.";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSaved(false);

    const res = await fetch("/api/settings/preferred-name", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ preferredName: value }),
    });

    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to save display name");
      return;
    }

    const data = await res.json();
    setValue(data.preferredName ?? "");
    setSaved(true);
    router.refresh();
  }

  return (
    <section className="card p-6">
      <h2 className="mb-2 text-lg font-medium">Greeting display name</h2>
      <p className="mb-3 text-sm text-muted">
        Used only on the dashboard welcome banner. This does not change your legal name or
        email (those still need admin approval below).
      </p>
      <p className="mb-4 text-xs text-muted">{fallbackHint}</p>

      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
        <label className="block min-w-[12rem] flex-1 text-sm">
          <span className="text-muted">Preferred first name</span>
          <input
            type="text"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setSaved(false);
            }}
            maxLength={32}
            placeholder="e.g. Soumitra"
            className="mt-1 block w-full max-w-md rounded-lg border px-3 py-2"
            autoComplete="nickname"
          />
        </label>
        <button
          type="submit"
          disabled={loading}
          className="btn-primary px-4 py-2 disabled:opacity-50"
        >
          {loading ? "Saving..." : "Save display name"}
        </button>
      </form>

      {error && (
        <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>
      )}
      {saved && (
        <p className="mt-3 rounded-lg bg-green-500/10 px-3 py-2 text-sm text-green-400">
          Display name saved. Clear the field and save to use your account name again.
        </p>
      )}
    </section>
  );
}
