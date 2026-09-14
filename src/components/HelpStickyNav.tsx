"use client";

export type HelpNavItem = { id: string; label: string; adminOnly?: boolean };

const NAV_ITEMS: HelpNavItem[] = [
  { id: "whats-new", label: "What's new" },
  { id: "overview", label: "What it does" },
  { id: "legal", label: "Terms and privacy" },
  { id: "account", label: "Get an account" },
  { id: "setup-flow", label: "Setup flow" },
  { id: "install-agent", label: "Install the agent" },
  { id: "daily-use", label: "Today and Reports" },
  { id: "settings", label: "Settings" },
  { id: "contact-admin", label: "Contact admin" },
  { id: "troubleshooting", label: "Troubleshooting" },
  { id: "presence", label: "How presence works" },
  { id: "admin", label: "Admin notes", adminOnly: true },
];

export function HelpStickyNav({ isAdmin }: { isAdmin: boolean }) {
  const items = NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin);

  return (
    <>
      <div className="sticky top-4 z-10 -mx-4 bg-[var(--background)] px-4 pb-2 md:hidden">
        <label className="block">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">
            Help section
          </span>
          <select
            className="w-full rounded-lg border px-3 py-2.5 text-sm"
            aria-label="Help section"
            defaultValue=""
            onChange={(event) => {
              const id = event.target.value;
              if (!id) return;
              document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
          >
            <option value="" disabled>
              Jump to section
            </option>
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <nav className="hidden w-44 shrink-0 md:block" aria-label="Help sections">
        <p className="mb-2 pl-3 text-xs font-medium uppercase tracking-wide text-muted">On this page</p>
        <ul className="sticky top-6 max-h-[calc(100vh-3rem)] space-y-0.5 overflow-y-auto border-l border-[var(--border)] pl-3">
          {items.map((item) => (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                className="block rounded-r-lg py-1.5 pl-3 text-sm text-muted transition-colors hover:text-[var(--foreground)]"
              >
                {item.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
