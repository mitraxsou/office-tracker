export const DEFAULT_TIMEZONE = "Asia/Kolkata";
export const DEFAULT_HOURS_TARGET = 5;
export const HEARTBEAT_INTERVAL_MS = 2 * 60 * 1000;
export const VISIT_GAP_MS = 8 * 60 * 1000;

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
