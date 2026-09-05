"use client";

import { useState } from "react";
import type { InAppNotificationView } from "@/lib/in-app-notifications";

const TITLES: Record<string, string> = {
  absent: "No Wi-Fi name",
  stale: "Agent not responding",
  behind: "Behind on office hours",
  hours_started: "Office hours started",
  hours_met: "Daily hours target met",
  custom: "Message from admin",
};

export function InAppNotificationPanel({
  initialItems,
}: {
  initialItems: InAppNotificationView[];
}) {
  const [items, setItems] = useState(initialItems);
  const [dismissing, setDismissing] = useState<string | null>(null);

  if (items.length === 0) return null;

  async function dismiss(id: string) {
    setDismissing(id);
    const response = await fetch(`/api/settings/in-app-notifications/${id}`, {
      method: "POST",
    });
    setDismissing(null);
    if (!response.ok) return;
    setItems((current) => current.filter((item) => item.id !== id));
  }

  return (
    <section className="space-y-3">
      {items.map((item) => (
        <div
          key={item.id}
          className="rounded-lg border border-[var(--pwc-orange)]/40 bg-[var(--pwc-orange-muted)] px-4 py-3"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-medium text-[var(--pwc-orange)]">
                {TITLES[item.type] ?? "Office Pulse"}
              </p>
              <p className="mt-1 text-sm text-muted">{item.message}</p>
            </div>
            <button
              type="button"
              onClick={() => dismiss(item.id)}
              disabled={dismissing === item.id}
              className="shrink-0 text-xs text-muted hover:text-[var(--foreground)] disabled:opacity-50"
            >
              {dismissing === item.id ? "Dismissing..." : "Dismiss"}
            </button>
          </div>
        </div>
      ))}
    </section>
  );
}
