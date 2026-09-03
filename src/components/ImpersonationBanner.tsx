"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ImpersonationBanner({
  email,
  name,
}: {
  email: string;
  name: string | null;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const displayName = name?.trim() || email;

  async function endImpersonation() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/impersonate/end", { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(body.error ?? "Failed to exit view-as mode");
        setLoading(false);
        return;
      }
      router.push(body.redirectTo ?? "/admin");
      router.refresh();
    } catch {
      alert("Failed to exit view-as mode");
      setLoading(false);
    }
  }

  return (
    <div className="banner-viewas px-4 py-2 text-sm">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2">
        <p>
          Viewing as <strong className="font-semibold">{displayName}</strong> ({email}). User
          actions apply to this account.
        </p>
        <button
          type="button"
          onClick={() => void endImpersonation()}
          disabled={loading}
          className="btn-secondary px-3 py-1 text-xs"
        >
          {loading ? "Exiting..." : "Exit view-as"}
        </button>
      </div>
    </div>
  );
}
