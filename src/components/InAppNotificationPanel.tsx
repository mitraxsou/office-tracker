"use client";

import { useEffect, useState } from "react";
import {
  IN_APP_AUTO_DISMISS_MS,
  isAutoDismissInAppType,
  type InAppNotificationView,
} from "@/lib/in-app-notifications";

const TITLES: Record<string, string> = {
  absent: "No Wi-Fi name",
  stale: "Agent not responding",
  behind: "Behind on office hours",
  hours_started: "Office hours started",
  hours_met: "Daily hours target met",
  monthly_snapshot: "Monthly office snapshot",
  ooo_cleared: "Out of office cleared",
  custom: "Message from admin",
};

async function postDismiss(id: string): Promise<boolean> {
  const response = await fetch(`/api/settings/in-app-notifications/${id}`, {
    method: "POST",
  });
  return response.ok;
}

export function InAppNotificationPanel({
  initialItems,
}: {
  initialItems: InAppNotificationView[];
}) {
  const [items, setItems] = useState(initialItems);
  const [dismissing, setDismissing] = useState<string | null>(null);
  const [clearingAll, setClearingAll] = useState(false);

  useEffect(() => {
    const successIds = initialItems
      .filter((item) => isAutoDismissInAppType(item.type))
      .map((item) => item.id);
    if (successIds.length === 0) return;

    const timers = successIds.map((id) =>
      window.setTimeout(() => {
        void (async () => {
          const ok = await postDismiss(id);
          if (!ok) return;
          setItems((current) => current.filter((item) => item.id !== id));
        })();
      }, IN_APP_AUTO_DISMISS_MS),
    );

    return () => {
      for (const timer of timers) window.clearTimeout(timer);
    };
  }, [initialItems]);

  if (items.length === 0) return null;

  async function dismiss(id: string) {
    setDismissing(id);
    const ok = await postDismiss(id);
    setDismissing(null);
    if (!ok) return;
    setItems((current) => current.filter((item) => item.id !== id));
  }

  async function clearAll() {
    setClearingAll(true);
    const response = await fetch("/api/settings/in-app-notifications", {
      method: "POST",
    });
    setClearingAll(false);
    if (!response.ok) return;
    setItems([]);
  }

  const busy = clearingAll || dismissing !== null;

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted">
          Success alerts clear after a few seconds. Reminders stay until you dismiss them.
        </p>
        <button
          type="button"
          onClick={() => void clearAll()}
          disabled={busy}
          className="shrink-0 text-xs font-medium text-[var(--pwc-orange)] hover:text-[var(--pwc-orange-hover)] disabled:opacity-50"
        >
          {clearingAll ? "Clearing..." : "Clear all"}
        </button>
      </div>
      {items.map((item) => (
        <div
          key={item.id}
          className="rounded-lg border border-[var(--pwc-orange)]/40 bg-[var(--pwc-orange-muted)] px-4 py-3"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-medium text-[var(--pwc-orange)]">
                {TITLES[item.type] ?? "My Office Pulse"}
              </p>
              <p className="mt-1 text-sm text-muted">{item.message}</p>
            </div>
            <button
              type="button"
              onClick={() => void dismiss(item.id)}
              disabled={busy}
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
