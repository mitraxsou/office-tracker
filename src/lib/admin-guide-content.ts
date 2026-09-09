export type GuideBlock =
  | { type: "paragraph"; text: string }
  | { type: "list"; items: string[]; ordered?: boolean }
  | { type: "subheading"; text: string }
  | { type: "diagram"; lines: string[] }
  | { type: "troubleshooting"; items: { problem: string; fix: string }[] }
  | { type: "links"; items: { href: string; label: string }[] };

export type GuideSection = {
  id: string;
  title: string;
  blocks: GuideBlock[];
};

export const ADMIN_GUIDE_SECTIONS: GuideSection[] = [
  {
    id: "overview",
    title: "How the app works",
    blocks: [
      {
        type: "paragraph",
        text:
          "My Office Pulse tracks whether pilot users spend at least the configured daily hours in the office (default 5 hours) and meet a monthly office-days target (default 8 days). A Windows agent on each PwC laptop sends heartbeats every 2 minutes. The web app stores visits, compliance, and admin settings in Postgres (Neon on Vercel).",
      },
      {
        type: "diagram",
        lines: [
          "  Windows agent (My Office Pulse)",
          "       |  POST /api/heartbeat (token + serial + SSID)",
          "       v",
          "  Vercel / Next.js app  <---- session cookie ----  Web dashboard",
          "       |",
          "       v",
          "  Neon Postgres",
          "       ^",
          "       |  Admin UI (/admin/*)  role=admin",
          "  Config: GET /api/agent/config (Bearer token only)",
        ],
      },
      {
        type: "subheading",
        text: "Presence rules (server-side)",
      },
      {
        type: "list",
        items: [
          "Counts as in-office: Wi-Fi SSID matches the global allowlist (OfficeConnect, ExternalConnect, pwcglb.com, or admin-configured names), manual check-in, or admin-corrected visits.",
          "Does NOT count: VPN (GlobalProtect), home networks, unknown SSIDs.",
          "Heartbeat gap greater than the visit gap (default 8 minutes) ends the current visit.",
          "Default timezone: Asia/Kolkata. Users can request a timezone change; admins approve on the Corrections page.",
        ],
      },
      {
        type: "subheading",
        text: "Roles",
      },
      {
        type: "list",
        items: [
          "User: dashboard, history, settings, help. Cannot edit SSIDs or global targets.",
          "Admin: all /admin routes, global settings, user management, impersonation, audit log.",
          "Breakglass admin: env BREAKGLASS_EMAIL + BREAKGLASS_PASSWORD; recreated after a database reset.",
        ],
      },
      {
        type: "links",
        items: [
          { href: "/admin", label: "Admin reports" },
          { href: "/admin/settings", label: "Global settings" },
          { href: "/help", label: "User help guide" },
        ],
      },
    ],
  },
  {
    id: "day-to-day",
    title: "Day-to-day admin checklist",
    blocks: [
      {
        type: "paragraph",
        text: "Use this as a standard operating procedure for routine pilot administration.",
      },
      {
        type: "subheading",
        text: "Daily (weekdays)",
      },
      {
        type: "list",
        ordered: true,
        items: [
          "Open Admin reports. Check summary cards: in-office now, attended today, met target %, stale exclusions.",
          "Review the Inbox for open user requests (visit corrections, timezone, profile, HR exemptions, laptop removal).",
          "Scan Agent follow-up panel for stale agents or users who need a nudge.",
          "Approve or deny pending requests on the Corrections page within 1 business day.",
        ],
      },
      {
        type: "subheading",
        text: "Weekly",
      },
      {
        type: "list",
        ordered: true,
        items: [
          "Review org calendar view for the month. Spot patterns (low attendance days, stale agent clusters).",
          "Check Global settings cron jobs: agent-alerts, purge-heartbeats, office-schedule should show Working or a recent manual run.",
          "Issue install tokens for new joiners or new laptops before they ask.",
          "Glance at Audit log for unexpected config changes or impersonation sessions.",
        ],
      },
      {
        type: "subheading",
        text: "Monthly",
      },
      {
        type: "list",
        ordered: true,
        items: [
          "Export compliance data from Reports if your pilot needs a snapshot.",
          "Review agent version report on Users & tokens. Push agent update to all devices after a release if needed.",
          "Confirm heartbeat retention and maintenance purges match your data policy.",
        ],
      },
      {
        type: "subheading",
        text: "Onboarding a new user",
      },
      {
        type: "list",
        ordered: true,
        items: [
          "Create user on Users & tokens (or confirm OTP self-registration is enabled).",
          "Issue one install token per laptop. Share the install command from Settings or copy from the user card.",
          "Confirm first heartbeat within 24 hours. If not, follow agent troubleshooting below.",
          "Set notification preferences and out-of-office if the user travels often.",
        ],
      },
    ],
  },
  {
    id: "reports",
    title: "Reports and compliance",
    blocks: [
      {
        type: "paragraph",
        text:
          "Admin reports (/admin) is the main compliance dashboard: charts, user table, org calendar, in-office-now panel, and agent follow-up.",
      },
      {
        type: "subheading",
        text: "What you can do",
      },
      {
        type: "list",
        items: [
          "Charts tab: hours trend, compliance trend, status donut. Filter by month or custom date range.",
          "Calendar tab: org-wide month view. Click a day for drill-down (who attended, met target, excluded).",
          "User table: search, filter by compliance or agent health, sort columns, export CSV.",
          "Click a user row to open their detailed report (/admin/reports/users/[id]).",
          "In-office now: live list of users currently counted in office.",
          "Agent follow-up: users with stale agents or other follow-up flags.",
        ],
      },
      {
        type: "subheading",
        text: "Stale and out-of-office exclusions",
      },
      {
        type: "list",
        items: [
          "Stale agent: no heartbeat for longer than agent health grace (default 24 hours) and user is not on OOO. Excluded from daily compliance % on that day.",
          "Out of office: user or admin marked OOO for that day. Excluded from compliance denominator.",
          "No visit: user had no office presence that day. Counted as not met, not excluded.",
          "Weekends: shown on calendar but typically not counted toward monthly office-days unless configured otherwise in reporting logic.",
        ],
      },
      {
        type: "troubleshooting",
        items: [
          {
            problem: "Charts show zero users or empty data",
            fix: "Confirm users exist and have bound devices. Check month filter. Refresh the page. If production, verify DATABASE_URL / POSTGRES env on Vercel.",
          },
          {
            problem: "Compliance % looks wrong for one day",
            fix: "Open day drill-down. Check excludedStale and excludedOoo counts. Verify agent grace hours and OOO dates on the user profile.",
          },
          {
            problem: "User shows in office but hours are low",
            fix: "Visit may have started recently or gap ended a visit early. Check History on user report. Consider a visit correction if Wi-Fi detection failed.",
          },
          {
            problem: "Calendar day drill-down will not load",
            fix: "Pick a weekday in the selected month. Check browser console for API errors. Retry after session refresh.",
          },
        ],
      },
      {
        type: "links",
        items: [{ href: "/admin", label: "Open Admin reports" }],
      },
    ],
  },
  {
    id: "users",
    title: "Users and tokens",
    blocks: [
      {
        type: "paragraph",
        text:
          "Users & tokens (/admin/users) is where you create pilot accounts, issue install tokens, manage laptops, reset passwords, impersonate users, and send notifications.",
      },
      {
        type: "subheading",
        text: "Create and manage users",
      },
      {
        type: "list",
        items: [
          "Create user: email, optional name, role (user or admin). Admin-created users appear as Admin-created in the list.",
          "OTP self-registration: on by default in Global settings. First OTP verify creates the account and issues an install token.",
          "Search and paginate the user list. Filter to OTP self-registered only.",
          "Bulk actions: select users for bulk token issue or other batch operations where available.",
          "Edit user: open the edit modal to change name, email, role, or per-user hours override.",
        ],
      },
      {
        type: "subheading",
        text: "Install tokens",
      },
      {
        type: "list",
        items: [
          "One token per laptop install. Status: pending (unused), bound (linked to serial), expired (TTL passed).",
          "Plain token is shown once when created. User copies install command from Settings.",
          "Regenerating a token invalidates the old one. User must re-run install on that laptop.",
          "Pending token TTL is set globally (default from config). Expired tokens cannot bind.",
          "Max laptops per user is enforced globally.",
        ],
      },
      {
        type: "subheading",
        text: "Devices and agent version",
      },
      {
        type: "list",
        items: [
          "Each bound laptop shows serial, last seen, agent script version, stale flag.",
          "Force agent update on one device, or use Push agent update to all devices in Global settings pilot controls.",
          "Remove device: admin can remove directly, or approve a user removal request on Corrections.",
        ],
      },
      {
        type: "subheading",
        text: "Impersonate (View as user)",
      },
      {
        type: "list",
        items: [
          "From a user report or the impersonate picker in the top nav, start View as user.",
          "You see the dashboard as that user. An orange banner shows impersonation is active.",
          "End impersonation from the banner. Actions are logged as impersonate_start / impersonate_end in Audit.",
          "Cannot impersonate yourself or the breakglass account.",
        ],
      },
      {
        type: "subheading",
        text: "Per-user admin tools",
      },
      {
        type: "list",
        items: [
          "Reset password: issues a temporary password; user must change it on next login.",
          "Notifications and OOO: custom Teams/in-app message, out-of-office days, agent grace extension, alert channel prefs.",
          "Visit manager: add, edit, or delete visits on the user report.",
          "Log HR exemption: admin can log month or day exemptions without a user notification.",
        ],
      },
      {
        type: "troubleshooting",
        items: [
          {
            problem: "User cannot install agent (401 heartbeat)",
            fix: "Token regenerated without re-install, wrong laptop serial, or expired pending token. Issue a new token and have user re-run install command from extracted zip folder in PowerShell.",
          },
          {
            problem: "Token shows bound but no heartbeats",
            fix: "Scheduled task PwCOfficePulse may be missing. User should run install.ps1 again or check Task Scheduler. Verify NEXT_PUBLIC_APP_URL in production matches Vercel URL.",
          },
          {
            problem: "Cannot create more tokens (device limit)",
            fix: "Raise max laptops per user in Global settings, or remove an old device first.",
          },
          {
            problem: "OTP login works but user not in list",
            fix: "OTP self-registration may be off in Global settings. Turn it on or create the user manually.",
          },
        ],
      },
      {
        type: "links",
        items: [{ href: "/admin/users", label: "Open Users & tokens" }],
      },
    ],
  },
  {
    id: "inbox",
    title: "Admin inbox",
    blocks: [
      {
        type: "paragraph",
        text:
          "The Inbox (/admin/inbox) aggregates all open user requests in one queue. Each item links to the matching section on the Corrections page.",
      },
      {
        type: "subheading",
        text: "Request types",
      },
      {
        type: "list",
        items: [
          "Visit correction: user disputes hours or missing visit. Review message, approve with edit, or deny.",
          "Timezone change: user requests a new IANA timezone. Approve to apply or deny.",
          "Profile change: user requests name or email update. Approve or deny.",
          "HR exemption: user notifies admin they have HR approval for a month or day. Log the exemption after verification (unless auto-log is on).",
          "Laptop removal: user wants a device de-registered. Approve removes device and frees a token slot.",
        ],
      },
      {
        type: "subheading",
        text: "SOP",
      },
      {
        type: "list",
        ordered: true,
        items: [
          "Triage inbox daily. Sort is newest first.",
          "Click Review to jump to the request type on Corrections.",
          "For visit corrections, verify against user history and heartbeats before approving.",
          "For profile changes, confirm identity out of band if email is changing.",
          "Empty inbox is normal when the pilot is quiet.",
        ],
      },
      {
        type: "troubleshooting",
        items: [
          {
            problem: "Request stuck in inbox after action",
            fix: "Refresh the page. Confirm approve/deny succeeded (no error toast). Check Audit for the action. Open request may still show if status did not update.",
          },
          {
            problem: "User says they submitted but nothing in inbox",
            fix: "They may have closed the form without submit. Check Corrections page filters. Verify they are logged in as the correct account.",
          },
        ],
      },
      {
        type: "links",
        items: [
          { href: "/admin/inbox", label: "Open Inbox" },
          { href: "/admin/visit-reports", label: "Open Corrections" },
        ],
      },
    ],
  },
  {
    id: "corrections",
    title: "Corrections and user requests",
    blocks: [
      {
        type: "paragraph",
        text:
          "The Corrections page (/admin/visit-reports) hosts all approval queues. Sections are anchored: admin_contact, timezone_change, profile_change, compliance_exemption, device_removal, visit_correction.",
      },
      {
        type: "subheading",
        text: "Visit corrections",
      },
      {
        type: "list",
        items: [
          "Users submit from History when auto-tracking missed office time.",
          "Admin can approve with adjusted times, deny with optional note, or fix visits directly on the user report without a request.",
          "Approved corrections update visit records and compliance for that day.",
        ],
      },
      {
        type: "subheading",
        text: "Other queues",
      },
      {
        type: "list",
        items: [
          "Timezone: applies IANA timezone to future day boundaries for that user.",
          "Profile: updates name or email on approval.",
          "HR exemption: month-level or day-level exemption logged by admin after user notification.",
          "Device removal: unbinds serial; user can install again with a new token.",
        ],
      },
      {
        type: "troubleshooting",
        items: [
          {
            problem: "Approved correction but hours unchanged on dashboard",
            fix: "Hard refresh user dashboard. Confirm visit dates overlap the corrected day in user timezone. Check for overlapping visits.",
          },
          {
            problem: "Cannot log exemption",
            fix: "User may already have an active exemption logged. Check user report compliance section.",
          },
        ],
      },
      {
        type: "links",
        items: [{ href: "/admin/visit-reports", label: "Open Corrections" }],
      },
    ],
  },
  {
    id: "audit",
    title: "Audit log",
    blocks: [
      {
        type: "paragraph",
        text:
          "Audit (/admin/audit) records admin and system actions: config changes, impersonation, token operations, visit edits, legal publishes, cron runs, and more.",
      },
      {
        type: "subheading",
        text: "Search filters",
      },
      {
        type: "list",
        items: [
          "Target user: email or name of the affected user.",
          "Actor: admin who performed the action.",
          "Action type: partial match on action code (e.g. config_update, impersonate_start).",
          "Date range: from / to for investigation.",
        ],
      },
      {
        type: "subheading",
        text: "When to use",
      },
      {
        type: "list",
        items: [
          "Investigate who changed office SSIDs or hours target.",
          "Confirm impersonation sessions for support tickets.",
          "Trace token regeneration or password resets.",
          "Review heartbeat purge or maintenance purges.",
        ],
      },
      {
        type: "troubleshooting",
        items: [
          {
            problem: "No entries for a known action",
            fix: "Widen date range. Try action keyword without underscores. Some system actions use the breakglass user as actor.",
          },
          {
            problem: "Audit empty after database reset",
            fix: "Expected. Reset wipes audit log along with all pilot data.",
          },
        ],
      },
      {
        type: "links",
        items: [{ href: "/admin/audit", label: "Open Audit" }],
      },
    ],
  },
  {
    id: "settings",
    title: "Global settings",
    blocks: [
      {
        type: "paragraph",
        text:
          "Global settings (/admin/settings) controls pilot-wide behavior. Changes apply to all users unless a per-user override exists.",
      },
      {
        type: "subheading",
        text: "Global office targets",
      },
      {
        type: "list",
        items: [
          "Daily hours target (default 5).",
          "Monthly office days target (default 8).",
          "Office Wi-Fi SSIDs: one per line. Case-insensitive; strips band suffixes and (Unauthenticated). Prefix match supported.",
          "Max laptops per user.",
          "Pending token TTL, heartbeat retention, visit gap (minutes), agent health grace (hours).",
        ],
      },
      {
        type: "subheading",
        text: "HR exemption workflow toggle",
      },
      {
        type: "list",
        items: [
          "When on, users must wait for admin to log HR exemptions after notifying.",
          "When off, month and day notifications are auto-logged without admin review.",
        ],
      },
      {
        type: "subheading",
        text: "Scheduled jobs (cron)",
      },
      {
        type: "list",
        items: [
          "Agent alerts: daily Power Automate dispatch for eligible Teams alerts (Vercel Hobby: once per day max).",
          "Purge heartbeats: deletes raw heartbeats older than retention; visits kept.",
          "Office schedule sync: weekly inference of office schedules from visit history.",
          "Run now: manual trigger for testing. Health: Working, Never run, Overdue, Failed.",
        ],
      },
      {
        type: "subheading",
        text: "Power Automate webhook secret",
      },
      {
        type: "list",
        items: [
          "Set POWER_AUTOMATE_WEBHOOK_SECRET in Vercel (recommended) or generate X-Office-Pulse-Token secret in Global settings.",
          "Webhook URL lives in POWER_AUTOMATE_WEBHOOK_URL env (never shown in UI).",
          "Env secret takes precedence over any DB-generated secret.",
          "Send test notification to your admin email.",
        ],
      },
      {
        type: "subheading",
        text: "Database stats and maintenance",
      },
      {
        type: "list",
        items: [
          "Database stats: row counts for major tables.",
          "Data maintenance: preview and purge old rows by table and age. Type DELETE to confirm. Never purges users, visits, or open requests.",
        ],
      },
      {
        type: "subheading",
        text: "Pilot controls",
      },
      {
        type: "list",
        items: [
          "OTP self-registration toggle (default on for the pilot).",
          "Push agent update to all devices.",
          "Danger zone: database reset (type RESET). Wipes all data; recreates breakglass admin.",
        ],
      },
      {
        type: "subheading",
        text: "Legal / terms versioning",
      },
      {
        type: "list",
        items: [
          "Edit draft terms and privacy sections.",
          "Save draft without affecting users.",
          "Publish increments legal version; users must re-accept on next login.",
          "Change summary shown on accept screen.",
        ],
      },
      {
        type: "troubleshooting",
        items: [
          {
            problem: "SSID change not reflecting for a user",
            fix: "Save global config. Recent heartbeats are backfilled. User may need a new heartbeat cycle (2 min). Manual check-in uses current SSID list immediately.",
          },
          {
            problem: "Cron shows Overdue",
            fix: "Vercel Hobby limits cron frequency. Run job manually from settings. Check Vercel cron logs and CRON_SECRET.",
          },
          {
            problem: "Power Automate test fails",
            fix: "Verify POWER_AUTOMATE_WEBHOOK_URL and POWER_AUTOMATE_WEBHOOK_SECRET in Vercel. Confirm the active secret matches the PA Condition. Check flow run history in Power Automate.",
          },
          {
            problem: "Save global config returns error",
            fix: "Check numeric bounds (hours 0.5-24, devices 1-50, etc.). Review Audit for validation details.",
          },
        ],
      },
      {
        type: "links",
        items: [{ href: "/admin/settings", label: "Open Global settings" }],
      },
    ],
  },
  {
    id: "notifications",
    title: "Notifications and Power Automate",
    blocks: [
      {
        type: "paragraph",
        text:
          "Alerts can go to the in-app notification corner, Microsoft Teams (via Power Automate), or both depending on user prefs and alert type.",
      },
      {
        type: "subheading",
        text: "Setup (one-time)",
      },
      {
        type: "list",
        ordered: true,
        items: [
          "Set POWER_AUTOMATE_WEBHOOK_URL in Vercel to your HTTP trigger URL.",
          "Set POWER_AUTOMATE_WEBHOOK_SECRET in Vercel (recommended), or generate a webhook secret in Global settings.",
          "In Power Automate, add a Condition on trigger header X-Office-Pulse-Token equals your secret.",
          "Parse JSON body fields (alert type, user email, message) in subsequent steps.",
          "Send test notification from Global settings to verify.",
        ],
      },
      {
        type: "subheading",
        text: "Alert types",
      },
      {
        type: "list",
        items: [
          "OTP login: plain-text email with one-time code (separate from webhook; uses email delivery configured for auth).",
          "hours_started: user reached start threshold for the day (also from heartbeat).",
          "hours_met: user met daily target.",
          "not_in_office: reminder when expected in office but no presence.",
          "agent_stale: no heartbeat within grace period.",
          "custom: admin-sent message from user profile.",
        ],
      },
      {
        type: "subheading",
        text: "Per-user notification prefs",
      },
      {
        type: "list",
        items: [
          "On Users & tokens, expand Notifications and out of office on a user card.",
          "Set channel per alert type: app only, Teams, both, or off.",
          "Office schedule and OOO affect whether not_in_office alerts fire.",
          "Agent grace extension can suppress stale alerts for travel.",
        ],
      },
      {
        type: "troubleshooting",
        items: [
          {
            problem: "Teams messages never arrive",
            fix: "Check webhook URL env, secret match, and user channel prefs. Agent-alerts cron runs once daily on Hobby; some alerts also fire on heartbeat.",
          },
          {
            problem: "OTP emails not received",
            fix: "OTP delivery depends on auth email configuration. User should check spam. Rate limits apply per email.",
          },
          {
            problem: "Too many stale alerts",
            fix: "Raise agent health grace globally or per user. Confirm laptops are not sleeping indefinitely without wake.",
          },
        ],
      },
    ],
  },
  {
    id: "legal",
    title: "Legal and terms versioning",
    blocks: [
      {
        type: "paragraph",
        text:
          "Terms and privacy content is versioned. Users see /terms and /privacy. After you publish a new version, users are prompted to accept at /terms/accept before using the app.",
      },
      {
        type: "subheading",
        text: "Workflow",
      },
      {
        type: "list",
        ordered: true,
        items: [
          "Edit draft sections in Global settings legal panel.",
          "Save draft (no user impact).",
          "Preview via public /terms and /privacy links (published version) or draft preview if available.",
          "Publish: bumps legal version, sets published timestamp, requires re-acceptance.",
          "Add a change summary so users know what changed.",
        ],
      },
      {
        type: "subheading",
        text: "Good practice",
      },
      {
        type: "list",
        items: [
          "Keep language aligned with the hobby pilot disclaimer.",
          "Publish during low-traffic windows.",
          "Check Audit for legal_publish events.",
        ],
      },
      {
        type: "troubleshooting",
        items: [
          {
            problem: "Admin locked out after publish",
            fix: "Admins must also accept new terms. Open /terms/accept while signed in.",
          },
          {
            problem: "Draft not saving",
            fix: "Ensure section titles are filled. Check network and session. Review API error in browser devtools.",
          },
        ],
      },
      {
        type: "links",
        items: [
          { href: "/terms", label: "Public terms" },
          { href: "/privacy", label: "Public privacy" },
        ],
      },
    ],
  },
  {
    id: "agent",
    title: "Agent troubleshooting",
    blocks: [
      {
        type: "paragraph",
        text:
          "The Windows agent (My Office Pulse) runs every 2 minutes via scheduled task PwCOfficePulse. No IT admin rights required for default install to %LOCALAPPDATA%\\OfficeTracker\\.",
      },
      {
        type: "subheading",
        text: "SSID detection order",
      },
      {
        type: "list",
        ordered: true,
        items: [
          "netsh wlan show interfaces (preferred connected WLAN).",
          "Get-NetConnectionProfile when netsh has no valid SSID (may show pwcglb.com captive portal name).",
          "WMI fallback if needed.",
        ],
      },
      {
        type: "subheading",
        text: "Common issues",
      },
      {
        type: "troubleshooting",
        items: [
          {
            problem: "SSID shows none or wrong network",
            fix: "Location may be blocked by IT; agent uses NetConnectionProfile fallback. User can manual check-in. Verify office SSID is on global allowlist.",
          },
          {
            problem: "Agent stale on dashboard",
            fix: "Laptop asleep, task disabled, or token invalid. Re-run install.ps1 from zip in PowerShell. Check Task Scheduler for PwCOfficePulse.",
          },
          {
            problem: "Heartbeats stop after sleep",
            fix: "Normal until wake. Visit gap may have closed the visit; new heartbeat starts a new visit. User can check in manually after long sleep.",
          },
          {
            problem: "PowerShell window flashes",
            fix: "Task should use wscript.exe run-heartbeat.vbs. Re-run install.ps1 to fix task registration.",
          },
          {
            problem: "Wrong laptop serial",
            fix: "Token bound to different BIOS serial. Issue new token or remove wrong device in admin.",
          },
          {
            problem: "Agent version outdated",
            fix: "User runs update command from Settings, or admin pushes update to all devices. Device picks up on next heartbeat.",
          },
        ],
      },
      {
        type: "subheading",
        text: "Install checklist for support",
      },
      {
        type: "list",
        ordered: true,
        items: [
          "Download agent zip from Settings (session required).",
          "Extract fully (nested PwCOfficePulse folder is common on OneDrive Downloads).",
          "Open PowerShell in extract folder (not cmd.exe).",
          "Paste install command from Settings. Wait for success message.",
          "Confirm first heartbeat in admin user card within 5 minutes.",
        ],
      },
    ],
  },
  {
    id: "faq",
    title: "FAQ",
    blocks: [
      {
        type: "list",
        items: [
          "Q: Is this official PwC software? A: No. My Office Pulse is a voluntary hobby pilot, not IT-approved production tooling.",
          "Q: Can users see office SSID names? A: No. SSIDs are server-side only. Users see whether they are in office, not which network matched.",
          "Q: Does VPN count as office? A: No. GlobalProtect and other VPNs are ignored for presence.",
          "Q: How many laptops per person? A: Configurable max (default from global settings). One token per laptop.",
          "Q: What happens if we change hours target mid-month? A: Applies to future calculations. Past visit records are unchanged.",
          "Q: Can we delete one user without reset? A: Use user management; there is no single-click delete in the guide UI. Database reset wipes everything.",
          "Q: Who can access /admin? A: Only users with role=admin. Breakglass account is always admin.",
          "Q: How do we add a second admin? A: Create or edit user and set role to admin.",
          "Q: Where are secrets stored? A: Agent tokens are bcrypt hashes. Webhook secret in DB. BREAKGLASS and AUTH_SECRET in Vercel env only.",
          "Q: Can cron run more than once a day on Vercel Hobby? A: No. Hourly crons are rejected. Use daily schedules or manual Run now.",
        ],
      },
    ],
  },
  {
    id: "good-to-know",
    title: "Good to know and pilot limitations",
    blocks: [
      {
        type: "paragraph",
        text:
          "My Office Pulse is a hobby project for a small pilot. It is not supported by PwC IT, Global Security, or HR systems of record.",
      },
      {
        type: "list",
        items: [
          "Compliance numbers are indicative for the pilot, not payroll or HR evidence.",
          "Browser dashboard cannot detect Wi-Fi; only the Windows agent or manual check-in counts.",
          "Neon free tier and Vercel Hobby impose rate and cron limits.",
          "ALLOW_REGISTRATION=false blocks the legacy /register password page only. OTP self-registration uses the admin toggle.",
          "Never commit .env.local, database files, or webhook secrets to git.",
          "Use Audit and breakglass sparingly; impersonation is for support, not routine browsing.",
          "Agent install is per-user AppData by default; Program Files install requires -RequireAdmin.",
          "Timezone defaults to Asia/Kolkata; global reporting uses user timezone for day boundaries.",
        ],
      },
    ],
  },
  {
    id: "emergency",
    title: "Emergency and breakglass",
    blocks: [
      {
        type: "paragraph",
        text:
          "When normal admin access fails (lost password, corrupted data, locked terms), use breakglass credentials from Vercel environment variables.",
      },
      {
        type: "subheading",
        text: "Breakglass access",
      },
      {
        type: "list",
        ordered: true,
        items: [
          "Set BREAKGLASS_EMAIL and BREAKGLASS_PASSWORD in Vercel (and .env.local for dev).",
          "Sign in at /login with password mode using those credentials.",
          "Breakglass user is recreated on deploy seed and after database reset.",
          "Cannot be impersonated by other admins.",
        ],
      },
      {
        type: "subheading",
        text: "Database reset (last resort)",
      },
      {
        type: "list",
        items: [
          "Global settings, Pilot controls, Danger zone: type RESET to wipe all pilot data.",
          "Recreates default AppConfig and breakglass admin.",
          "All users, visits, tokens, and audit history are deleted.",
          "For schema-only issues, prefer RUN_DB_SETUP_ON_DEPLOY=true or server startup migration instead of reset.",
        ],
      },
      {
        type: "subheading",
        text: "Production recovery checklist",
      },
      {
        type: "list",
        ordered: true,
        items: [
          "Verify Vercel env: AUTH_SECRET, NEXT_PUBLIC_APP_URL, POSTGRES_*, BREAKGLASS_*, POWER_AUTOMATE_WEBHOOK_URL, POWER_AUTOMATE_WEBHOOK_SECRET.",
          "Sign in with breakglass. Re-seed office SSIDs and targets if reset.",
          "Re-create pilot users or re-enable OTP self-registration temporarily.",
          "Have users re-install agent with new tokens after a full reset.",
          "Set or rotate POWER_AUTOMATE_WEBHOOK_SECRET in Vercel and update the PA Condition (or re-generate an admin DB secret if env is unset).",
        ],
      },
      {
        type: "troubleshooting",
        items: [
          {
            problem: "All admins locked out",
            fix: "Use breakglass password login. If breakglass env missing, set vars in Vercel and redeploy to run ensureBreakglassAdmin.",
          },
          {
            problem: "App returns 500 after deploy",
            fix: "Check Vercel function logs. Run db:push against Neon. Confirm POSTGRES_PRISMA_URL is set without wrong prefix.",
          },
          {
            problem: "Session invalid for everyone",
            fix: "AUTH_SECRET may have changed. Users must sign in again.",
          },
        ],
      },
    ],
  },
];

export const ADMIN_GUIDE_NAV = ADMIN_GUIDE_SECTIONS.map((s) => ({
  id: s.id,
  title: s.title,
}));
