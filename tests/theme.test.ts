import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  isTheme,
  readStoredTheme,
  resolveClientTheme,
  THEME_STORAGE_KEY,
} from "@/lib/theme";

function installMemoryLocalStorage() {
  const store = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
  });
}

describe("isTheme", () => {
  it("accepts light and dark only", () => {
    expect(isTheme("light")).toBe(true);
    expect(isTheme("dark")).toBe(true);
    expect(isTheme("system")).toBe(false);
    expect(isTheme(null)).toBe(false);
    expect(isTheme(undefined)).toBe(false);
  });
});

describe("readStoredTheme / resolveClientTheme", () => {
  beforeEach(() => {
    installMemoryLocalStorage();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reads an explicit light preference from localStorage", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "light");
    expect(readStoredTheme()).toBe("light");
  });

  it("returns null when nothing is stored", () => {
    expect(readStoredTheme()).toBeNull();
  });

  it("prefers localStorage over system preference", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "light");
    vi.stubGlobal("window", {
      matchMedia: vi.fn().mockReturnValue({ matches: false }),
    });
    expect(resolveClientTheme()).toBe("light");
  });

  it("falls back to system preference when storage is empty", () => {
    vi.stubGlobal("window", {
      matchMedia: vi.fn().mockReturnValue({ matches: true }),
    });
    expect(resolveClientTheme()).toBe("light");
  });

  it("defaults to dark when nothing else is available", () => {
    vi.stubGlobal("window", {
      matchMedia: vi.fn().mockReturnValue({ matches: false }),
    });
    expect(resolveClientTheme()).toBe("dark");
  });
});
