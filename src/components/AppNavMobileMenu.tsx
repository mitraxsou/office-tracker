"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";

export type NavLink = {
  href: string;
  label: string;
};

function MenuIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

export function AppNavMobileMenu({
  links,
  userName,
  userEmail,
  version,
  adminTools,
  logoutForm,
}: {
  links: NavLink[];
  userName: string;
  userEmail: string;
  version: string;
  adminTools?: ReactNode;
  logoutForm: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <div className="flex shrink-0 items-center gap-2 md:hidden">
      <ThemeToggle />
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-secondary inline-flex min-h-11 min-w-11 items-center justify-center p-2"
        aria-label="Open navigation menu"
        aria-expanded={open}
        aria-controls="app-nav-mobile-drawer"
      >
        <MenuIcon />
      </button>

      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 bg-black/60"
            aria-label="Close navigation menu"
            onClick={() => setOpen(false)}
          />
          <div
            id="app-nav-mobile-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
            className="fixed inset-y-0 right-0 z-50 flex w-[min(100vw-3rem,20rem)] flex-col border-l border-[var(--border)] bg-[var(--background-elevated)] shadow-xl"
          >
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{userName}</p>
                <p className="truncate text-xs text-muted" title={userEmail}>
                  {userEmail}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="btn-secondary inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center p-2"
                aria-label="Close navigation menu"
              >
                <CloseIcon />
              </button>
            </div>

            <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
              <ul className="space-y-1">
                {links.map((link) => (
                  <li key={`${link.href}:${link.label}`}>
                    <Link
                      href={link.href}
                      onClick={() => setOpen(false)}
                      className="block rounded-lg px-3 py-3 text-base link-nav"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            <div className="shrink-0 space-y-4 border-t border-[var(--border)] px-4 py-4">
              {adminTools && (
                <div className="flex flex-col gap-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted">Admin tools</p>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start">{adminTools}</div>
                </div>
              )}
              <Link
                href="/help#whats-new"
                onClick={() => setOpen(false)}
                className="block py-1 text-sm text-muted hover:text-accent"
              >
                Version v{version}
              </Link>
              <div className="border-t border-[var(--border)] pt-3">{logoutForm}</div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export function AppNavMobileGuestActions() {
  return (
    <div className="flex shrink-0 items-center gap-2 md:hidden">
      <ThemeToggle />
      <Link href="/help" className="link-nav px-2 py-2 text-sm">
        Help
      </Link>
      <Link href="/terms" className="link-nav px-2 py-2 text-sm">
        Terms
      </Link>
      <Link href="/privacy" className="link-nav px-2 py-2 text-sm">
        Privacy
      </Link>
      <Link href="/login" className="btn-primary px-3 py-2 text-sm">
        Sign in
      </Link>
    </div>
  );
}
