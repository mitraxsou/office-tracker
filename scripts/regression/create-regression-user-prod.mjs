/**
 * Creates the regression dummy user on the production (theta) Neon database.
 *
 * WARNING: This writes to whatever database POSTGRES_PRISMA_URL points at.
 * Set POSTGRES_PRISMA_URL to the production Neon URL from Vercel (office-tracker
 * project, production environment) before running.
 *
 * Usage:
 *   $env:CONFIRM_PROD="yes"; npm run regression:create-prod
 */

import { spawnSync } from "child_process";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const thetaUrl = "https://office-tracker-theta.vercel.app";

if (process.env.CONFIRM_PROD !== "yes") {
  console.error("");
  console.error("*** PRODUCTION REGRESSION USER SETUP ***");
  console.error("");
  console.error("This script creates regression.dummy@office-tracker.test in the database");
  console.error("behind POSTGRES_PRISMA_URL. It does NOT run automatically on deploy.");
  console.error("");
  console.error("Before continuing:");
  console.error("  1. Set POSTGRES_PRISMA_URL to the production Neon URL (Vercel office-tracker prod).");
  console.error("  2. Confirm theta is the target portal:", thetaUrl);
  console.error("");
  console.error("Re-run with CONFIRM_PROD=yes to proceed:");
  console.error("  $env:CONFIRM_PROD=\"yes\"; npm run regression:create-prod");
  console.error("");
  process.exit(1);
}

if (!process.env.POSTGRES_PRISMA_URL) {
  console.error("POSTGRES_PRISMA_URL is not set. Point it at production Neon first.");
  process.exit(1);
}

console.warn("");
console.warn("Creating regression user against:", process.env.POSTGRES_PRISMA_URL.replace(/:[^:@/]+@/, ":***@"));
console.warn("Portal URL:", process.env.REGRESSION_API_URL ?? thetaUrl);
console.warn("");

const result = spawnSync(
  "npm",
  ["run", "prisma:env", "--", "tsx", "scripts/regression/create-regression-user.ts"],
  {
    cwd: repoRoot,
    stdio: "inherit",
    env: {
      ...process.env,
      REGRESSION_API_URL: process.env.REGRESSION_API_URL ?? thetaUrl,
    },
    shell: process.platform === "win32",
  },
);

process.exit(result.status ?? 1);
