export const APP_VERSION = "1.5.19";

export type AppRelease = {
  version: string;
  date: string;
  userBullets: readonly string[];
  adminBullets: readonly string[];
};

export const APP_CHANGELOG: readonly AppRelease[] = [
  {
    version: APP_VERSION,
    date: "2026-10-06",
    userBullets: [
      "Windows agent 1.5.19 treats OfficeConnect as in-office even if an older settings save left it off the Wi-Fi list.",
      "Office tracking starts whenever approved office Wi-Fi (or the office network name) is visible, even if the SSID did not just change.",
      "A missed Wi-Fi read no longer counts as leaving the office.",
    ],
    adminBullets: [
      "OfficeConnect, ExternalConnect, and pwcglb.com stay on the global allowlist; extra SSIDs can still be added.",
      "Agent falls back to any connected network profile name (including Ethernet/captive-portal domains like pwcglb.com) when netsh has no WLAN SSID.",
    ],
  },
  {
    version: "1.5.18",
    date: "2026-10-06",
    userBullets: [
      "Windows agent 1.5.18 starts office tracking whenever approved office Wi-Fi (or the office network name) is visible, even if the SSID did not just change.",
      "A missed Wi-Fi read no longer counts as leaving the office.",
    ],
    adminBullets: [
      "Agent falls back to any connected network profile name (including Ethernet/captive-portal domains like pwcglb.com) when netsh has no WLAN SSID.",
    ],
  },
  {
    version: "1.5.17",
    date: "2026-09-29",
    userBullets: [
      "Windows agent 1.5.17 keeps 2-minute pulses on the laptop only; the server gets critical office in/out, an hourly health check, and a true end-of-day tick upload.",
      "Fixes a bug where every local pulse was labeled “end-of-day diagnostics” and hit the API every few minutes.",
      "Working from home is normal: Today no longer warns about missing Wi-Fi name or “low office activity” when the agent is healthy and you are not in office.",
      "Office hours still count only on approved office Wi-Fi; VPN and home networks never qualify.",
    ],
    adminBullets: [
      "Presence timeline should show Sync: end-of-day diagnostics once per day rollover (plus retries), not on every local pulse.",
      "Admin user reports support selected-day diagnostics (API hits, timeline, activity, install history).",
      "Diagnostic retention (default 7 days) purges legacy heartbeats and activity ticks together; visits and daily API-hit rollups are kept.",
    ],
  },
  {
    version: "1.5.16",
    date: "2026-09-28",
    userBullets: [
      "Windows agent 1.5.16 keeps 2-minute pulses on the laptop, syncs critical office in/out immediately, and sends a compact hourly health check.",
      "Detailed activity ticks upload at end of day (or on first wake), so fewer server requests while Status stays Healthy.",
      "Working from home is normal: Today no longer warns about missing Wi-Fi name or “low office activity” when the agent is healthy and you are not in office.",
      "Office hours still count only on approved office Wi-Fi; VPN and home networks never qualify.",
    ],
    adminBullets: [
      "Admin user reports support selected-day diagnostics (API hits, timeline, activity, install history).",
      "Diagnostic retention (default 7 days) purges legacy heartbeats and activity ticks together; visits and daily API-hit rollups are kept.",
      "Stale office visits close at the agent’s last confirmed local pulse, not at detection time.",
    ],
  },
  {
    version: "1.5.4",
    date: "2026-09-09",
    userBullets: [
      "Redesigned the Today dashboard with a compact hero summary and less scrolling.",
      "Monthly and year compliance now sit side by side on larger screens.",
      "Visits, manual entry, and agent pulses are grouped under Activity details.",
    ],
    adminBullets: [
      "Agent health alerts stay visible at the top of Today in a tighter layout.",
    ],
  },
  {
    version: "1.5.3",
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
