/**
 * Loads env files, maps Vercel Storage Postgres vars for Prisma, and optionally
 * runs a child command with the resolved env (so prisma db push / seed see them).
 */

import { spawnSync } from "child_process";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { loadEnvFiles } from "./load-env-files.mjs";
import {
  applyPrismaGenerateEnv,
  hasPostgresEnv,
  resolvePostgresEnv,
} from "./resolve-postgres-env.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const generateOnly =
  args.includes("--generate-only") || process.env.PRISMA_GENERATE_ONLY === "1";
const dashDash = args.indexOf("--");
const childArgv = dashDash >= 0 ? args.slice(dashDash + 1) : [];

const loadedFiles = loadEnvFiles();
resolvePostgresEnv();

if (generateOnly) {
  // Generate does not connect to the DB. Always use placeholders so postinstall/build
  // succeed on Vercel even when Storage vars are missing during install or partial.
  applyPrismaGenerateEnv();
} else {
  const { prismaUrl, directUrl } = resolvePostgresEnv();

  if (!prismaUrl || !directUrl || !hasPostgresEnv()) {
    console.error("");
    console.error("Missing Postgres connection env vars for Prisma.");
    if (loadedFiles.length === 0) {
      console.error("  No .env, .env.local, or .env.vercel.local found in project root.");
    } else {
      console.error(`  Loaded: ${loadedFiles.join(", ")} — but POSTGRES_* / DATABASE_URL not set.`);
    }
    console.error("");
    console.error("Do not run raw `npx prisma db push` — Prisma only loads .env, not .env.vercel.local.");
    console.error("Use: npm run db:push   or   node scripts/prisma-with-env.mjs db push");
    console.error("");
    console.error("Fix (manual copy — no Vercel CLI):");
    console.error("  1. Vercel → Storage → Postgres → .env.local tab");
    console.error("     Copy POSTGRES_PRISMA_URL and POSTGRES_URL_NON_POOLING");
    console.error("  2. Paste into .env.vercel.local (see .env.vercel.local.example)");
    console.error("  3. Run: .\\scripts\\setup-prod-db.ps1   or   npm run db:push");
    console.error("");
    console.error("Or fix Vercel CLI pull:");
    console.error("  Remove-Item Env:VERCEL_TOKEN -ErrorAction SilentlyContinue");
    console.error("  npx vercel env pull .env.vercel.local");
    console.error("");
    process.exit(1);
  }

  if (process.env.DEBUG_POSTGRES_ENV === "1") {
    console.log(`Postgres env OK (from: ${loadedFiles.join(", ") || "process env"})`);
  }
}

if (childArgv.length > 0) {
  const result = spawnSync("npx", childArgv, {
    stdio: "inherit",
    env: process.env,
    cwd: repoRoot,
    shell: process.platform === "win32",
  });
  process.exit(result.status ?? 1);
}
