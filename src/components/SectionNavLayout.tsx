"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type SectionNavItem = { id: string; label: string };

export type SectionHashResolution = {
  activeId: string;
  scrollToId?: string;
};

type SectionNavLayoutProps = {
  items: SectionNavItem[];
  navTitle: string;
  defaultActiveId: string;
  children: ReactNode;
  resolveHash?: (rawHash: string) => SectionHashResolution | null;
};

export function SectionNavLayout({
  items,
  navTitle,
  defaultActiveId,
  children,
  resolveHash,
}: SectionNavLayoutProps) {
  const sectionIds = useMemo(() => items.map((item) => item.id), [items]);
  const labels = useMemo(() => {
    const map: Record<string, string> = {};
    for (const item of items) {
      map[item.id] = item.label;
    }
    return map;
  }, [items]);

  const [activeId, setActiveId] = useState(defaultActiveId);
  const scrollLockRef = useRef(false);
  const scrollLockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scrollToId = useCallback((targetId: string) => {
    const el = document.getElementById(targetId);
    if (!el) return;
    window.requestAnimationFrame(() => {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, []);

  useEffect(() => {
    const applyHash = () => {
      const raw = window.location.hash.replace("#", "");
      if (resolveHash) {
        const resolved = resolveHash(raw);
        if (resolved) {
          setActiveId(resolved.activeId);
          scrollToId(resolved.scrollToId ?? resolved.activeId);
          return;
        }
      }
      if (raw && sectionIds.includes(raw)) {
        setActiveId(raw);
        scrollToId(raw);
        return;
      }
      if (!raw) {
        setActiveId(defaultActiveId);
      }
    };

    applyHash();
    window.addEventListener("hashchange", applyHash);
    return () => window.removeEventListener("hashchange", applyHash);
  }, [defaultActiveId, resolveHash, scrollToId, sectionIds]);

  useEffect(() => {
    if (sectionIds.length === 0) return;

    const visibleRatios = new Map<string, number>();

    const observer = new IntersectionObserver(
      (entries) => {
        if (scrollLockRef.current) return;
        for (const entry of entries) {
          visibleRatios.set(entry.target.id, entry.intersectionRatio);
        }
        let bestId: string | null = null;
        let bestRatio = 0;
        for (const id of sectionIds) {
          const ratio = visibleRatios.get(id) ?? 0;
          if (ratio > bestRatio) {
            bestRatio = ratio;
            bestId = id;
          }
        }
        if (bestId && bestRatio > 0) {
          setActiveId(bestId);
        }
      },
      {
        root: null,
        rootMargin: "-15% 0px -55% 0px",
        threshold: [0, 0.1, 0.25, 0.5, 0.75, 1],
      },
    );

    for (const id of sectionIds) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [sectionIds]);

  function navigate(sectionId: string) {
    setActiveId(sectionId);
    window.history.replaceState(null, "", `#${sectionId}`);
    scrollLockRef.current = true;
    if (scrollLockTimerRef.current) clearTimeout(scrollLockTimerRef.current);
    scrollToId(sectionId);
    scrollLockTimerRef.current = setTimeout(() => {
      scrollLockRef.current = false;
    }, 800);
  }

  useEffect(() => {
    return () => {
      if (scrollLockTimerRef.current) clearTimeout(scrollLockTimerRef.current);
    };
  }, []);

  return (
    <div className="flex flex-col gap-6 md:flex-row md:gap-10">
      <div className="sticky z-10 -mx-4 bg-[var(--background)] px-4 pb-2 top-[calc(var(--app-header-height)+0.5rem)] md:hidden">
        <label className="block">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">
            {navTitle}
          </span>
          <select
            value={activeId}
            onChange={(event) => navigate(event.target.value)}
            className="w-full rounded-lg border px-3 py-2.5 text-sm"
            aria-label={navTitle}
          >
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <nav className="hidden w-44 shrink-0 md:block" aria-label={navTitle}>
        <ul className="sticky top-[var(--app-sticky-subnav-top)] max-h-[calc(100vh-var(--app-sticky-subnav-top)-1rem)] space-y-1 overflow-y-auto border-l border-[var(--border)] pl-3">
          {items.map((item) => {
            const isActive = item.id === activeId;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => navigate(item.id)}
                  className={`w-full rounded-r-lg py-1.5 pl-3 text-left text-sm transition-colors ${
                    isActive
                      ? "border-l-2 border-[var(--pwc-orange)] bg-[var(--pwc-orange)]/10 font-medium text-accent"
                      : "text-muted hover:text-[var(--foreground)]"
                  }`}
                >
                  {labels[item.id]}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
