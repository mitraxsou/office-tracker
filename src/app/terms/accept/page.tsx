import { AppNav } from "@/components/AppNav";
import { LegalFooter } from "@/components/LegalFooter";
import { TermsAcceptForm } from "@/components/TermsAcceptForm";
import { formatLegalUpdatedLabel, getCurrentLegalVersion, getPublishedLegalConfig } from "@/lib/legal-config";
import { requireAuthenticatedUser } from "@/lib/session-guards";
import { sanitizeTermsAcceptNextPath, userNeedsTermsAcceptance } from "@/lib/terms-acceptance";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function TermsAcceptPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const user = await requireAuthenticatedUser();
  const params = await searchParams;
  const nextPath = sanitizeTermsAcceptNextPath(params.next);
  const currentLegalVersion = await getCurrentLegalVersion();

  if (!userNeedsTermsAcceptance(user, currentLegalVersion)) {
    redirect(nextPath);
  }

  const legal = await getPublishedLegalConfig();
  const isReaccept = user.termsAcceptedVersion !== null;
  const updatedLabel = formatLegalUpdatedLabel(legal.publishedAt);

  return (
    <>
      <AppNav />
      <main className="mx-auto max-w-lg px-4 py-8">
        <div className="card space-y-6 p-8 shadow-xl">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-accent">
              Version {legal.legalVersion}
            </p>
            <h1 className="mt-1 text-2xl font-semibold">
              {isReaccept ? "Updated Terms to review" : "Accept Terms to continue"}
            </h1>
            <p className="mt-2 text-sm text-muted">
              {isReaccept
                ? `We published new Terms and Privacy Policy on ${updatedLabel}. Please review and accept to continue using My Office Pulse.`
                : "Before using My Office Pulse, please read and accept the Terms and Privacy Policy."}
            </p>
          </div>

          {legal.changeSummary && (
            <div className="rounded-lg border border-accent/30 bg-accent/5 p-4 text-sm">
              <p className="font-medium text-foreground">What changed</p>
              <p className="mt-2 whitespace-pre-wrap text-muted">{legal.changeSummary}</p>
            </div>
          )}

          <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-4 text-sm text-muted">
            <p className="font-medium text-foreground">Summary</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Hobby project for fun and learning, not a PwC product or official tooling</li>
              <li>You join and install the agent voluntarily, at your own interest</li>
              <li>The developer is not responsible for improper use of the site or agent</li>
              <li>
                We collect email, office visit times, Wi-Fi SSID, and agent tokens to run the
                pilot. See{" "}
                <Link href="/privacy" className="text-accent hover:underline">
                  Privacy Policy
                </Link>{" "}
                for details.
              </li>
            </ul>
          </div>

          <TermsAcceptForm nextPath={nextPath} legalVersion={legal.legalVersion} />

          <p className="text-center text-xs text-muted">
            <Link href="/terms" className="text-accent hover:underline">
              Full Terms (v{legal.legalVersion})
            </Link>
            {" · "}
            <Link href="/privacy" className="text-accent hover:underline">
              Full Privacy Policy (v{legal.legalVersion})
            </Link>
          </p>
        </div>
        <LegalFooter className="mt-6" />
      </main>
    </>
  );
}
