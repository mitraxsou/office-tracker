export const APP_VERSION = "1.5.0";

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
