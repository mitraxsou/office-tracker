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
  formatMissingPostgresEnvError,
  isVercel,
  preparePostgresEnvForPush,
} from "./resolve-postgres-env.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const generateOnly =
  args.includes("--generate-only") || process.env.PRISMA_GENERATE_ONLY === "1";
const dashDash = args.indexOf("--");
const childArgv = dashDash >= 0 ? args.slice(dashDash + 1) : [];

const loadedFiles = loadEnvFiles();

if (generateOnly) {
  // Generate does not connect to the DB. Always use placeholders so install/build
  // succeed on Vercel even when Storage vars are missing during install or partial.
  applyPrismaGenerateEnv();
} else {
  const prepared = preparePostgresEnvForPush();

  if (!prepared.ok) {
    console.error(formatMissingPostgresEnvError({ loadedFiles }));
    process.exit(1);
  }

  if (process.env.DEBUG_POSTGRES_ENV === "1") {
    const source = isVercel()
      ? "Vercel process.env"
      : loadedFiles.join(", ") || "process env";
    console.log(`Postgres env OK (from: ${source})`);
    console.log(`  Keys: ${prepared.relatedKeys.join(", ") || "(resolved from URL values)"}`);
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
