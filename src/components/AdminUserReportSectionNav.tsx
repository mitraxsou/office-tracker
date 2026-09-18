"use client";

import Link from "next/link";

const SECTIONS = [
  { id: "day-details", label: "Day details" },
  { id: "month-overview", label: "Month overview" },
  { id: "visit-data", label: "Visit data" },
  { id: "agent-activity", label: "Agent activity" },
  { id: "account", label: "Account" },
] as const;

export function AdminUserReportSectionNav({
  onJumpToday,
}: {
  onJumpToday: () => void;
}) {
  return (
    <nav
      className="flex flex-wrap items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--background-elevated)] p-1"
      aria-label="User report sections"
    >
      <button
        type="button"
        onClick={onJumpToday}
        className="rounded-md px-3 py-1.5 text-sm font-medium text-accent hover:bg-[var(--pwc-orange)]/15"
      >
        Today
      </button>
      {SECTIONS.map((section) => (
        <a
          key={section.id}
          href={`#${section.id}`}
          className="rounded-md px-3 py-1.5 text-sm font-medium text-muted hover:bg-[var(--border)]/40 hover:text-accent"
        >
          {section.label}
        </a>
      ))}
      <Link
        href="/admin/visit-reports"
        className="rounded-md px-3 py-1.5 text-sm font-medium text-muted hover:bg-[var(--border)]/40 hover:text-accent"
      >
        Corrections
      </Link>
      <Link
        href="/admin/users"
        className="rounded-md px-3 py-1.5 text-sm font-medium text-muted hover:bg-[var(--border)]/40 hover:text-accent"
      >
        Users & tokens
      </Link>
    </nav>
  );
}
