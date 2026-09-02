"use client";

import { useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";

type SearchResult = {
  id: string;
  email: string;
  name: string | null;
};

const SEARCH_DELAY_MS = 250;

export function AdminUserReportSearch({ currentUserId }: { currentUserId: string }) {
  const router = useRouter();
  const listId = useId();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setActiveIndex(-1);
      setOpen(false);
      setSearching(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearching(true);
      try {
        const params = new URLSearchParams({
          search: trimmed,
          pageSize: "8",
        });
        const response = await fetch(`/api/admin/users?${params}`, {
          signal: controller.signal,
        });
        if (!response.ok) {
          setResults([]);
          return;
        }
        const data = await response.json();
        const matches = ((data.users ?? []) as SearchResult[]).filter(
          (user) => user.id !== currentUserId,
        );
        setResults(matches);
        setActiveIndex(matches.length > 0 ? 0 : -1);
        setOpen(true);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setResults([]);
        }
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, SEARCH_DELAY_MS);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [currentUserId, query]);

  function selectUser(user: SearchResult) {
    setQuery("");
    setOpen(false);
    router.push(`/admin/reports/users/${user.id}`);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || results.length === 0) {
      if (event.key === "Escape") setOpen(false);
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % results.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => (index <= 0 ? results.length - 1 : index - 1));
    } else if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      selectUser(results[activeIndex]);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="relative w-full sm:max-w-sm">
      <label htmlFor={`${listId}-input`} className="mb-1 block text-xs text-muted">
        Search another user
      </label>
      <input
        id={`${listId}-input`}
        type="search"
        role="combobox"
        aria-autocomplete="list"
        aria-controls={listId}
        aria-expanded={open}
        aria-activedescendant={
          open && activeIndex >= 0 ? `${listId}-option-${activeIndex}` : undefined
        }
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        onKeyDown={handleKeyDown}
        placeholder="Type name or email"
        className="w-full rounded-lg border px-3 py-2 text-sm"
      />
      {searching && <span className="absolute right-3 top-8 text-xs text-muted">Searching...</span>}
      {open && (
        <div
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--card)] p-1 shadow-xl"
        >
          {results.length === 0 ? (
            <p className="px-3 py-2 text-sm text-muted">No other users found.</p>
          ) : (
            results.map((user, index) => (
              <button
                key={user.id}
                id={`${listId}-option-${index}`}
                type="button"
                role="option"
                aria-selected={index === activeIndex}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => selectUser(user)}
                className={`block w-full rounded-md px-3 py-2 text-left text-sm ${
                  index === activeIndex ? "bg-[var(--pwc-orange-muted)]" : "hover:bg-white/5"
                }`}
              >
                <span className="block font-medium">{user.email}</span>
                {user.name && <span className="block text-xs text-muted">{user.name}</span>}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
