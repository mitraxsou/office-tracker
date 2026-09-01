"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DateTimeField, dateTimeLocalToIso } from "@/components/DateTimeField";
import { SsidSelect } from "@/components/SsidSelect";

export function ManualVisitForm({
  timezone,
  officeSsids,
}: {
  timezone: string;
  officeSsids: string[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [ssid, setSsid] = useState(officeSsids[0] ?? "");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch("/api/visits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        startAt: dateTimeLocalToIso(startAt),
        endAt: dateTimeLocalToIso(endAt),
        ssid: ssid || null,
      }),
    });

    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to save visit");
      return;
    }
    setStartAt("");
    setEndAt("");
    setSsid(officeSsids[0] ?? "");
    router.refresh();
  }

  return (
    <section className="card p-6">
      <h2 className="mb-2 text-lg font-medium">Manual visit</h2>
      <p className="mb-4 text-sm text-muted">
        Use for guest Wi-Fi, Ethernet, or when the agent missed a session. Pick date and time from
        the calendar and clock controls.
      </p>
      {error && (
        <p className="mb-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>
      )}
      <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
        <DateTimeField label="Check-in" value={startAt} onChange={setStartAt} required />
        <DateTimeField label="Check-out" value={endAt} onChange={setEndAt} required />
        <div className="md:col-span-2">
          <label className="mb-1 block text-sm text-muted">Office Wi-Fi (SSID)</label>
          <SsidSelect
            officeSsids={officeSsids}
            value={ssid}
            onChange={setSsid}
            allowEmpty={false}
          />
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
