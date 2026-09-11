import { describe, expect, it } from "vitest";
import { resolveRequestAppOrigin, sanitizeAgentApiUrl } from "@/lib/security";

describe("agent API URL tracking", () => {
  it("resolves origin from forwarded headers", () => {
    const request = new Request("https://internal/api/heartbeat", {
      headers: {
        "x-forwarded-host": "office-tracker-prod.vercel.app",
        "x-forwarded-proto": "https",
      },
    });
    expect(resolveRequestAppOrigin(request)).toBe("https://office-tracker-prod.vercel.app");
  });

  it("sanitizes agent-reported apiUrl", () => {
    expect(sanitizeAgentApiUrl("https://office-tracker-theta.vercel.app/")).toBe(
      "https://office-tracker-theta.vercel.app",
    );
    expect(sanitizeAgentApiUrl("not-a-url")).toBeNull();
  });
});
