import { describe, expect, it } from "vitest";
import {
  firstNameFromSession,
  formatWelcomeGreeting,
  greetingPeriodForHour,
  greetingPhraseForPeriod,
  hourInTimezone,
  welcomeGreetingForDate,
  welcomeStatusLine,
} from "@/lib/welcome-greeting";

describe("greetingPeriodForHour", () => {
  it("maps morning hours 5-11", () => {
    expect(greetingPeriodForHour(5)).toBe("morning");
    expect(greetingPeriodForHour(8)).toBe("morning");
    expect(greetingPeriodForHour(11)).toBe("morning");
  });

  it("maps afternoon hours 12-16", () => {
    expect(greetingPeriodForHour(12)).toBe("afternoon");
    expect(greetingPeriodForHour(14)).toBe("afternoon");
    expect(greetingPeriodForHour(16)).toBe("afternoon");
  });

  it("maps evening hours 17-21", () => {
    expect(greetingPeriodForHour(17)).toBe("evening");
    expect(greetingPeriodForHour(19)).toBe("evening");
    expect(greetingPeriodForHour(21)).toBe("evening");
  });

  it("maps night owl hours 22-4", () => {
    expect(greetingPeriodForHour(22)).toBe("night_owl");
    expect(greetingPeriodForHour(23)).toBe("night_owl");
    expect(greetingPeriodForHour(0)).toBe("night_owl");
    expect(greetingPeriodForHour(4)).toBe("night_owl");
  });

  it("normalizes out-of-range hours", () => {
    expect(greetingPeriodForHour(25)).toBe("night_owl"); // 1
    expect(greetingPeriodForHour(-1)).toBe("night_owl"); // 23
  });
});

describe("greetingPhraseForPeriod", () => {
  it("uses direct casual copy", () => {
    expect(greetingPhraseForPeriod("morning")).toBe("Good morning");
    expect(greetingPhraseForPeriod("afternoon")).toBe("Good afternoon");
    expect(greetingPhraseForPeriod("evening")).toBe("Good evening");
    expect(greetingPhraseForPeriod("night_owl")).toBe("Night owl");
  });
});

describe("firstNameFromSession", () => {
  it("takes the first token of a full name", () => {
    expect(firstNameFromSession("Soumitra Mandal", "soumitro@pwc.com")).toBe("Soumitra");
  });

  it("title-cases a single profile name", () => {
    expect(firstNameFromSession("soumitro", "other@pwc.com")).toBe("Soumitro");
  });

  it("falls back to email local-part when name is missing", () => {
    expect(firstNameFromSession(null, "soumitro.mandal@pwc.com")).toBe("Soumitro");
    expect(firstNameFromSession("", "jane_doe@pwc.com")).toBe("Jane");
  });

  it("falls back when name equals email", () => {
    expect(firstNameFromSession("soumitro@pwc.com", "soumitro@pwc.com")).toBe("Soumitro");
  });

  it("prefers preferredName over legal account name", () => {
    const preferred = "Soumitra";
    const legal = "Soumitro Mandal";
    expect(firstNameFromSession(preferred ?? legal, "soumitro@pwc.com")).toBe("Soumitra");
  });

  it("uses legal name when preferredName is null", () => {
    const preferred: string | null = null;
    const legal = "Soumitro Mandal";
    expect(firstNameFromSession(preferred ?? legal, "soumitro@pwc.com")).toBe("Soumitro");
  });
});

describe("formatWelcomeGreeting", () => {
  it("joins phrase and name", () => {
    expect(formatWelcomeGreeting("evening", "Soumitra")).toBe("Good evening, Soumitra");
    expect(formatWelcomeGreeting("night_owl", "Soumitra")).toBe("Night owl, Soumitra");
  });
});

describe("hourInTimezone + welcomeGreetingForDate", () => {
  const tz = "Asia/Kolkata";

  it("reads wall-clock hour in Asia/Kolkata", () => {
    // 2026-09-23 20:05 IST
    const evening = new Date("2026-09-23T20:05:00+05:30");
    expect(hourInTimezone(evening, tz)).toBe(20);
    expect(welcomeGreetingForDate(evening, tz, "Soumitra")).toBe("Good evening, Soumitra");
  });

  it("uses night owl late at night", () => {
    const late = new Date("2026-09-23T23:30:00+05:30");
    expect(welcomeGreetingForDate(late, tz, "Soumitra")).toBe("Night owl, Soumitra");
  });

  it("uses morning after 5am", () => {
    const morning = new Date("2026-09-23T07:15:00+05:30");
    expect(welcomeGreetingForDate(morning, tz, "Soumitra")).toBe("Good morning, Soumitra");
  });
});

describe("welcomeStatusLine", () => {
  const base = {
    period: "morning" as const,
    totalHours: 0,
    targetHours: 5,
    metTarget: false,
    inOfficeNow: false,
    outOfOfficeToday: false,
  };

  it("marks out of office today", () => {
    expect(
      welcomeStatusLine({ ...base, outOfOfficeToday: true, totalHours: 2 }),
    ).toBe("Marked out of office today.");
  });

  it("reports target met", () => {
    expect(
      welcomeStatusLine({
        ...base,
        totalHours: 8,
        targetHours: 5,
        metTarget: true,
      }),
    ).toBe("8.0h logged today. Target met.");
  });

  it("reports in-office progress", () => {
    expect(
      welcomeStatusLine({
        ...base,
        totalHours: 2.1,
        targetHours: 5,
        inOfficeNow: true,
      }),
    ).toBe("2.1h so far. 2.9h to go.");
  });

  it("reports partial hours when not in office", () => {
    expect(
      welcomeStatusLine({
        ...base,
        totalHours: 2.1,
        targetHours: 5,
        inOfficeNow: false,
      }),
    ).toBe("2.1h logged today. 2.9h short.");
  });

  it("reports zero hours", () => {
    expect(welcomeStatusLine(base)).toBe("No office time logged yet today.");
  });

  it("overrides lead-in with Still going for night owl", () => {
    expect(
      welcomeStatusLine({
        ...base,
        period: "night_owl",
        totalHours: 2.1,
        targetHours: 5,
        inOfficeNow: true,
      }),
    ).toBe("Still going. 2.9h to go.");

    expect(
      welcomeStatusLine({
        ...base,
        period: "night_owl",
        totalHours: 2.1,
        targetHours: 5,
        inOfficeNow: false,
      }),
    ).toBe("Still going. 2.9h short.");

    expect(
      welcomeStatusLine({
        ...base,
        period: "night_owl",
        totalHours: 8,
        targetHours: 5,
        metTarget: true,
      }),
    ).toBe("Still going. Target met.");
  });
});
