import { isOfficeSsid } from "./constants";

/** Re-evaluate in-office from stored SSID + current allowlist (retroactive when admin adds SSIDs). */
export function heartbeatInOffice(
  heartbeat: { ssid: string | null; inOffice: boolean },
  allowlist: string[],
): boolean {
  if (heartbeat.ssid) {
    return isOfficeSsid(heartbeat.ssid, allowlist);
  }
  return heartbeat.inOffice;
}
