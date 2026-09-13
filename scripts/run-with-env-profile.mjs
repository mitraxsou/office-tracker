/**
 * Run a command with OFFICETRACKER_ENV_PROFILE set (cross-platform).
 *
 *   node scripts/run-with-env-profile.mjs prod -- node scripts/ensure-postgres-env.mjs -- next dev
 */

import { spawnSync } from "child_process";

const args = process.argv.slice(2);
const dashDash = args.indexOf("--");
if (dashDash < 1 || dashDash >= args.length - 1) {
  console.error("Usage: node scripts/run-with-env-profile.mjs <dev|prod> -- <command> [args...]");
  process.exit(1);
}

const profileRaw = args[0].trim().toLowerCase();
const profile = profileRaw === "prod" || profileRaw === "production" ? "prod" : "dev";
const childArgv = args.slice(dashDash + 1);
const [command, ...commandArgs] = childArgv;

const env = { ...process.env, OFFICETRACKER_ENV_PROFILE: profile };
const result = spawnSync(command, commandArgs, {
  stdio: "inherit",
  env,
  shell: process.platform === "win32",
});

process.exit(result.status ?? 1);
