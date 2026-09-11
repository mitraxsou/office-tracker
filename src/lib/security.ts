export const API_VERSION = "1.0.0";

export const MAX_SSID_LENGTH = 64;
export const MAX_VPN_GATEWAY_LENGTH = 128;
export const MAX_TIMEZONE_LENGTH = 64;
export const MAX_SERIAL_LENGTH = 64;
export const MAX_AGENT_API_URL_LENGTH = 200;
export const HEARTBEAT_RATE_LIMIT_MS = 30_000;

const rateLimitMap = new Map<string, number>();

export function checkRateLimit(key: string, windowMs = HEARTBEAT_RATE_LIMIT_MS): boolean {
  const now = Date.now();
  const last = rateLimitMap.get(key);
  if (last !== undefined && now - last < windowMs) {
    return false;
  }
  rateLimitMap.set(key, now);
  return true;
}

export function sanitizeSsid(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_SSID_LENGTH) return null;
  if (/[\x00-\x1f<>"]/.test(trimmed)) return null;
  return trimmed;
}

export function sanitizeVpnGateway(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_VPN_GATEWAY_LENGTH) return null;
  if (/[\x00-\x1f<>"]/.test(trimmed)) return null;
  return trimmed;
}

export function parseTimestamp(value: unknown): Date | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const now = Date.now();
  const fiveMinutes = 5 * 60 * 1000;
  const oneDay = 24 * 60 * 60 * 1000;
  if (date.getTime() > now + fiveMinutes || date.getTime() < now - oneDay) {
    return null;
  }
  return date;
}

export function extractBearerToken(request: Request): string | null {
  const auth = request.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) {
    const token = auth.slice(7).trim();
    if (token.length >= 16 && token.length <= 128) return token;
  }
  return null;
}

/** Origin the client used to reach this deployment (from Vercel/proxy headers). */
export function resolveRequestAppOrigin(request: Request): string | null {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = (forwardedHost ?? request.headers.get("host"))?.split(",")[0]?.trim();
  if (!host) return null;
  const protoHeader = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const proto =
    protoHeader ||
    (host.includes("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");
  return `${proto}://${host}`.replace(/\/$/, "");
}

export function sanitizeAgentApiUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().replace(/\/$/, "");
  if (!trimmed || trimmed.length > MAX_AGENT_API_URL_LENGTH) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (url.username || url.password) return null;
    return `${url.protocol}//${url.host}`;
  } catch {
    return null;
  }
}

export function extractTokenFromBody(body: { token?: unknown }): string | null {
  if (typeof body.token !== "string") return null;
  const token = body.token.trim();
  if (token.length < 16 || token.length > 128) return null;
  return token;
}

export function sanitizeSerialNumber(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_SERIAL_LENGTH) return null;
  if (/[\x00-\x1f<>"]/.test(trimmed)) return null;
  return trimmed;
}

export function sanitizeScriptVersion(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().slice(0, 32);
  if (!trimmed || !/^\d+(\.\d+){0,3}$/.test(trimmed)) return null;
  return trimmed;
}

export function validateTimezone(value: string): boolean {
  if (!value || value.length > MAX_TIMEZONE_LENGTH) return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export function validateSsids(ssids: string[]): string[] | null {
  if (!Array.isArray(ssids) || ssids.length === 0 || ssids.length > 20) return null;
  const normalized: string[] = [];
  for (const ssid of ssids) {
    const clean = sanitizeSsid(ssid);
    if (!clean) return null;
    normalized.push(clean);
  }
  return [...new Set(normalized)];
}
