import type { AppConfigData } from "./app-config";
import { getAppConfig } from "./app-config";

/** Short in-memory cache for global AppConfig reads on hot agent routes. */
const GLOBAL_CONFIG_CACHE_TTL_MS = 60 * 1000;

let globalConfigCache: { data: AppConfigData; at: number } | null = null;

export function invalidateAgentConfigCache() {
  globalConfigCache = null;
}

export async function getCachedAppConfig(): Promise<AppConfigData> {
  const now = Date.now();
  if (globalConfigCache && now - globalConfigCache.at < GLOBAL_CONFIG_CACHE_TTL_MS) {
    return globalConfigCache.data;
  }
  const data = await getAppConfig();
  globalConfigCache = { data, at: now };
  return data;
}

/** Cache-Control for agent config GET responses (agents also cache locally). */
export const AGENT_CONFIG_CACHE_CONTROL = "private, max-age=7200";
