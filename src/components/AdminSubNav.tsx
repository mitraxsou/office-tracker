import Link from "next/link";

const links = [
  { href: "/admin", label: "Reports" },
  { href: "/admin/inbox", label: "Inbox" },
  { href: "/admin/visit-reports", label: "Corrections" },
  { href: "/admin/users", label: "Users & tokens" },
  { href: "/admin/audit", label: "Audit" },
  { href: "/admin/settings", label: "Global settings" },
];

export function AdminSubNav({
  active,
}: {
  active: "reports" | "inbox" | "corrections" | "users" | "audit" | "settings";
}) {
  return (
    <nav className="flex flex-wrap gap-2 border-b border-[var(--border)] pb-4">
      {links.map((link) => {
        const isActive =
          (active === "reports" && link.href === "/admin") ||
          (active === "inbox" && link.href === "/admin/inbox") ||
          (active === "corrections" && link.href === "/admin/visit-reports") ||
          (active === "users" && link.href === "/admin/users") ||
          (active === "audit" && link.href === "/admin/audit") ||
          (active === "settings" && link.href === "/admin/settings");
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
  );
}
