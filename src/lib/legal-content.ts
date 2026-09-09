export const HOBBY_DISCLAIMER = {
  title: "Hobby project disclaimer",
  paragraphs: [
    "My Office Pulse (Office Tracker) is a hobby project built for fun and personal interest. It is not a PwC product, not official PwC tooling, and not endorsed by PwC.",
    "The app and Windows agent are provided for educational and experimental use. You sign up and install the agent voluntarily, at your own interest and benefit.",
    "The developer is not responsible for any action, outcome, or improper use of the website, API, or Windows agent. Use at your own risk.",
  ],
};

export const PRIVACY_SECTIONS = [
  {
    title: "What we collect",
    items: [
      "Account email and optional display name",
      "Password hash (for password sign-in) and session cookies",
      "Office visit times, manual check-ins, and Wi-Fi SSID names sent by the agent",
      "Laptop BIOS serial numbers and agent tokens (stored as hashes on the server)",
      "Heartbeat timestamps, optional VPN gateway name (diagnostic only), and agent version",
      "Notification preferences, out-of-office dates, and in-app messages",
      "Admin audit log entries for support and compliance actions",
    ],
  },
  {
    title: "What we do not collect",
    items: [
      "Browsing history, keystrokes, screenshots, or running process lists",
      "Files on your laptop beyond what the agent scripts need to run",
    ],
  },
  {
    title: "How data is used",
    items: [
      "Calculate office presence hours and pilot compliance reports",
      "Send sign-in codes and optional Teams or in-app alerts you configure",
      "Operate admin tools (corrections, device removal, impersonation for support)",
    ],
  },
  {
    title: "Retention and sharing",
    items: [
      "Heartbeats are purged on a rolling schedule (see admin maintenance settings)",
      "Visit history and account data remain until an admin deletes or resets your account",
      "We do not sell your data. Data stays in the app database and integrations you configure (for example Microsoft Teams via Power Automate)",
    ],
  },
];

export const TERMS_SECTIONS = [
  {
    title: "Acceptance",
    body: "By creating an account, signing in, or installing the Windows agent, you agree to these Terms and our Privacy Policy. If you do not agree, do not use the app.",
  },
  {
    title: "Voluntary participation",
    body: "Participation is opt-in. You choose to register, sign in, and install the agent. You may stop at any time by signing out, uninstalling the agent, and asking an admin to remove your account if needed.",
  },
  {
    title: "Acceptable use",
    body: "Use the app only for tracking your own office presence during the pilot. Do not attempt to bypass security, access other users' data, or misuse agent tokens. Admins may suspend access for abuse.",
  },
  {
    title: "No warranty",
    body: "The app and agent are provided as-is, without warranty of any kind. Hours, SSID detection, and notifications may be wrong or unavailable. Do not rely on this app for employment, HR, or legal decisions.",
  },
  {
    title: "Limitation of liability",
    body: "To the fullest extent permitted by law, the developer is not liable for any direct, indirect, or consequential damages arising from use or misuse of the website, API, or Windows agent, including lost data, incorrect compliance readings, or notification failures.",
  },
  {
    title: "Changes",
    body: "These Terms or the Privacy Policy may change. Continued use after changes are posted means you accept the updated version. Existing users may be asked to accept again on next sign-in.",
  },
];
