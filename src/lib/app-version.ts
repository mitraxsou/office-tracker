export const APP_VERSION = "1.5.3";

export type AppRelease = {
  version: string;
  date: string;
  userBullets: readonly string[];
  adminBullets: readonly string[];
};

export const APP_CHANGELOG: readonly AppRelease[] = [
  {
    version: APP_VERSION,
    date: "2026-09-09",
    userBullets: [
      "Simplified the main navigation with fewer items in the top bar.",
      "Mobile nav uses a slide-over menu; search is a compact icon on small screens.",
      "Account menu groups pilot contact, version, and sign out on desktop.",
    ],
    adminBullets: [
      "Admin link and tools stay available from the account menu and mobile drawer.",
    ],
  },
  {
    version: "1.5.2",
    date: "2026-09-09",
    userBullets: [
      "Added global search from the nav bar with Ctrl+K.",
      "Report a bug or request a feature from search quick actions.",
    ],
    adminBullets: [
      "Search includes admin pages such as inbox, audit, and visit corrections.",
    ],
  },
  {
    version: "1.5.1",
    date: "2026-09-09",
    userBullets: [
      "Added Contact pilot team for issues, concerns, or feedback.",
      "You get an in-app notification when your message is answered.",
    ],
    adminBullets: [
      "Added reach-out-to-admin queue on the User requests page with respond and resolve.",
      "Open admin contact messages appear in the admin inbox.",
    ],
  },
  {
    version: "1.5.0",
    date: "2026-09-09",
    userBullets: [
      "Rebranded the app as My Office Pulse with a new pulse-style icon.",
      "Added a year compliance calendar on Today with monthly drill-down.",
      "Added HR exemption requests from the year calendar when you have approved leave or travel.",
      "Improved monthly office-day progress and compliance display.",
    ],
    adminBullets: [
      "Added compliance exemption review queue and direct grant controls.",
      "Added admin visit reports page.",
      "Added admin request inbox and searchable audit report.",
      "Added database usage snapshots beside data maintenance.",
      "Added cron job visibility and notification delivery improvements.",
    ],
  },
  {
    version: "1.4.0",
    date: "2026-09-03",
    userBullets: [
      "Added app release notes on the Help page.",
      "Improved in-app and Teams notification delivery.",
    ],
    adminBullets: [
      "Added the admin request inbox and searchable audit report.",
      "Added database usage and hot-table snapshots beside data maintenance.",
      "Added cron job visibility and notification improvements.",
      "Updated the Windows agent to version 1.2.8.",
    ],
  },
];

export function getCurrentRelease(): AppRelease {
  return APP_CHANGELOG[0];
}

/** Release notes visible on Help; admins see user and admin bullets. */
export function getVisibleReleaseBullets(release: AppRelease, isAdmin: boolean): readonly string[] {
  if (isAdmin) {
    return [...release.userBullets, ...release.adminBullets];
  }
  return release.userBullets;
}
