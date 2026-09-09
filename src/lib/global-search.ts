export type GlobalSearchGroup = "pages" | "settings" | "help" | "actions" | "admin";

export type GlobalSearchEntry = {
  id: string;
  label: string;
  description?: string;
  href: string;
  keywords: string[];
  group: GlobalSearchGroup;
  adminOnly?: boolean;
};

export const GLOBAL_SEARCH_GROUP_LABELS: Record<GlobalSearchGroup, string> = {
  pages: "Pages",
  settings: "Settings",
  help: "Help",
  actions: "Quick actions",
  admin: "Admin",
};

export const GLOBAL_SEARCH_INDEX: GlobalSearchEntry[] = [
  {
    id: "dashboard",
    label: "Today",
    description: "Dashboard and manual check-in",
    href: "/dashboard",
    keywords: ["dashboard", "today", "check in", "check out", "presence", "office now"],
    group: "pages",
  },
  {
    id: "reports",
    label: "Reports",
    description: "Monthly office presence reports",
    href: "/reports",
    keywords: ["reports", "monthly", "compliance", "export", "calendar"],
    group: "pages",
  },
  {
    id: "history",
    label: "History",
    description: "Past visits and office days",
    href: "/history",
    keywords: ["history", "visits", "past", "timeline"],
    group: "pages",
  },
  {
    id: "settings",
    label: "Settings",
    description: "Agent, timezone, and account settings",
    href: "/settings",
    keywords: ["settings", "preferences", "account"],
    group: "pages",
  },
  {
    id: "help",
    label: "Help",
    description: "How to use Office Pulse",
    href: "/help",
    keywords: ["help", "guide", "how to", "documentation"],
    group: "pages",
  },
  {
    id: "contact-admin",
    label: "Contact admin",
    description: "Reach out to pilot admins",
    href: "/contact-admin",
    keywords: ["contact", "admin", "message", "support", "reach out"],
    group: "pages",
  },
  {
    id: "settings-agent-install",
    label: "Install agent",
    description: "Download and install the Windows agent",
    href: "/settings#install",
    keywords: ["install", "agent", "download", "token", "powershell", "setup"],
    group: "settings",
  },
  {
    id: "settings-agent-status",
    label: "Agent status",
    description: "Registered laptops and heartbeat health",
    href: "/settings#agent",
    keywords: ["agent", "status", "heartbeat", "laptop", "device", "serial"],
    group: "settings",
  },
  {
    id: "settings-timezone",
    label: "Timezone",
    description: "Change your reporting timezone",
    href: "/settings",
    keywords: ["timezone", "time zone", "ist", "kolkata", "utc"],
    group: "settings",
  },
  {
    id: "settings-notifications",
    label: "Notifications",
    description: "In-app and email notification preferences",
    href: "/settings",
    keywords: ["notifications", "alerts", "email", "reminders"],
    group: "settings",
  },
  {
    id: "settings-ooo",
    label: "Out of office",
    description: "Mark days when you are away",
    href: "/settings",
    keywords: ["out of office", "ooo", "leave", "vacation", "away"],
    group: "settings",
  },
  {
    id: "settings-profile",
    label: "Profile change",
    description: "Request a name or email update",
    href: "/settings",
    keywords: ["profile", "name", "email", "change"],
    group: "settings",
  },
  {
    id: "settings-theme",
    label: "Theme",
    description: "Light or dark appearance",
    href: "/settings",
    keywords: ["theme", "dark", "light", "appearance"],
    group: "settings",
  },
  {
    id: "help-whats-new",
    label: "What's new",
    description: "Latest release notes",
    href: "/help#whats-new",
    keywords: ["whats new", "release", "changelog", "version"],
    group: "help",
  },
  {
    id: "help-overview",
    label: "What it does",
    description: "Office presence pilot overview",
    href: "/help#overview",
    keywords: ["overview", "what it does", "presence", "pilot"],
    group: "help",
  },
  {
    id: "help-install-agent",
    label: "Install the agent",
    description: "Step-by-step agent setup",
    href: "/help#install-agent",
    keywords: ["install agent", "setup", "windows", "agent"],
    group: "help",
  },
  {
    id: "help-update-agent",
    label: "Update the agent",
    description: "Refresh scripts on your laptop",
    href: "/help#update-agent",
    keywords: ["update agent", "refresh", "upgrade"],
    group: "help",
  },
  {
    id: "help-daily-use",
    label: "Daily use",
    description: "Check-ins, dashboard, and routine tasks",
    href: "/help#daily-use",
    keywords: ["daily", "routine", "check in"],
    group: "help",
  },
  {
    id: "help-troubleshooting",
    label: "Troubleshooting",
    description: "Fix common agent and Wi-Fi issues",
    href: "/help#troubleshooting",
    keywords: ["troubleshooting", "fix", "wifi", "ssid", "problem", "issue"],
    group: "help",
  },
  {
    id: "help-presence",
    label: "How presence works",
    description: "Wi-Fi rules and visit counting",
    href: "/help#presence",
    keywords: ["presence", "wifi", "ssid", "visit", "hours"],
    group: "help",
  },
  {
    id: "action-report-bug",
    label: "Report a bug",
    description: "Tell admins about something broken",
    href: "/contact-admin?category=issue",
    keywords: ["bug", "broken", "error", "defect", "report"],
    group: "actions",
  },
  {
    id: "action-request-feature",
    label: "Request a feature",
    description: "Suggest an improvement or new capability",
    href: "/contact-admin?category=feedback",
    keywords: ["feature", "request", "idea", "enhancement", "feedback", "suggestion"],
    group: "actions",
  },
  {
    id: "action-contact-admin",
    label: "Send admin message",
    description: "Open the contact admin form",
    href: "/contact-admin",
    keywords: ["contact", "message", "admin", "support"],
    group: "actions",
  },
  {
    id: "admin-reports",
    label: "Admin reports",
    description: "Org compliance and user overview",
    href: "/admin",
    keywords: ["admin", "reports", "compliance", "org"],
    group: "admin",
    adminOnly: true,
  },
  {
    id: "admin-inbox",
    label: "Admin inbox",
    description: "Open user requests across all queues",
    href: "/admin/inbox",
    keywords: ["admin", "inbox", "requests", "queue"],
    group: "admin",
    adminOnly: true,
  },
  {
    id: "admin-corrections",
    label: "Visit corrections",
    description: "Review and approve visit edits",
    href: "/admin/visit-reports",
    keywords: ["admin", "corrections", "visits", "edit"],
    group: "admin",
    adminOnly: true,
  },
  {
    id: "admin-users",
    label: "Users and tokens",
    description: "Manage pilot users and install tokens",
    href: "/admin/users",
    keywords: ["admin", "users", "tokens", "create user"],
    group: "admin",
    adminOnly: true,
  },
  {
    id: "admin-audit",
    label: "Audit log",
    description: "Search admin and system actions",
    href: "/admin/audit",
    keywords: ["admin", "audit", "log", "history"],
    group: "admin",
    adminOnly: true,
  },
  {
    id: "admin-settings",
    label: "Global settings",
    description: "Office SSIDs, hours target, and app config",
    href: "/admin/settings",
    keywords: ["admin", "settings", "ssid", "global", "config"],
    group: "admin",
    adminOnly: true,
  },
  {
    id: "admin-guide",
    label: "Admin guide",
    description: "Admin workflows and reference",
    href: "/admin/guide",
    keywords: ["admin", "guide", "how to"],
    group: "admin",
    adminOnly: true,
  },
  {
    id: "help-admin",
    label: "Admin notes (help)",
    description: "Admin tips in the user help guide",
    href: "/help#admin",
    keywords: ["admin", "help", "notes"],
    group: "help",
    adminOnly: true,
  },
];

