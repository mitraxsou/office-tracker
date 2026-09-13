/**
 * Run Prisma CLI with profile-based env files loaded and POSTGRES_* resolved.
 * Default profile is dev (.env.vercel.dev.local). Use OFFICETRACKER_ENV_PROFILE=prod
 * for prod files. See docs/local-env-files.md.
 *
 *   node scripts/prisma-with-env.mjs db push
 *   npm run prisma:env -- db push
 */

import { spawnSync } from "child_process";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const ensureScript = resolve(dirname(fileURLToPath(import.meta.url)), "ensure-postgres-env.mjs");
const prismaArgs = process.argv.slice(2);

if (prismaArgs.length === 0) {
  console.error("Usage: node scripts/prisma-with-env.mjs <prisma-args...>");
  console.error("Example: node scripts/prisma-with-env.mjs db push");
  process.exit(1);
}

const result = spawnSync(
  process.execPath,
  [ensureScript, "--", "prisma", ...prismaArgs],
  { stdio: "inherit", env: process.env, shell: false },
);

process.exit(result.status ?? 1);
