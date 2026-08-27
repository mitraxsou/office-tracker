/**
 * Run Prisma CLI with .env, .env.local, and .env.vercel.local loaded and
 * POSTGRES_* aliases resolved. Use instead of raw `npx prisma` when vars
 * live in .env.vercel.local or only DATABASE_URL / POSTGRES_URL is set.
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
