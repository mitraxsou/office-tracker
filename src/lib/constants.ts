export const DEFAULT_TIMEZONE = "Asia/Kolkata";
export const DEFAULT_HOURS_TARGET = 5;
export const DEFAULT_MONTHLY_DAYS_TARGET = 8;
/** When manual visit check-out is omitted, close the visit this many minutes after check-in. */
export const DEFAULT_MANUAL_VISIT_DURATION_MINUTES = 5;
export const HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000;
export const VISIT_GAP_MS = 15 * 60 * 1000;

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

/** PwC office Wi-Fi SSIDs — all denote in-office for auto-detection */
export const DEFAULT_OFFICE_SSIDS = ["OfficeConnect", "ExternalConnect", "pwcglb.com"];

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
    .replace(/\s*\(unauthenticated\)\s*$/i, "") // Windows Get-NetConnectionProfile captive portal suffix
    .replace(/\s+\d+$/, "") // "OfficeConnect 2" / "pwcglb.com 2" band suffix from Windows
    .trim();
}

/** Allowlist entry prefix for matching (strips optional trailing * wildcard). */
export function allowlistMatchPrefix(allowed: string): string {
  const norm = normalizeSsid(allowed).toLowerCase();
  return norm.endsWith("*") ? norm.slice(0, -1) : norm;
}

export function isOfficeSsid(ssid: string | null | undefined, allowlist: string[]): boolean {
  if (!ssid) return false;
  const normalized = normalizeSsid(ssid).toLowerCase();
  return allowlist.some((allowed) => {
    const prefix = allowlistMatchPrefix(allowed);
    if (!prefix) return false;
    return normalized === prefix || normalized.startsWith(prefix);
  });
}

/** True when an SSID was added or removed. Case, order, and whitespace are not a change. */
export function officeSsidAllowlistChanged(prev: string[], next: string[]): boolean {
  const key = (ssid: string) => normalizeSsid(ssid).toLowerCase();
  const before = new Set(prev.map(key));
  const after = new Set(next.map(key));
  if (before.size !== after.size) return true;
  return [...after].some((ssid) => !before.has(ssid));
}

/** SSIDs stored on visits or heartbeats that the allowlist no longer covers. */
export function ssidsNoLongerAllowed(ssids: Array<string | null>, allowlist: string[]): string[] {
  return ssids.filter((ssid): ssid is string => ssid !== null && !isOfficeSsid(ssid, allowlist));
}
