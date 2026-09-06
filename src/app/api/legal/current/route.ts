import { NextResponse } from "next/server";
import {
  formatLegalUpdatedLabel,
  getPublishedLegalConfig,
  HOBBY_DISCLAIMER,
} from "@/lib/legal-config";

export async function GET() {
  const legal = await getPublishedLegalConfig();

  return NextResponse.json({
    legalVersion: legal.legalVersion,
    publishedAt: legal.publishedAt?.toISOString() ?? null,
    updatedLabel: formatLegalUpdatedLabel(legal.publishedAt),
    changeSummary: legal.changeSummary,
    hobbyDisclaimer: HOBBY_DISCLAIMER,
    termsSections: legal.termsSections,
    privacySections: legal.privacySections,
  });
}
