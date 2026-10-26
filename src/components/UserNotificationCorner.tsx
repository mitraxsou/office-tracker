"use client";

import { useEffect, useState } from "react";
import {
  IN_APP_AUTO_DISMISS_MS,
  inAppNotificationTitle,
  isAutoDismissInAppType,
  type InAppNotificationView,
} from "@/lib/in-app-notification-ui";

async function postDismiss(id: string): Promise<boolean> {
  const response = await fetch(`/api/settings/in-app-notifications/${id}`, {
    method: "POST",
  });
  return response.ok;
}

export function UserNotificationCorner({
  initialItems,
  placement = "header",
}: {
  initialItems: InAppNotificationView[];
  placement?: "header" | "drawer";
}) {
  const [items, setItems] = useState(initialItems);
  const [dismissing, setDismissing] = useState<string | null>(null);
  const [clearingAll, setClearingAll] = useState(false);
  const inDrawer = placement === "drawer";
  const total = items.length;

  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

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
    <details className={inDrawer ? "w-full min-w-0" : "relative"}>
      <summary
        className={`relative cursor-pointer list-none rounded-lg border border-[var(--border)] text-sm hover:bg-[var(--border)] ${
          inDrawer
            ? "flex w-full min-h-11 items-center justify-center gap-2 px-3 py-2"
            : "px-2.5 py-1.5"
        }`}
        aria-label={
          total > 0
            ? `${total} unread notification${total === 1 ? "" : "s"}`
            : "Notifications"
        }
        title="Notifications"
      >
        <span aria-hidden="true">🔔</span>
        {inDrawer && (
          <span className="text-xs">
            Notifications{total > 0 ? ` (${total})` : ""}
          </span>
        )}
        {total > 0 && (
          <span
            className={`absolute min-w-5 rounded-full bg-[var(--pwc-orange)] px-1 text-center text-xs font-semibold text-white ${
              inDrawer ? "right-2 top-1.5" : "-right-2 -top-2"
            }`}
          >
            {total > 99 ? "99+" : total}
          </span>
        )}
      </summary>
      <div
        className={
          inDrawer
            ? "mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] p-3 shadow-lg"
            : "absolute right-0 z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-[var(--border)] bg-[var(--background-elevated)] p-3 shadow-xl"
        }
      >
        <div
          className={`mb-2 gap-2 ${inDrawer ? "flex flex-col" : "flex items-center justify-between"}`}
        >
          <p className="font-medium">Notifications</p>
          {total > 0 && (
            <button
              type="button"
              onClick={() => void clearAll()}
              disabled={busy}
              className={`text-xs font-medium text-[var(--pwc-orange)] hover:text-[var(--pwc-orange-hover)] disabled:opacity-50 ${
                inDrawer ? "self-start" : ""
              }`}
            >
              {clearingAll ? "Clearing..." : "Clear all"}
            </button>
          )}
        </div>
        <p className="mb-2 text-[11px] text-muted">
          Today only. Success alerts clear after a few seconds.
        </p>
        {items.length === 0 ? (
          <p className="py-3 text-sm text-muted">No unread notifications.</p>
        ) : (
          <ul className={`space-y-2 overflow-y-auto ${inDrawer ? "max-h-48" : "max-h-80"}`}>
            {items.map((item) => (
              <li
                key={item.id}
                className="rounded-lg border border-[var(--pwc-orange)]/30 bg-[var(--pwc-orange-muted)]/40 px-3 py-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[var(--pwc-orange)]">
                      {inAppNotificationTitle(item.type)}
                    </p>
                    <p className="mt-0.5 text-xs text-muted">{item.message}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void dismiss(item.id)}
                    disabled={busy}
                    className="shrink-0 text-[11px] text-muted hover:text-[var(--foreground)] disabled:opacity-50"
                  >
                    {dismissing === item.id ? "..." : "Dismiss"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </details>
  );
}
