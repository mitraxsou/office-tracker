import Link from "next/link";
import type { PrivacySection, TermsSection } from "@/lib/legal-config";
import { HOBBY_DISCLAIMER } from "@/lib/legal-content";

type LegalDocumentViewProps = {
  kind: "terms" | "privacy";
  version: number;
  updatedLabel: string;
  termsSections?: TermsSection[];
  privacySections?: PrivacySection[];
};

export function LegalDocumentView({
  kind,
  version,
  updatedLabel,
  termsSections = [],
  privacySections = [],
}: LegalDocumentViewProps) {
  const title = kind === "terms" ? "Terms and Conditions" : "Privacy Policy";

  return (
    <main className="mx-auto max-w-3xl space-y-8 px-4 py-8">
      <div>
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="mt-2 text-sm text-muted">
          Version {version}. Last updated: {updatedLabel}. PwC Office Pulse (Office Tracker) pilot.
        </p>
      </div>

      <section className="card space-y-3 p-6">
        <h2 className="text-lg font-medium text-accent">{HOBBY_DISCLAIMER.title}</h2>
        {HOBBY_DISCLAIMER.paragraphs.map((paragraph) => (
          <p key={paragraph} className="text-sm text-muted">
            {paragraph}
          </p>
        ))}
      </section>

      {kind === "terms" &&
        termsSections.map((section) => (
          <section key={section.title} className="card space-y-3 p-6">
            <h2 className="text-lg font-medium text-accent">{section.title}</h2>
            <p className="text-sm text-muted">{section.body}</p>
          </section>
        ))}

      {kind === "privacy" &&
        privacySections.map((section) => (
          <section key={section.title} className="card space-y-3 p-6">
            <h2 className="text-lg font-medium text-accent">{section.title}</h2>
            <ul className="list-disc space-y-2 pl-5 text-sm text-muted">
              {section.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        ))}

      <section className="card space-y-3 p-6">
        {kind === "terms" ? (
          <p className="text-sm text-muted">
            Read how we handle data in the{" "}
            <Link href="/privacy" className="text-accent hover:underline">
              Privacy Policy
            </Link>
            .
          </p>
        ) : (
          <>
            <h2 className="text-lg font-medium text-accent">Contact</h2>
            <p className="text-sm text-muted">
              For pilot access or data questions, contact your pilot admin. This app has no corporate
              support desk.
            </p>
            <p className="text-sm">
              <Link href="/terms" className="text-accent hover:underline">
                Terms and Conditions
              </Link>
              {" · "}
              <Link href="/help" className="text-accent hover:underline">
                Help guide
              </Link>
            </p>
          </>
        )}
      </section>
    </main>
  );
}
