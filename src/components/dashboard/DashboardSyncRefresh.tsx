"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useTransition } from "react";

const POLL_MS = 30_000;

type DashboardSyncRefreshProps = {
  initialRevision: string;
};

/**
 * Invisible watcher: when agent sync (or visit) revision advances, re-run the
 * Today RSC via router.refresh(). Polls only while the tab is visible.
 */
export function DashboardSyncRefresh({ initialRevision }: DashboardSyncRefreshProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const lastRevisionRef = useRef(initialRevision);

  useEffect(() => {
    lastRevisionRef.current = initialRevision;
  }, [initialRevision]);

  useEffect(() => {
    let cancelled = false;
    let timer: number | null = null;

    async function poll() {
      if (cancelled) return;
      if (typeof document !== "undefined" && document.visibilityState !== "visible") {
        return;
      }
      try {
        const res = await fetch("/api/today/sync-revision", { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const body = (await res.json()) as { revision?: string };
        const revision = typeof body.revision === "string" ? body.revision : "";
        if (!revision || revision === lastRevisionRef.current) return;
        lastRevisionRef.current = revision;
        startTransition(() => {
          router.refresh();
        });
      } catch {
        // Silent: next poll retries.
      }
    }

    function schedule() {
      if (timer != null) window.clearInterval(timer);
      timer = window.setInterval(() => {
        void poll();
      }, POLL_MS);
    }

    function onVisibility() {
      if (document.visibilityState === "visible") {
        void poll();
        schedule();
      } else if (timer != null) {
        window.clearInterval(timer);
        timer = null;
      }
    }

    void poll();
    if (document.visibilityState === "visible") {
      schedule();
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      if (timer != null) window.clearInterval(timer);
    };
  }, [router, startTransition]);

  return null;
}
