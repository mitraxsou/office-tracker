"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ManualVisitForm({ timezone }: { timezone: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const form = e.currentTarget;
    const formData = new FormData(form);

    const res = await fetch("/api/visits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        startAt: formData.get("startAt"),
        endAt: formData.get("endAt"),
        ssid: formData.get("ssid") || null,
      }),
    });

    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to save visit");
      return;
    }
    form.reset();
    router.refresh();
  }

  return (
    <section className="card p-6">
      <h2 className="mb-2 text-lg font-medium">Manual visit</h2>
      <p className="mb-4 text-sm text-muted">
        Use for guest Wi-Fi, Ethernet, or when the agent missed a session.
      </p>
      {error && (
        <p className="mb-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>
      )}
      <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm text-muted">Check-in</label>
          <input name="startAt" type="datetime-local" required className="w-full rounded-lg border px-3 py-2" />
        </div>
        <div>
          <label className="mb-1 block text-sm text-muted">Check-out</label>
          <input name="endAt" type="datetime-local" required className="w-full rounded-lg border px-3 py-2" />
        </div>
        <div className="md:col-span-2">
          <label className="mb-1 block text-sm text-muted">SSID (optional)</label>
          <input name="ssid" type="text" placeholder="OfficeConnect" className="w-full rounded-lg border px-3 py-2" />
        </div>
        <div className="md:col-span-2">
          <button type="submit" disabled={loading} className="btn-primary px-4 py-2 disabled:opacity-50">
            {loading ? "Saving..." : "Add manual visit"}
          </button>
        </div>
      </form>
      <p className="mt-2 text-xs text-muted">Timezone: {timezone}</p>
    </section>
  );
}
