/**
 * Seeds demo users on the dev Neon database (office-tracker-dev).
 *
 * Usage:
 *   npm run seed:demo:dev
 */

import { spawnSync } from "child_process";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const devUrl = "https://office-tracker-dev.vercel.app";

if (!process.env.POSTGRES_PRISMA_URL) {
  console.error("POSTGRES_PRISMA_URL is not set. Run npm run env:pull:dev first.");
  process.exit(1);
}

console.log("Seeding demo users against dev Neon...");
console.log("Portal URL:", process.env.REGRESSION_API_URL ?? devUrl);

const result = spawnSync(
  "npm",
  ["run", "prisma:env", "--", "tsx", "scripts/regression/seed-demo-users.ts"],
  {
    cwd: repoRoot,
    stdio: "inherit",
    env: {
      ...process.env,
      REGRESSION_API_URL: process.env.REGRESSION_API_URL ?? devUrl,
    },
    shell: process.platform === "win32",
  },
);

process.exit(result.status ?? 1);
