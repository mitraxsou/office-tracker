/**
 * Loads env files from the repo root based on OFFICETRACKER_ENV_PROFILE.
 *
 * dev (default):  .env, .env.local, .env.vercel.dev.local
 * prod:           .env, .env.local, .env.vercel.local, .env.vercel.prod.local
 *
 * Later files override earlier ones. On Vercel (VERCEL=1), skips file loading.
 */

import { parse } from "dotenv";
import { existsSync, readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const PROFILE_FILES = {
  dev: [".env", ".env.local", ".env.vercel.dev.local"],
  prod: [".env", ".env.local", ".env.vercel.local", ".env.vercel.prod.local"],
};

export function getEnvProfile() {
  const raw = (process.env.OFFICETRACKER_ENV_PROFILE || "dev").trim().toLowerCase();
  if (raw === "prod" || raw === "production") return "prod";
  return "dev";
}

export function getEnvFilesForProfile(profile = getEnvProfile()) {
  return PROFILE_FILES[profile] ?? PROFILE_FILES.dev;
}

/** Default dev profile file list (backwards compatible export). */
export const ENV_FILES = PROFILE_FILES.dev;

export function loadEnvFiles() {
  if (process.env.VERCEL === "1") {
    return [];
  }

  const files = getEnvFilesForProfile();
  const loaded = [];
  for (const file of files) {
    const path = resolve(repoRoot, file);
    if (!existsSync(path)) continue;
    // Later files override earlier ones, but empty values from Vercel pulls should
    // not wipe secrets already set in .env.local (e.g. POWER_AUTOMATE_WEBHOOK_SECRET).
    const parsed = parse(readFileSync(path));
    for (const [key, value] of Object.entries(parsed)) {
      if (value === "" && process.env[key]) continue;
      process.env[key] = value;
    }
    loaded.push(file);
  }
  return loaded;
}

export { repoRoot };