const DEFAULT_SEARCH_ENTRY_IDS = [
  "action-report-bug",
  "action-request-feature",
  "dashboard",
  "reports",
  "history",
  "settings",
  "contact-admin",
  "settings-agent-install",
  "help-troubleshooting",
  "admin-inbox",
  "admin-reports",
] as const;

export function normalizeSearchQuery(query: string): string {
  return query.trim().toLowerCase();
}

export function isVisibleSearchEntry(entry: GlobalSearchEntry, isAdmin: boolean): boolean {
  return !entry.adminOnly || isAdmin;
}

export function matchesSearchEntry(entry: GlobalSearchEntry, query: string): boolean {
  const normalized = normalizeSearchQuery(query);
  if (!normalized) return true;

  const haystack = [entry.label, entry.description ?? "", ...entry.keywords].join(" ").toLowerCase();
  return normalized.split(/\s+/).every((token) => haystack.includes(token));
}

export function filterGlobalSearch(
  query: string,
  options: { isAdmin: boolean; limit?: number },
): GlobalSearchEntry[] {
  const limit = options.limit ?? 20;
  const visible = GLOBAL_SEARCH_INDEX.filter((entry) => isVisibleSearchEntry(entry, options.isAdmin));
  const normalized = normalizeSearchQuery(query);

  if (!normalized) {
    const defaults = DEFAULT_SEARCH_ENTRY_IDS.map((id) =>
      visible.find((entry) => entry.id === id),
    ).filter((entry): entry is GlobalSearchEntry => Boolean(entry));
    return defaults.slice(0, limit);
  }

  return visible.filter((entry) => matchesSearchEntry(entry, query)).slice(0, limit);
}

export function groupSearchResults(entries: GlobalSearchEntry[]): Array<{
  group: GlobalSearchGroup;
  label: string;
  entries: GlobalSearchEntry[];
}> {
  const order: GlobalSearchGroup[] = ["actions", "pages", "settings", "help", "admin"];
  const grouped = new Map<GlobalSearchGroup, GlobalSearchEntry[]>();

  for (const entry of entries) {
    const list = grouped.get(entry.group) ?? [];
    list.push(entry);
    grouped.set(entry.group, list);
  }

  return order
    .filter((group) => grouped.has(group))
    .map((group) => ({
      group,
      label: GLOBAL_SEARCH_GROUP_LABELS[group],
      entries: grouped.get(group) ?? [],
    }));
}
