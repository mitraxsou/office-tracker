import Link from "next/link";
import { AppNav } from "@/components/AppNav";
import { LegalDocumentView } from "@/components/LegalDocumentView";
import { LegalFooter } from "@/components/LegalFooter";
import { formatLegalUpdatedLabel, getPublishedLegalConfig } from "@/lib/legal-config";

export default async function TermsPage() {
  const legal = await getPublishedLegalConfig();

  return (
    <>
      <AppNav />
      <LegalDocumentView
        kind="terms"
        version={legal.legalVersion}
        updatedLabel={formatLegalUpdatedLabel(legal.publishedAt)}
        termsSections={legal.termsSections}
      />
      <div className="mx-auto max-w-3xl px-4 pb-8">
        <LegalFooter />
      </div>
    </>
  );
}
