"use client";

import Link from "next/link";

const PRIMARY = [
  { id: "day-details", label: "Day" },
  { id: "month-overview", label: "Month" },
] as const;

const SECONDARY = [
  { id: "diagnostics", label: "Diagnostics" },
  { id: "account", label: "Account" },
] as const;

export function AdminUserReportSectionNav({
  onJumpToday,
  onCorrect,
}: {
  onJumpToday: () => void;
  onCorrect: () => void;
}) {
  return (
    <nav
      className="flex gap-1 overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--background-elevated)] p-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      aria-label="User report sections"
    >
      <button
        type="button"
        onClick={onJumpToday}
        className="shrink-0 rounded-md px-3 py-2 text-sm font-medium text-accent hover:bg-[var(--pwc-orange)]/15"
      >
        Today
      </button>
      {PRIMARY.map((section) => (
        <a
          key={section.id}
          href={`#${section.id}`}
          className="shrink-0 rounded-md px-3 py-2 text-sm font-medium text-muted hover:bg-[var(--border)]/40 hover:text-accent"
        >
          {section.label}
        </a>
      ))}
      <button
        type="button"
        onClick={onCorrect}
        className="shrink-0 rounded-md bg-[var(--pwc-orange)]/15 px-3 py-2 text-sm font-medium text-accent ring-1 ring-[var(--pwc-orange)]/40"
      >
        Correct this day
      </button>
      <Link
        href="/admin/visit-reports"
        className="shrink-0 rounded-md px-3 py-2 text-sm font-medium text-muted hover:bg-[var(--border)]/40 hover:text-accent"
      >
        Corrections
      </Link>
      <Link
        href="/admin/users"
        className="shrink-0 rounded-md px-3 py-2 text-sm font-medium text-muted hover:bg-[var(--border)]/40 hover:text-accent"
      >
        Users
      </Link>
      {SECONDARY.map((section) => (
        <a
          key={section.id}
          href={`#${section.id}`}
          className="shrink-0 rounded-md px-3 py-2 text-sm font-medium text-muted/80 hover:bg-[var(--border)]/40 hover:text-accent"
        >
          {section.label}
        </a>
      ))}
    </nav>
  );
}
