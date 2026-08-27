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

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ensureScript = resolve(repoRoot, "scripts/ensure-postgres-env.mjs");

function isDeployDbSetupEnabled() {
  return process.env.RUN_DB_SETUP_ON_DEPLOY?.trim().toLowerCase() === "true";
}

function runEnsurePostgres(childArgv) {
  const result = spawnSync("node", [ensureScript, "--", ...childArgv], {
    stdio: "inherit",
    env: process.env,
    cwd: repoRoot,
    shell: true,
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

runEnsurePostgres(["prisma", "db", "push"]);
runEnsurePostgres(["tsx", "prisma/seed.ts"]);

console.log("");
console.log("Deploy DB setup complete (schema pushed, seed ran).");
console.log("Unset RUN_DB_SETUP_ON_DEPLOY in Vercel after verifying login.");
console.log("");
