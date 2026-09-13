/**
 * Seeds demo users on the production (theta) Neon database.
 *
 * Usage:
 *   $env:CONFIRM_PROD="yes"; npm run seed:demo:prod
 */

import { spawnSync } from "child_process";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const thetaUrl = "https://office-tracker-theta.vercel.app";

if (process.env.CONFIRM_PROD !== "yes") {
  console.error("");
  console.error("*** PRODUCTION DEMO USER SETUP ***");
  console.error("");
  console.error("This writes demo users to POSTGRES_PRISMA_URL (production Neon).");
  console.error("Portal:", thetaUrl);
  console.error("");
  console.error("Re-run with CONFIRM_PROD=yes:");
  console.error("  $env:CONFIRM_PROD=\"yes\"; npm run seed:demo:prod");
  console.error("");
  process.exit(1);
}

if (!process.env.POSTGRES_PRISMA_URL) {
  console.error("POSTGRES_PRISMA_URL is not set. Point it at production Neon first.");
  process.exit(1);
}

console.warn("Seeding demo users against production Neon...");

const result = spawnSync(
  "npm",
  ["run", "prisma:env", "--", "tsx", "scripts/regression/seed-demo-users.ts"],
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
