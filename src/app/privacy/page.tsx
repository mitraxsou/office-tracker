import { AppNav } from "@/components/AppNav";
import { LegalDocumentView } from "@/components/LegalDocumentView";
import { LegalFooter } from "@/components/LegalFooter";
import { formatLegalUpdatedLabel, getPublishedLegalConfig } from "@/lib/legal-config";

export default async function PrivacyPage() {
  const legal = await getPublishedLegalConfig();

  return (
    <>
      <AppNav />
      <LegalDocumentView
        kind="privacy"
        version={legal.legalVersion}
        updatedLabel={formatLegalUpdatedLabel(legal.publishedAt)}
        privacySections={legal.privacySections}
      />
      <div className="mx-auto max-w-3xl px-4 pb-8">
        <LegalFooter />
      </div>
    </>
  );
}
