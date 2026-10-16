import { readFileSync, readdirSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

/** Em dash U+2014 or en dash U+2013. */
const FORBIDDEN_DASHES = /\u2014|\u2013/;

const SCAN_ROOTS = ["src", "agent", "tests", ".cursor/skills", "docs", "scripts"] as const;
const SCAN_EXTS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".ps1",
  ".vbs",
  ".md",
  ".json",
  ".txt",
  ".css",
]);
const SKIP_DIR_NAMES = new Set(["node_modules", ".git", "dist", ".next", "tmp-neon"]);

function shouldSkipDir(name: string): boolean {
  return SKIP_DIR_NAMES.has(name) || name.startsWith("tmp-");
}

function shouldSkipFile(rel: string): boolean {
  // This file (and BUG-017) must mention the code points via escapes only.
  if (rel.replace(/\\/g, "/").includes("BUG-029-no-em-dash-in-repo.test.ts")) {
    return true;
  }
  return false;
}

function listFiles(dir: string, out: string[] = []): string[] {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!shouldSkipDir(entry.name)) listFiles(full, out);
      continue;
    }
    if (!SCAN_EXTS.has(path.extname(entry.name))) continue;
    if (shouldSkipDir(entry.name)) continue;
    out.push(full);
  }
  return out;
}

describe("BUG-029 no em dash or en dash in scanned repo paths", () => {
  it("forbids U+2014 and U+2013 in src, agent, tests, skills, docs, and scripts", () => {
    const offenders: string[] = [];
    for (const root of SCAN_ROOTS) {
      const absRoot = path.join(process.cwd(), root);
      for (const file of listFiles(absRoot)) {
        const rel = path.relative(process.cwd(), file);
        if (shouldSkipFile(rel)) continue;
        const content = readFileSync(file, "utf8");
        if (FORBIDDEN_DASHES.test(content)) {
          offenders.push(rel.replace(/\\/g, "/"));
        }
      }
    }
    // Also scan top-level README.
    const readme = path.join(process.cwd(), "README.md");
    try {
      if (FORBIDDEN_DASHES.test(readFileSync(readme, "utf8"))) {
        offenders.push("README.md");
      }
    } catch {
      // optional
    }

    expect(
      offenders,
      `Replace em/en dashes with ASCII '-' in:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });

  it("keeps the update banner on ASCII hyphen punctuation", () => {
    const banner = readFileSync(
      path.join(process.cwd(), "src/components/AgentVersionUpdateBanner.tsx"),
      "utf8",
    );
    expect(banner).toContain("update required - install");
    expect(banner).not.toMatch(FORBIDDEN_DASHES);
  });
});
