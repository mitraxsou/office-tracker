/**
 * Optional Vercel build step: push Prisma schema and seed Neon when
 * RUN_DB_SETUP_ON_DEPLOY=true. Vercel build env can reach Postgres; local
 * laptops behind PwC firewall often cannot (P1001 on port 5432).
 *
 * Normal deploys leave RUN_DB_SETUP_ON_DEPLOY unset and this script exits 0.
 */

import { spawnSync } from "child_process";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import {
  formatMissingPostgresEnvError,
  preparePostgresEnvForPush,
} from "./resolve-postgres-env.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function isDeployDbSetupEnabled() {
  return process.env.RUN_DB_SETUP_ON_DEPLOY?.trim().toLowerCase() === "true";
}

function runNpx(childArgv) {
  const result = spawnSync("npx", childArgv, {
    stdio: "inherit",
    env: process.env,
    cwd: repoRoot,
    shell: process.platform === "win32",
  });
  if ((result.status ?? 1) !== 0) {
    process.exit(result.status ?? 1);
  }
}

if (!isDeployDbSetupEnabled()) {
  process.exit(0);
}

console.log("");
console.log("RUN_DB_SETUP_ON_DEPLOY=true — running prisma db push and seed on deploy...");
console.log("");

const prepared = preparePostgresEnvForPush();
if (!prepared.ok) {
  console.error(formatMissingPostgresEnvError());
  process.exit(1);
}

if (process.env.DEBUG_POSTGRES_ENV === "1") {
  console.log(`Postgres env keys: ${prepared.relatedKeys.join(", ") || "(resolved)"}`);
}

runNpx(["prisma", "db", "push", "--accept-data-loss", "--skip-generate"]);
runNpx(["tsx", "prisma/seed.ts"]);

console.log("");
console.log("Deploy DB setup complete (schema pushed, seed ran).");
console.log("Unset RUN_DB_SETUP_ON_DEPLOY in Vercel after verifying login.");
console.log("");
