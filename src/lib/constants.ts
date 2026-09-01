export const DEFAULT_TIMEZONE = "Asia/Kolkata";
export const DEFAULT_HOURS_TARGET = 5;
export const HEARTBEAT_INTERVAL_MS = 2 * 60 * 1000;
export const VISIT_GAP_MS = 8 * 60 * 1000;

/** Curated IANA zones for the pilot (dropdown). Any valid IANA id still accepted via API. */
export const USER_TIMEZONE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "Asia/Kolkata", label: "India (IST, Asia/Kolkata)" },
  { value: "Asia/Dubai", label: "UAE (GST, Asia/Dubai)" },
  { value: "Asia/Singapore", label: "Singapore (Asia/Singapore)" },
  { value: "Asia/Hong_Kong", label: "Hong Kong (Asia/Hong_Kong)" },
  { value: "Asia/Tokyo", label: "Japan (JST, Asia/Tokyo)" },
  { value: "Australia/Sydney", label: "Australia Eastern (Australia/Sydney)" },
  { value: "Europe/London", label: "UK (GMT/BST, Europe/London)" },
  { value: "Europe/Paris", label: "Central Europe (Europe/Paris)" },
  { value: "America/New_York", label: "US Eastern (America/New_York)" },
  { value: "America/Chicago", label: "US Central (America/Chicago)" },
  { value: "America/Denver", label: "US Mountain (America/Denver)" },
  { value: "America/Los_Angeles", label: "US Pacific (America/Los_Angeles)" },
];

export function timezoneOptionsForUser(currentTimezone: string) {
  const known = new Set(USER_TIMEZONE_OPTIONS.map((o) => o.value));
  if (currentTimezone && !known.has(currentTimezone)) {
    return [
      { value: currentTimezone, label: `${currentTimezone} (current)` },
      ...USER_TIMEZONE_OPTIONS,
    ];
  }
  return USER_TIMEZONE_OPTIONS;
}

/** PwC office Wi-Fi SSIDs — both denote in-office for auto-detection */
export const DEFAULT_OFFICE_SSIDS = ["OfficeConnect", "ExternalConnect"];

export function parseDefaultSsidsFromEnv(): string[] {
  const raw = process.env.DEFAULT_OFFICE_SSIDS;
  if (!raw) return DEFAULT_OFFICE_SSIDS;
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function normalizeSsid(ssid: string): string {
  return ssid
    .trim()
    .replace(/\s+\d+$/, "") // "OfficeConnect 11" -> "OfficeConnect" (Get-NetConnectionProfile)
    .trim();
}

export function isOfficeSsid(ssid: string | null | undefined, allowlist: string[]): boolean {
  if (!ssid) return false;
  const normalized = normalizeSsid(ssid);
  return allowlist.some((allowed) => {
    const normAllowed = normalizeSsid(allowed);
    return normAllowed === normalized || normalized.startsWith(normAllowed);
  });
}
