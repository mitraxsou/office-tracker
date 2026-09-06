"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

const links = [
  { href: "/admin", label: "Reports", key: "reports" as const },
  { href: "/admin/inbox", label: "Inbox", key: "inbox" as const },
  { href: "/admin/visit-reports", label: "Corrections", key: "corrections" as const },
  { href: "/admin/users", label: "Users & tokens", key: "users" as const },
  { href: "/admin/audit", label: "Audit", key: "audit" as const },
  { href: "/admin/settings", label: "Global settings", key: "settings" as const },
];

export function AdminSubNav({
  active,
}: {
  active: "reports" | "inbox" | "corrections" | "users" | "audit" | "settings";
}) {
  const router = useRouter();
  const activeHref = links.find((link) => link.key === active)?.href ?? "/admin";

  return (
    <>
      <label className="mb-4 block md:hidden">
        <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">
          Admin section
        </span>
        <select
          value={activeHref}
          onChange={(event) => router.push(event.target.value)}
          className="w-full rounded-lg border px-3 py-2.5 text-sm"
          aria-label="Admin section"
        >
          {links.map((link) => (
            <option key={link.href} value={link.href}>
              {link.label}
            </option>
          ))}
        </select>
      </label>

      <nav className="hidden gap-2 border-b border-[var(--border)] pb-4 md:flex md:flex-wrap">
        {links.map((link) => {
          const isActive = link.key === active;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-lg px-3 py-1.5 text-sm ${
                isActive
                  ? "bg-[var(--pwc-orange)]/20 font-medium text-accent"
                  : "text-muted hover:bg-[var(--border)] hover:text-[var(--foreground)]"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
