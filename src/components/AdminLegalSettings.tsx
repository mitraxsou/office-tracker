"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { PrivacySection, TermsSection } from "@/lib/legal-config";

type AdminLegalSettingsProps = {
  legalVersion: number;
  updatedLabel: string;
  initialTermsSections: TermsSection[];
  initialPrivacySections: PrivacySection[];
  initialChangeSummary: string | null;
};

function emptyTermsSection(): TermsSection {
  return { title: "", body: "" };
}

function emptyPrivacySection(): PrivacySection {
  return { title: "", items: [""] };
}

export function AdminLegalSettings({
  legalVersion,
  updatedLabel,
  initialTermsSections,
  initialPrivacySections,
  initialChangeSummary,
}: AdminLegalSettingsProps) {
  const router = useRouter();
  const [termsSections, setTermsSections] = useState(initialTermsSections);
  const [privacySections, setPrivacySections] = useState(initialPrivacySections);
  const [changeSummary, setChangeSummary] = useState(initialChangeSummary ?? "");
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [published, setPublished] = useState(false);

  function updateTermsSection(index: number, patch: Partial<TermsSection>) {
    setTermsSections((prev) =>
      prev.map((section, i) => (i === index ? { ...section, ...patch } : section)),
    );
  }

  function updatePrivacySection(index: number, patch: Partial<PrivacySection>) {
    setPrivacySections((prev) =>
      prev.map((section, i) => (i === index ? { ...section, ...patch } : section)),
    );
  }

  function updatePrivacyItem(sectionIndex: number, itemIndex: number, value: string) {
    setPrivacySections((prev) =>
      prev.map((section, i) => {
        if (i !== sectionIndex) return section;
        const items = [...section.items];
        items[itemIndex] = value;
        return { ...section, items };
      }),
    );
  }

  async function handleSaveDraft() {
    setSaving(true);
    setError(null);
    setSaved(false);

    const res = await fetch("/api/admin/legal", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        termsSections,
        privacySections,
        changeSummary: changeSummary.trim() || null,
      }),
    });

    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to save draft");
      return;
    }

    setSaved(true);
    router.refresh();
  }

  async function handlePublish() {
    if (
      !confirm(
        `Publish version ${legalVersion + 1}? All users on older versions will be asked to accept again on next visit.`,
      )
    ) {
      return;
    }

    setPublishing(true);
    setError(null);
    setPublished(false);

    const saveRes = await fetch("/api/admin/legal", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        termsSections,
        privacySections,
        changeSummary: changeSummary.trim() || null,
      }),
    });

    if (!saveRes.ok) {
      const data = await saveRes.json().catch(() => ({}));
      setPublishing(false);
      setError(data.error ?? "Failed to save draft before publish");
      return;
    }

    const res = await fetch("/api/admin/legal/publish", { method: "POST" });
    setPublishing(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to publish");
      return;
    }

    setPublished(true);
    router.refresh();
  }

  return (
    <section className="card space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-medium">Terms and Privacy</h2>
          <p className="mt-1 text-sm text-muted">
            Current published version {legalVersion}. Last updated {updatedLabel}.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <Link href="/terms" className="text-accent hover:underline" target="_blank">
            Preview Terms
          </Link>
          <span className="text-muted">·</span>
          <Link href="/privacy" className="text-accent hover:underline" target="_blank">
            Preview Privacy
          </Link>
        </div>
      </div>

      <label className="block text-sm">
        <span className="font-medium">What changed (shown on accept screen)</span>
        <textarea
          value={changeSummary}
          onChange={(event) => setChangeSummary(event.target.value)}
          rows={3}
          className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2"
          placeholder="Optional summary for users re-accepting after publish"
        />
      </label>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-medium">Terms sections</h3>
          <button
            type="button"
            className="text-sm text-accent hover:underline"
            onClick={() => setTermsSections((prev) => [...prev, emptyTermsSection()])}
          >
            Add section
          </button>
        </div>
        {termsSections.map((section, index) => (
          <div key={`terms-${index}`} className="space-y-2 rounded-lg border border-[var(--border)] p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted">Section {index + 1}</span>
              {termsSections.length > 1 && (
                <button
                  type="button"
                  className="text-xs text-red-400 hover:underline"
                  onClick={() =>
                    setTermsSections((prev) => prev.filter((_, i) => i !== index))
                  }
                >
                  Remove
                </button>
              )}
            </div>
            <input
              value={section.title}
              onChange={(event) => updateTermsSection(index, { title: event.target.value })}
              placeholder="Section title"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
            />
            <textarea
              value={section.body}
              onChange={(event) => updateTermsSection(index, { body: event.target.value })}
              rows={3}
              placeholder="Section body"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
            />
          </div>
        ))}
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-medium">Privacy sections</h3>
          <button
            type="button"
            className="text-sm text-accent hover:underline"
            onClick={() => setPrivacySections((prev) => [...prev, emptyPrivacySection()])}
          >
            Add section
          </button>
        </div>
        {privacySections.map((section, sectionIndex) => (
          <div
            key={`privacy-${sectionIndex}`}
            className="space-y-2 rounded-lg border border-[var(--border)] p-4"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted">Section {sectionIndex + 1}</span>
              {privacySections.length > 1 && (
                <button
                  type="button"
                  className="text-xs text-red-400 hover:underline"
                  onClick={() =>
                    setPrivacySections((prev) => prev.filter((_, i) => i !== sectionIndex))
                  }
                >
                  Remove
                </button>
              )}
            </div>
            <input
              value={section.title}
              onChange={(event) =>
                updatePrivacySection(sectionIndex, { title: event.target.value })
              }
              placeholder="Section title"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
            />
            <div className="space-y-2">
              {section.items.map((item, itemIndex) => (
                <div key={`privacy-item-${sectionIndex}-${itemIndex}`} className="flex gap-2">
                  <input
                    value={item}
                    onChange={(event) =>
                      updatePrivacyItem(sectionIndex, itemIndex, event.target.value)
                    }
                    placeholder="Bullet point"
                    className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                  />
                  {section.items.length > 1 && (
                    <button
                      type="button"
                      className="text-xs text-red-400 hover:underline"
                      onClick={() =>
                        setPrivacySections((prev) =>
                          prev.map((s, i) => {
                            if (i !== sectionIndex) return s;
                            return {
                              ...s,
                              items: s.items.filter((_, j) => j !== itemIndex),
                            };
                          }),
                        )
                      }
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                className="text-xs text-accent hover:underline"
                onClick={() =>
                  setPrivacySections((prev) =>
                    prev.map((s, i) =>
                      i === sectionIndex ? { ...s, items: [...s.items, ""] } : s,
                    ),
                  )
                }
              >
                Add bullet
              </button>
            </div>
          </div>
        ))}
      </div>

      {error && (
        <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>
      )}
      {saved && (
        <p className="rounded-lg bg-green-500/10 px-3 py-2 text-sm text-green-400">
          Draft saved.
        </p>
      )}
      {published && (
        <p className="rounded-lg bg-green-500/10 px-3 py-2 text-sm text-green-400">
          Published new version. Users on older versions will be prompted on next visit.
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={handleSaveDraft}
          disabled={saving || publishing}
          className="btn-secondary px-4 py-2"
        >
          {saving ? "Saving..." : "Save draft"}
        </button>
        <button
          type="button"
          onClick={handlePublish}
          disabled={saving || publishing}
          className="btn-primary px-4 py-2"
        >
          {publishing ? "Publishing..." : `Publish version ${legalVersion + 1}`}
        </button>
      </div>
    </section>
  );
}
