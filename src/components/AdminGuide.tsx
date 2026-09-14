"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ADMIN_GUIDE_NAV,
  ADMIN_GUIDE_SECTIONS,
  type GuideBlock,
} from "@/lib/admin-guide-content";

function SectionAnchor({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="scroll-mt-header text-lg font-medium text-accent">
      {children}
    </h2>
  );
}

function GuideBlockView({ block }: { block: GuideBlock }) {
  switch (block.type) {
    case "paragraph":
      return <p className="text-sm text-muted">{block.text}</p>;
    case "subheading":
      return <h3 className="text-sm font-medium">{block.text}</h3>;
    case "list":
      if (block.ordered) {
        return (
          <ol className="list-decimal space-y-1 pl-5 text-sm text-muted">
            {block.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ol>
        );
      }
      return (
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
          {block.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      );
    case "diagram":
      return (
        <pre className="overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--background)] p-4 font-mono text-xs leading-relaxed text-muted">
          {block.lines.join("\n")}
        </pre>
      );
    case "troubleshooting":
      return (
        <dl className="space-y-3 text-sm">
          {block.items.map((item) => (
            <div key={item.problem} className="rounded-lg border border-[var(--border)] p-3">
              <dt className="font-medium">{item.problem}</dt>
              <dd className="mt-1 text-muted">{item.fix}</dd>
            </div>
          ))}
        </dl>
      );
    case "links":
      return (
        <p className="text-sm">
          {block.items.map((link, index) => (
            <span key={link.href}>
              {index > 0 && " · "}
              <Link href={link.href} className="text-accent hover:underline">
                {link.label}
              </Link>
            </span>
          ))}
        </p>
      );
    default:
      return null;
  }
}

function SectionNav({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <ul className="space-y-1 text-sm">
      {ADMIN_GUIDE_NAV.map((item) => (
        <li key={item.id}>
          <a
            href={`#${item.id}`}
            onClick={onNavigate}
            className="block rounded px-2 py-1 text-muted hover:bg-[var(--border)] hover:text-[var(--foreground)]"
          >
            {item.title}
          </a>
        </li>
      ))}
    </ul>
  );
}

export function AdminGuide() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-8">
      <aside className="mb-6 lg:sticky lg:top-[var(--app-sticky-subnav-top)] lg:mb-0 lg:self-start">
        <div className="card p-4 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted lg:hidden">
            On this page
          </p>
          <button
            type="button"
            onClick={() => setMobileNavOpen((open) => !open)}
            className="mb-2 flex w-full items-center justify-between text-sm font-medium lg:hidden"
            aria-expanded={mobileNavOpen}
          >
            <span>Jump to section</span>
            <span className="text-xs text-muted">{mobileNavOpen ? "Hide" : "Show"}</span>
          </button>
          <div className={`${mobileNavOpen ? "block" : "hidden"} lg:block`}>
            <p className="mb-2 hidden text-sm font-medium lg:block">On this page</p>
            <SectionNav onNavigate={() => setMobileNavOpen(false)} />
          </div>
        </div>
      </aside>

      <div className="min-w-0 space-y-6">
        <div className="card p-4 text-sm text-muted lg:hidden">
          <p>
            Full admin reference for My Office Pulse. Use the section list above to jump. On desktop,
            the nav stays visible while you scroll.
          </p>
        </div>

        {ADMIN_GUIDE_SECTIONS.map((section) => (
          <section key={section.id} className="card scroll-mt-header space-y-3 p-6">
            <SectionAnchor id={section.id}>{section.title}</SectionAnchor>
            <div className="space-y-3">
              {section.blocks.map((block, index) => (
                <GuideBlockView key={`${section.id}-${index}`} block={block} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
