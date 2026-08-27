/**
 * Loads env files, maps Vercel Storage Postgres vars for Prisma, and optionally
 * runs a child command with the resolved env (so prisma db push / seed see them).
 */

import { spawnSync } from "child_process";
import { loadEnvFiles } from "./load-env-files.mjs";
import { hasPostgresEnv, resolvePostgresEnv } from "./resolve-postgres-env.mjs";

const args = process.argv.slice(2);
const generateOnly =
  args.includes("--generate-only") || process.env.PRISMA_GENERATE_ONLY === "1";
const dashDash = args.indexOf("--");
const childArgv = dashDash >= 0 ? args.slice(dashDash + 1) : [];

const loadedFiles = loadEnvFiles();
resolvePostgresEnv();

if (generateOnly && !hasPostgresEnv()) {
  const placeholder = "postgresql://build:build@localhost:5432/build?schema=public";
  process.env.POSTGRES_PRISMA_URL = placeholder;
  process.env.POSTGRES_URL_NON_POOLING = placeholder;
}

if (!generateOnly) {
  const { prismaUrl, directUrl } = resolvePostgresEnv();

  if (!prismaUrl || !directUrl) {
    console.error("");
    console.error("Missing Postgres connection env vars for Prisma.");
    if (loadedFiles.length === 0) {
      console.error("  No .env, .env.local, or .env.vercel.local found in project root.");
    } else {
      console.error(`  Loaded: ${loadedFiles.join(", ")} — but POSTGRES_* / DATABASE_URL not set.`);
    }
    console.error("");
    console.error("Fix (manual copy — no Vercel CLI):");
    console.error("  1. Vercel → Storage → Postgres → .env.local tab");
    console.error("     Copy POSTGRES_PRISMA_URL and POSTGRES_URL_NON_POOLING");
    console.error("  2. Paste into .env.vercel.local (see .env.vercel.local.example)");
    console.error("  3. Run: .\\scripts\\setup-prod-db.ps1");
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
  const [command, ...commandArgs] = childArgv;
  const result = spawnSync(command, commandArgs, {
    stdio: "inherit",
    env: process.env,
    shell: true,
  });
  process.exit(result.status ?? 1);
}
