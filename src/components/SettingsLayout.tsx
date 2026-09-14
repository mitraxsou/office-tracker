"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type SettingsSectionId = "agent" | "account" | "notifications" | "diagnostics";

type SettingsLayoutProps = {
  adminAccess?: boolean;
  isWelcome?: boolean;
  accountOnly?: boolean;
  sections: {
    agent: ReactNode | null;
    account: ReactNode;
    notifications: ReactNode | null;
    diagnostics?: ReactNode | null;
  };
};

const SECTION_LABELS: Record<SettingsSectionId, string> = {
  agent: "Agent",
  account: "Account",
  notifications: "Notifications",
  diagnostics: "Diagnostics",
};

function hashToSectionId(hash: string, adminAccess: boolean): SettingsSectionId | null {
  const h = hash.replace("#", "");
  if (h === "install" || h === "agent" || h === "") return "agent";
  if (h === "account" || h === "notifications") return h;
  if (h === "diagnostics" && adminAccess) return "diagnostics";
  return null;
}

export function SettingsLayout({
  adminAccess = false,
  isWelcome,
  accountOnly = false,
  sections,
}: SettingsLayoutProps) {
  const navItems = useMemo(() => {
    if (accountOnly) return ["account"] as SettingsSectionId[];
    const ids: SettingsSectionId[] = ["agent", "account", "notifications"];
    if (adminAccess) ids.push("diagnostics");
    return ids;
  }, [adminAccess, accountOnly]);

  const [activeId, setActiveId] = useState<SettingsSectionId>(accountOnly ? "account" : "agent");
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
      if (accountOnly) {
        setActiveId("account");
        scrollToId("account");
        return;
      }
      const raw = window.location.hash.replace("#", "");
      const section = hashToSectionId(window.location.hash, adminAccess) ?? "agent";
      setActiveId(section);

      if (raw === "install") {
        scrollToId("install");
        return;
      }
      if (raw === "agent") {
        scrollToId("agent");
        return;
      }
      if (raw === "account" || raw === "notifications" || (raw === "diagnostics" && adminAccess)) {
        scrollToId(raw);
        return;
      }
      if (!raw && isWelcome) {
        scrollToId("agent");
      }
    };

    applyHash();
    window.addEventListener("hashchange", applyHash);
    return () => window.removeEventListener("hashchange", applyHash);
  }, [adminAccess, isWelcome, scrollToId, accountOnly]);

  useEffect(() => {
    if (accountOnly || navItems.length === 0) return;

    const visibleRatios = new Map<string, number>();

    const observer = new IntersectionObserver(
      (entries) => {
        if (scrollLockRef.current) return;
        for (const entry of entries) {
          visibleRatios.set(entry.target.id, entry.intersectionRatio);
        }
        let bestId: SettingsSectionId | null = null;
        let bestRatio = 0;
        for (const id of navItems) {
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

    for (const id of navItems) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [navItems, accountOnly]);

  function navigate(sectionId: SettingsSectionId) {
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
      <div className="sticky top-4 z-10 -mx-4 bg-[var(--background)] px-4 pb-2 md:hidden">
        <label className="block">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">
            Settings section
          </span>
          <select
            value={activeId}
            onChange={(event) => navigate(event.target.value as SettingsSectionId)}
            className="w-full rounded-lg border px-3 py-2.5 text-sm"
            aria-label="Settings section"
          >
            {navItems.map((id) => (
              <option key={id} value={id}>
                {SECTION_LABELS[id]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <nav className="hidden w-44 shrink-0 md:block" aria-label="Settings sections">
        <ul className="sticky top-6 space-y-1 border-l border-[var(--border)] pl-3">
          {navItems.map((id) => {
            const isActive = id === activeId;
            return (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => navigate(id)}
                  className={`w-full rounded-r-lg py-1.5 pl-3 text-left text-sm transition-colors ${
                    isActive
                      ? "border-l-2 border-[var(--pwc-orange)] bg-[var(--pwc-orange)]/10 font-medium text-accent"
                      : "text-muted hover:text-[var(--foreground)]"
                  }`}
                >
                  {SECTION_LABELS[id]}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="min-w-0 flex-1 space-y-12">
        {sections.agent != null && (
          <section id="agent" className="scroll-mt-6 space-y-6">
            <h2 className="text-lg font-medium">Agent</h2>
            {sections.agent}
          </section>
        )}

        <section id="account" className="scroll-mt-6 space-y-6">
          <h2 className="text-lg font-medium">Account</h2>
          {sections.account}
        </section>

        {sections.notifications != null && (
          <section id="notifications" className="scroll-mt-6 space-y-6">
            <h2 className="text-lg font-medium">Notifications</h2>
            {sections.notifications}
          </section>
        )}

        {adminAccess && sections.diagnostics != null && (
          <section id="diagnostics" className="scroll-mt-6 space-y-6">
            <h2 className="text-lg font-medium">Diagnostics</h2>
            {sections.diagnostics}
          </section>
        )}
      </div>
    </div>
  );
}
