import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { sanitizeAgentApiUrl } from "@/lib/security";

const fixture = JSON.parse(
  readFileSync(path.join(process.cwd(), "tests/bugs/fixtures/hobby-prod-url.json"), "utf8"),
) as { hobbyProdUrl: string };

const HOBBY_PROD = "https://office-tracker-theta.vercel.app";

describe("BUG-008 Hobby prod URL office-tracker-theta", () => {
  it("fixture matches the live Hobby production host", () => {
    expect(fixture.hobbyProdUrl).toBe(HOBBY_PROD);
  });

  it("sanitizes agent-reported theta apiUrl", () => {
    expect(sanitizeAgentApiUrl(`${HOBBY_PROD}/`)).toBe(HOBBY_PROD);
  });

  it("keeps theta as the default app URL fallback in alert helpers", () => {
    const integration = readFileSync(
      path.join(process.cwd(), "src/lib/integration-alerts.ts"),
      "utf8",
    );
    const notify = readFileSync(
      path.join(process.cwd(), "src/lib/power-automate-notify.ts"),
      "utf8",
    );
    expect(integration).toContain(HOBBY_PROD);
    expect(notify).toContain(HOBBY_PROD);
  });
});
