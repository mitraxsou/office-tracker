import type { SectionNavItem } from "@/components/SectionNavLayout";

const BASE_HELP_NAV: SectionNavItem[] = [
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
  { id: "admin", label: "Admin notes" },
];

export function getHelpNavItems(isAdmin: boolean): SectionNavItem[] {
  if (isAdmin) return BASE_HELP_NAV;
  return BASE_HELP_NAV.filter((item) => item.id !== "admin");
}

export function resolveHelpHash(rawHash: string): { activeId: string; scrollToId?: string } | null {
  const h = rawHash.replace("#", "");
  if (h === "update-agent" || h === "install-first-time") {
    return { activeId: "install-agent", scrollToId: h };
  }
  return null;
}
