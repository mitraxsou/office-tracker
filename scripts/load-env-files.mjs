/**
 * Loads .env, .env.local, and .env.vercel.local from the repo root.
 * Later files override earlier ones (vercel pull output wins).
 */

import { config } from "dotenv";
import { existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const ENV_FILES = [".env", ".env.local", ".env.vercel.local"];

export function loadEnvFiles() {
  const loaded = [];
  for (const file of ENV_FILES) {
    const path = resolve(repoRoot, file);
    if (!existsSync(path)) continue;
    config({ path, override: true });
    loaded.push(file);
  }
  return loaded;
}

export { repoRoot, ENV_FILES };
