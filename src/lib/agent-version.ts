import { readFileSync } from "fs";
import path from "path";

let cachedVersion: string | null = null;

/** Agent script bundle version (agent/version.txt). Bump when agent/*.ps1 change. */
export function getAgentVersion(): string {
  if (cachedVersion) return cachedVersion;
  const versionPath = path.join(process.cwd(), "agent", "version.txt");
  cachedVersion = readFileSync(versionPath, "utf8").trim();
  return cachedVersion;
}

export function compareAgentVersions(a: string, b: string): number {
  const parse = (v: string) =>
    v
      .trim()
      .split(".")
      .map((part) => parseInt(part, 10) || 0);
  const av = parse(a);
  const bv = parse(b);
  const len = Math.max(av.length, bv.length);
  for (let i = 0; i < len; i++) {
    const diff = (av[i] ?? 0) - (bv[i] ?? 0);
    if (diff !== 0) return diff > 0 ? 1 : -1;
  }
  return 0;
}
