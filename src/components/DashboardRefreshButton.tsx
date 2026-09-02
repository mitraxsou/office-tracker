"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

export function DashboardRefreshButton() {
  const router = useRouter();
  const [refreshing, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={refreshing}
      onClick={() => startTransition(() => router.refresh())}
      className="btn-secondary px-3 py-1.5 text-sm disabled:opacity-50"
    >
      {refreshing ? "Refreshing..." : "Refresh"}
    </button>
  );
}
