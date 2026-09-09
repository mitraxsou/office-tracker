"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";

function getInitials(name: string, email: string): string {
  const trimmed = name.trim();
  if (trimmed && trimmed !== email) {
    const parts = trimmed.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return trimmed.slice(0, 2).toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
      aria-hidden="true"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export function AppNavUserMenu({
  displayName,
  userEmail,
  showAdminLink,
  version,
  logoutForm,
}: {
  displayName: string;
  userEmail: string;
  showAdminLink: boolean;
  version: string;
  logoutForm: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const initials = getInitials(displayName, userEmail);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    function onPointerDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative hidden shrink-0 md:block">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="inline-flex max-w-[12rem] items-center gap-2 rounded-lg border border-[var(--border)] px-2 py-1.5 text-sm hover:bg-[var(--border)]/40"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Account menu"
      >
        <span
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--pwc-orange-muted)] text-xs font-semibold text-[var(--pwc-orange)]"
          aria-hidden="true"
        >
          {initials}
        </span>
        <span className="min-w-0 truncate" title={userEmail}>{displayName}</span>
        <ChevronIcon open={open} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-56 rounded-xl border border-[var(--border)] bg-[var(--background-elevated)] p-2 shadow-xl"
        >
          <div className="border-b border-[var(--border)] px-3 py-2">
            <p className="truncate text-sm font-medium">{displayName}</p>
            <p className="truncate text-xs text-muted" title={userEmail}>{userEmail}</p>
          </div>

          <ul className="py-1">
            <li>
              <Link
                href="/contact-admin"
                role="menuitem"
                onClick={() => setOpen(false)}
                className="block rounded-lg px-3 py-2 text-sm link-nav hover:bg-[var(--border)]/40"
              >
                Contact admin
              </Link>
            </li>
            {showAdminLink && (
              <li>
                <Link
                  href="/admin"
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  className="block rounded-lg px-3 py-2 text-sm link-nav hover:bg-[var(--border)]/40"
                >
                  Admin
                </Link>
              </li>
            )}
            <li>
              <Link
                href="/help#whats-new"
                role="menuitem"
                onClick={() => setOpen(false)}
                className="block rounded-lg px-3 py-2 text-sm text-muted hover:bg-[var(--border)]/40 hover:text-accent"
              >
                Version v{version}
              </Link>
            </li>
          </ul>

          <div className="border-t border-[var(--border)] px-1 pt-1">{logoutForm}</div>
        </div>
      )}
    </div>
  );
}
