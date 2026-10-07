export const APP_VERSION = "1.5.31";

export type AppRelease = {
  version: string;
  date: string;
  userBullets: readonly string[];
  adminBullets: readonly string[];
};

export const APP_CHANGELOG: readonly AppRelease[] = [
  {
    version: APP_VERSION,
    date: "2026-10-07",
    userBullets: [
      "Office hours for a day only count when there is a Visit row, so a ghost Met day without visits no longer appears.",
    ],
    adminBullets: [
      "User reports center on a Day workspace with Correct this day opening a modal (bottom sheet on phones).",
      "Admin home has a collapsible In office that day roster with in/out times, date navigation, and Open day links.",
      "Admin sits in the primary nav on desktop and in the mobile menu for admins.",
      "Diagnostics (full visit editor, agent activity) are collapsed under the day workspace.",
    ],
  },
  {
    version: "1.5.30",
    date: "2026-10-07",
    userBullets: [
      "Agent 1.5.23 writes a plain-English last-run-summary.txt on your laptop so you can see wake, Wi-Fi, and whether office time started.",
      "Settings → Agent shows where to open that file; heartbeat.log also has [DIAG/…] lines for resume, SSID, and visits.",
    ],
    adminBullets: [
      "Diagnostic logging is observe-only and does not change visit or hours logic.",
      "Ask users for logs\\last-run-summary.txt first when investigating false check-ins after sleep.",
    ],
  },
  {
    version: "1.5.29",
    date: "2026-10-07",
    userBullets: [
      "After a long sleep, the agent only starts a new office visit when netsh shows a real office Wi-Fi SSID, so a false early-morning check-in cannot invent 15h of office time.",
      "Agent 1.5.22 aborts network waits that freeze across sleep and re-checks Wi-Fi before presence decisions.",
    ],
    adminBullets: [
      "Large-gap session_resume batches reject openVisit / visit_start stamps before the resume wake time.",
      "Update the Windows agent to 1.5.22 so the laptop-side long-gap netsh gate applies.",
    ],
  },
  {
    version: "1.5.28",
    date: "2026-10-07",
    userBullets: [
      "Turning the laptop off overnight no longer triggers a false \"5h completed\" Teams alert when you check in the next afternoon.",
      "Agent 1.5.21 closes leftover open visits at day rollover so office hours restart cleanly.",
    ],
    adminBullets: [
      "hours_met uses the same live day total as the monthly snapshot wording in one alert batch.",
      "Server rejects overnight agent openVisit backdates and closes cross-day open visits before alert evaluation.",
    ],
  },
  {
    version: "1.5.27",
    date: "2026-10-06",
    userBullets: [
      "Replacing a laptop token from Settings now always needs approval first, even on a test account, so an accidental click cannot disconnect the agent.",
      "First-time Generate setup command still works when you have no token yet.",
    ],
    adminBullets: [
      "Admins no longer skip the queue on their own Settings. Request regenerate, then approve on User requests (Token regenerate) to issue the replacement.",
      "You can still reissue another user's token from their admin report when helping them.",
    ],
  },
  {
    version: "1.5.26",
    date: "2026-10-06",
    userBullets: [
      "No user-facing change in this release.",
    ],
    adminBullets: [
      "Audit rows keep the ? help tooltip. Per-row SOP links are gone; use How to read this log and What each action means on the page.",
      "Audit From/To date pickers stay dark in dark mode instead of flashing a light calendar control.",
    ],
  },
  {
    version: "1.5.25",
    date: "2026-10-06",
    userBullets: [
      "Regenerating a laptop token now needs approval first, so an accidental click cannot disconnect the agent.",
      "First-time Generate setup command still works when you have no token yet.",
    ],
    adminBullets: [
      "Token regenerate requests land on User requests. Approve to revoke the old token and issue a replacement.",
      "Admins can still regenerate immediately on their own Settings. Impersonating a user follows the request flow.",
    ],
  },
  {
    version: "1.5.24",
    date: "2026-10-06",
    userBullets: [
      "No user-facing change in this release.",
    ],
    adminBullets: [
      "Fixes the Audit page crash so timestamps, timezone picker, and action SOP links load.",
    ],
  },
  {
    version: "1.5.23",
    date: "2026-10-06",
    userBullets: [
      "No user-facing change in this release.",
    ],
    adminBullets: [
      "Audit timestamps show in your timezone, with a picker for UTC or other zones. ISO times in Details are converted too.",
      "Each audit action has a short label, help text, and an SOP link to Admin guide (what each action means).",
    ],
  },
  {
    version: "1.5.22",
    date: "2026-10-06",
    userBullets: [
      "Activity details on Today shows Visits and Manual visit only. Dense agent ticks are not listed as a live session.",
    ],
    adminBullets: [
      "Last uploaded ticks sit under Debug on the user report Wi-Fi log, with help on when to use each trail.",
      "Diagnostic retention, health grace, visit gap, and tick purge link from that log to Global settings.",
    ],
  },
  {
    version: "1.5.21",
    date: "2026-10-06",
    userBullets: [
      "Refreshing Today applies a recovered Wi-Fi check-in that already reached the server, without waiting for the next hourly health ping.",
    ],
    adminBullets: [
      "Accepted visit_start events backdate the matching Wi-Fi visit when Today loads, including recoveries that arrived before 1.5.20.",
    ],
  },
  {
    version: "1.5.20",
    date: "2026-10-06",
    userBullets: [
      "If office Wi-Fi was seen but a visit started late, the agent now recovers the real first check-in from local pulses on its own.",
      "Windows agent 1.5.20 treats OfficeConnect as in-office even if an older settings save left it off the Wi-Fi list.",
      "Office tracking starts whenever approved office Wi-Fi (or the office network name) is visible, even if the SSID did not just change.",
      "A missed Wi-Fi read no longer counts as leaving the office.",
    ],
    adminBullets: [
      "Delayed office activity ticks backdate the matching Wi-Fi visit start. Closed manual visits are left unchanged.",
      "OfficeConnect, ExternalConnect, and pwcglb.com stay on the global allowlist; extra SSIDs can still be added.",
      "Agent falls back to any connected network profile name (including Ethernet/captive-portal domains like pwcglb.com) when netsh has no WLAN SSID.",
    ],
  },
  {
    version: "1.5.19",
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
