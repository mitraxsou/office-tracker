"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  filterGlobalSearch,
  groupSearchResults,
  type GlobalSearchEntry,
} from "@/lib/global-search";

type GlobalSearchProps = {
  isAdmin: boolean;
  /** Icon-only trigger for narrow headers (mobile nav). */
  compact?: boolean;
};

function SearchIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

export function GlobalSearch({ isAdmin, compact = false }: GlobalSearchProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const results = useMemo(
    () => filterGlobalSearch(query, { isAdmin, limit: 24 }),
    [query, isAdmin],
  );
  const groupedResults = useMemo(() => groupSearchResults(results), [results]);
  const flatResults = results;

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setActiveIndex(0);
  }, []);

  const navigateTo = useCallback(
    (entry: GlobalSearchEntry) => {
      close();
      router.push(entry.href);
    },
    [close, router],
  );

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const modifier = event.metaKey || event.ctrlKey;
      if (modifier && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
        return;
      }

      if (!open) return;

      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }

      if (flatResults.length === 0) return;

      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((index) => (index + 1) % flatResults.length);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((index) => (index - 1 + flatResults.length) % flatResults.length);
      } else if (event.key === "Enter") {
        event.preventDefault();
        const entry = flatResults[activeIndex];
        if (entry) navigateTo(entry);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, flatResults, activeIndex, close, navigateTo]);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (isEditableTarget(event.target)) return;
      if (event.key === "/") {
        event.preventDefault();
        setOpen(true);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  let runningIndex = -1;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`btn-secondary inline-flex items-center gap-2 text-sm ${
          compact
            ? "min-h-11 min-w-11 justify-center p-2"
            : "min-h-11 px-3 py-2 md:min-h-0"
        }`}
        aria-label="Open search (Ctrl+K)"
      >
        <SearchIcon />
        {!compact && (
          <>
            <span className="hidden md:inline">Search</span>
            <kbd className="hidden rounded border border-[var(--border)] px-1.5 py-0.5 text-[10px] text-muted lg:inline">
              Ctrl K
            </kbd>
          </>
        )}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[70] flex items-start justify-center bg-black/60 p-4 pt-[12vh]"
          onClick={close}
          role="presentation"
        >
          <div
            className="card w-full max-w-xl overflow-hidden p-0 shadow-xl"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Search Office Pulse"
          >
            <div className="flex items-center gap-3 border-b border-[var(--border)] px-4 py-3">
              <SearchIcon />
              <input
                ref={inputRef}
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search pages, settings, help, actions..."
                className="w-full border-0 bg-transparent px-0 py-1 text-sm outline-none"
                aria-label="Search query"
                autoComplete="off"
              />
              <kbd className="hidden rounded border border-[var(--border)] px-1.5 py-0.5 text-[10px] text-muted sm:inline">
                Esc
              </kbd>
            </div>

            <div className="max-h-[min(60vh,28rem)] overflow-y-auto p-2">
              {flatResults.length === 0 ? (
                <p className="px-3 py-6 text-sm text-muted">No matches. Try another keyword.</p>
              ) : (
                groupedResults.map((group) => (
                  <div key={group.group} className="mb-2 last:mb-0">
                    <p className="px-3 py-1 text-xs font-medium uppercase tracking-wide text-muted">
                      {group.label}
                    </p>
                    <ul>
                      {group.entries.map((entry) => {
                        runningIndex += 1;
                        const index = runningIndex;
                        const isActive = index === activeIndex;
                        return (
                          <li key={entry.id}>
                            <button
                              type="button"
                              onMouseEnter={() => setActiveIndex(index)}
                              onClick={() => navigateTo(entry)}
                              className={`flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left text-sm ${
                                isActive
                                  ? "bg-[var(--pwc-orange-muted)] text-[var(--foreground)]"
                                  : "hover:bg-[var(--border)]/40"
                              }`}
                            >
                              <span className="min-w-0 flex-1">
                                <span className="block font-medium">{entry.label}</span>
                                {entry.description && (
                                  <span className="mt-0.5 block text-xs text-muted">
                                    {entry.description}
                                  </span>
                                )}
                              </span>
                              {entry.adminOnly && (
                                <span className="shrink-0 rounded bg-[var(--border)]/60 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted">
                                  Admin
                                </span>
                              )}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))
              )}
            </div>

            <div className="border-t border-[var(--border)] px-4 py-2 text-xs text-muted">
              <span className="hidden sm:inline">Navigate with arrows. Enter to open. </span>
              Ctrl K to open search.
            </div>
          </div>
        </div>
      )}
    </>
  );
}
