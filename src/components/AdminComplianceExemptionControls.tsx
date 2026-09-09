"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AdminComplianceExemptionControls({
  complianceExemptionRequiresApproval,
}: {
  complianceExemptionRequiresApproval: boolean;
}) {
  const router = useRouter();
  const [requiresApproval, setRequiresApproval] = useState(complianceExemptionRequiresApproval);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleToggle() {
    const next = !requiresApproval;
    setLoading(true);
    setError(null);
    setSaved(false);

    const res = await fetch("/api/admin/config", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ complianceExemptionRequiresApproval: next }),
    });

    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to update setting");
      return;
    }

    setRequiresApproval(next);
    setSaved(true);
    router.refresh();
  }

  return (
    <section className="card p-6">
      <h2 className="mb-1 text-lg font-medium">HR exemption workflow</h2>
      <p className="mb-4 text-sm text-muted">
        Control whether users must wait for admin to log HR exemptions, or exemptions apply
        immediately when notified.
      </p>

      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-medium">HR exemptions require admin to log</p>
          <p className="mt-1 text-sm text-muted">
            When off, month and day notifications are auto-logged for the user without admin review.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={requiresApproval}
          disabled={loading}
          onClick={handleToggle}
          className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
            requiresApproval ? "bg-[var(--pwc-orange)]" : "bg-[var(--border)]"
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white transition-transform ${
              requiresApproval ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
      </div>

      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      {saved && <p className="mt-3 text-sm text-green-400">Exemption setting saved.</p>}
    </section>
  );
}
