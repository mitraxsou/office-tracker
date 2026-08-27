import Link from "next/link";

const links = [
  { href: "/admin", label: "Reports" },
  { href: "/admin/users", label: "Users & tokens" },
  { href: "/admin/settings", label: "Global settings" },
];

export function AdminSubNav({ active }: { active: "reports" | "users" | "settings" }) {
  return (
    <nav className="flex flex-wrap gap-2 border-b border-[var(--border)] pb-4">
      {links.map((link) => {
        const isActive =
          (active === "reports" && link.href === "/admin") ||
          (active === "users" && link.href === "/admin/users") ||
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
