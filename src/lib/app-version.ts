export const APP_VERSION = "1.4.0";

export type AppRelease = {
  version: string;
  date: string;
  bullets: readonly string[];
};

export const APP_CHANGELOG: readonly AppRelease[] = [
  {
    version: APP_VERSION,
    date: "2026-09-03",
    bullets: [
      "Added the admin request inbox and searchable audit report.",
      "Added database usage and hot-table snapshots beside data maintenance.",
      "Added app release notes, cron job visibility, and notification improvements.",
      "Updated the Windows agent to version 1.2.8.",
    ],
  },
];

export function getCurrentRelease(): AppRelease {
  return APP_CHANGELOG[0];
}
