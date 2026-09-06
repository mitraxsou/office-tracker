import { describe, expect, it } from "vitest";
import {
  validatePrivacySections,
  validateTermsSections,
} from "../src/lib/legal-config";

describe("validateTermsSections", () => {
  it("accepts non-empty title and body sections", () => {
    const sections = validateTermsSections([
      { title: "Acceptance", body: "By using the app you agree." },
    ]);
    expect(sections).toEqual([{ title: "Acceptance", body: "By using the app you agree." }]);
  });

  it("rejects empty sections", () => {
    expect(validateTermsSections([])).toBeNull();
    expect(validateTermsSections([{ title: "", body: "x" }])).toBeNull();
    expect(validateTermsSections([{ title: "x", body: "   " }])).toBeNull();
  });
});

describe("validatePrivacySections", () => {
  it("accepts sections with bullet items", () => {
    const sections = validatePrivacySections([
      { title: "What we collect", items: ["Email", "SSID"] },
    ]);
    expect(sections).toEqual([{ title: "What we collect", items: ["Email", "SSID"] }]);
  });

  it("rejects empty items", () => {
    expect(validatePrivacySections([{ title: "Data", items: [] }])).toBeNull();
    expect(validatePrivacySections([{ title: "Data", items: [" "] }])).toBeNull();
  });
});
