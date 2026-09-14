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

function MobileDrawer({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  if (!open) return null;

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-[60] bg-black/60"
        aria-label="Close navigation menu"
        onClick={onClose}
      />
      <div
        id="app-nav-mobile-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        className="fixed inset-y-0 right-0 z-[70] flex w-[min(100vw-3rem,20rem)] flex-col border-l border-[var(--border)] bg-[var(--background-elevated)] shadow-xl"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{title}</p>
            {subtitle && (
              <p className="truncate text-xs text-muted" title={subtitle}>
                {subtitle}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center p-2"
            aria-label="Close navigation menu"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>

        <div className="shrink-0 border-t border-[var(--border)] px-4 py-4">{footer}</div>
      </div>
    </>
  );
}

export function AppNavMobileMenu({
  links,
  primaryCount,
  userName,
  userEmail,
  version,
  adminTools,
  logoutForm,
}: {
  links: NavLink[];
  primaryCount: number;
  userName: string;
  userEmail: string;
  version: string;
  adminTools?: ReactNode;
  logoutForm: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const primaryLinks = links.slice(0, primaryCount);
  const secondaryLinks = links.slice(primaryCount);

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

  const close = () => setOpen(false);

  return (
    <>
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

      <MobileDrawer
        open={open}
        onClose={close}
        title={userName}
        subtitle={userEmail}
        footer={
          <div className="space-y-4">
            {adminTools && (
              <div className="flex flex-col gap-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted">Admin tools</p>
                <div className="flex flex-col gap-3">{adminTools}</div>
              </div>
            )}
            <div className="flex items-center justify-between gap-3">
              <Link
                href="/help#whats-new"
                onClick={close}
                className="text-sm text-muted hover:text-accent"
              >
                Version v{version}
              </Link>
              <ThemeToggle />
            </div>
            <div className="border-t border-[var(--border)] pt-3">{logoutForm}</div>
          </div>
        }
      >
        <nav className="px-3 py-4">
          <ul className="space-y-1">
            {primaryLinks.map((link) => (
              <li key={`${link.href}:${link.label}`}>
                <Link
                  href={link.href}
                  onClick={close}
                  className="block rounded-lg px-3 py-3 text-base link-nav"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>

          {secondaryLinks.length > 0 && (
            <div className="mt-4 border-t border-[var(--border)] pt-4">
              <p className="px-3 pb-2 text-xs font-medium uppercase tracking-wide text-muted">More</p>
              <ul className="space-y-1">
                {secondaryLinks.map((link) => (
                  <li key={`${link.href}:${link.label}`}>
                    <Link
                      href={link.href}
                      onClick={close}
                      className="block rounded-lg px-3 py-3 text-base link-nav"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </nav>
      </MobileDrawer>
    </>
  );
}

const guestLinks: NavLink[] = [
  { href: "/help", label: "Help" },
  { href: "/terms", label: "Terms" },
  { href: "/privacy", label: "Privacy" },
];

export function AppNavMobileGuestMenu() {
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

  const close = () => setOpen(false);

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

      <MobileDrawer
        open={open}
        onClose={close}
        title="Menu"
        footer={
          <Link href="/login" onClick={close} className="btn-primary block w-full px-3 py-2.5 text-center text-sm">
            Sign in
          </Link>
        }
      >
        <nav className="px-3 py-4">
          <ul className="space-y-1">
            {guestLinks.map((link) => (
              <li key={`${link.href}:${link.label}`}>
                <Link
                  href={link.href}
                  onClick={close}
                  className="block rounded-lg px-3 py-3 text-base link-nav"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </MobileDrawer>
    </div>
  );
}
