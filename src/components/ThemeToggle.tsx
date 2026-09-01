"use client";

import { useEffect, useState } from "react";
import {
  applyTheme,
  isTheme,
  readThemeFromDocument,
  THEME_STORAGE_KEY,
  type Theme,
} from "@/lib/theme";

function SunIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

type ThemeToggleProps = {
  className?: string;
};

export function ThemeToggle({ className = "" }: ThemeToggleProps) {
  const [theme, setTheme] = useState<Theme>("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setTheme(readThemeFromDocument());
    setMounted(true);
  }, []);

  function setAndPersist(next: Theme) {
    setTheme(next);
    applyTheme(next);
    localStorage.setItem(THEME_STORAGE_KEY, next);
  }

  function toggle() {
    setAndPersist(theme === "dark" ? "light" : "dark");
  }

  const label = theme === "dark" ? "Switch to light mode" : "Switch to dark mode";

  return (
    <button
      type="button"
      onClick={toggle}
      className={`btn-secondary inline-flex items-center justify-center p-2 ${className}`}
      aria-label={label}
      title={label}
      disabled={!mounted}
    >
      {mounted && theme === "dark" ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}

type ThemePreferenceProps = {
  className?: string;
};

export function ThemePreference({ className = "" }: ThemePreferenceProps) {
  const [theme, setTheme] = useState<Theme>("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setTheme(readThemeFromDocument());
    setMounted(true);
  }, []);

  function select(next: Theme) {
    setTheme(next);
    applyTheme(next);
    localStorage.setItem(THEME_STORAGE_KEY, next);
  }

  return (
    <section className={`card p-6 ${className}`}>
      <h2 className="text-lg font-semibold">Appearance</h2>
      <p className="mt-1 text-sm text-muted">
        Choose light or dark mode. Your choice is saved on this browser.
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        {(["light", "dark"] as Theme[]).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => select(option)}
            disabled={!mounted}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              mounted && theme === option
                ? "bg-[var(--pwc-orange)] text-white"
                : "btn-secondary"
            }`}
          >
            {option === "light" ? "Light" : "Dark"}
          </button>
        ))}
      </div>
    </section>
  );
}

export function useTheme(): Theme {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    setTheme(readThemeFromDocument());

    function onStorage(event: StorageEvent) {
      if (event.key === THEME_STORAGE_KEY && isTheme(event.newValue)) {
        applyTheme(event.newValue);
        setTheme(event.newValue);
      }
    }

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return theme;
}
