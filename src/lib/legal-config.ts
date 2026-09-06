import { prisma } from "./db";
import {
  HOBBY_DISCLAIMER,
  PRIVACY_SECTIONS,
  TERMS_SECTIONS,
} from "./legal-content";

export type TermsSection = {
  title: string;
  body: string;
};

export type PrivacySection = {
  title: string;
  items: string[];
};

export type PublishedLegalConfig = {
  legalVersion: number;
  termsSections: TermsSection[];
  privacySections: PrivacySection[];
  changeSummary: string | null;
  publishedAt: Date | null;
  publishedById: string | null;
};

export type AdminLegalDraft = {
  legalVersion: number;
  publishedTermsSections: TermsSection[];
  publishedPrivacySections: PrivacySection[];
  publishedChangeSummary: string | null;
  publishedAt: Date | null;
  draftTermsSections: TermsSection[];
  draftPrivacySections: PrivacySection[];
  draftChangeSummary: string | null;
};

const CONFIG_ID = "global";

let cachedLegalVersion: { value: number; expiresAt: number } | null = null;
const VERSION_CACHE_MS = 30_000;

export function getDefaultTermsSections(): TermsSection[] {
  return TERMS_SECTIONS.map((section) => ({ ...section }));
}

export function getDefaultPrivacySections(): PrivacySection[] {
  return PRIVACY_SECTIONS.map((section) => ({
    title: section.title,
    items: [...section.items],
  }));
}

function parseTermsContent(raw: string): TermsSection[] | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    for (const section of parsed) {
      if (
        typeof section !== "object" ||
        section === null ||
        typeof (section as TermsSection).title !== "string" ||
        typeof (section as TermsSection).body !== "string" ||
        !(section as TermsSection).title.trim() ||
        !(section as TermsSection).body.trim()
      ) {
        return null;
      }
    }
    return parsed as TermsSection[];
  } catch {
    return null;
  }
}

function parsePrivacyContent(raw: string): PrivacySection[] | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    for (const section of parsed) {
      if (
        typeof section !== "object" ||
        section === null ||
        typeof (section as PrivacySection).title !== "string" ||
        !Array.isArray((section as PrivacySection).items)
      ) {
        return null;
      }
      const items = (section as PrivacySection).items;
      if (
        items.length === 0 ||
        items.some((item) => typeof item !== "string" || !item.trim())
      ) {
        return null;
      }
    }
    return parsed as PrivacySection[];
  } catch {
    return null;
  }
}

export function validateTermsSections(sections: unknown): TermsSection[] | null {
  if (!Array.isArray(sections) || sections.length === 0) return null;
  const normalized: TermsSection[] = [];
  for (const section of sections) {
    if (
      typeof section !== "object" ||
      section === null ||
      typeof section.title !== "string" ||
      typeof section.body !== "string"
    ) {
      return null;
    }
    const title = section.title.trim();
    const body = section.body.trim();
    if (!title || !body) return null;
    normalized.push({ title, body });
  }
  return normalized;
}

export function validatePrivacySections(sections: unknown): PrivacySection[] | null {
  if (!Array.isArray(sections) || sections.length === 0) return null;
  const normalized: PrivacySection[] = [];
  for (const section of sections) {
    if (
      typeof section !== "object" ||
      section === null ||
      typeof section.title !== "string" ||
      !Array.isArray(section.items)
    ) {
      return null;
    }
    const title = section.title.trim();
    const items = section.items
      .map((item: unknown) => (typeof item === "string" ? item.trim() : ""))
      .filter(Boolean);
    if (!title || items.length === 0) return null;
    normalized.push({ title, items });
  }
  return normalized;
}

function resolvePublishedSections(
  termsContent: string,
  privacyContent: string,
): { termsSections: TermsSection[]; privacySections: PrivacySection[] } {
  const termsSections = parseTermsContent(termsContent) ?? getDefaultTermsSections();
  const privacySections = parsePrivacyContent(privacyContent) ?? getDefaultPrivacySections();
  return { termsSections, privacySections };
}

export async function ensureLegalConfig() {
  const existing = await prisma.legalConfig.findUnique({ where: { id: CONFIG_ID } });
  if (existing) return existing;

  const now = new Date();
  return prisma.legalConfig.create({
    data: {
      id: CONFIG_ID,
      legalVersion: 1,
      termsContent: JSON.stringify(getDefaultTermsSections()),
      privacyContent: JSON.stringify(getDefaultPrivacySections()),
      publishedAt: now,
    },
  });
}

export async function getCurrentLegalVersion(): Promise<number> {
  const now = Date.now();
  if (cachedLegalVersion && cachedLegalVersion.expiresAt > now) {
    return cachedLegalVersion.value;
  }

  await ensureLegalConfig();
  const row = await prisma.legalConfig.findUnique({
    where: { id: CONFIG_ID },
    select: { legalVersion: true },
  });
  const version = row?.legalVersion ?? 1;
  cachedLegalVersion = { value: version, expiresAt: now + VERSION_CACHE_MS };
  return version;
}

export function clearLegalVersionCache() {
  cachedLegalVersion = null;
}

export async function getPublishedLegalConfig(): Promise<PublishedLegalConfig> {
  await ensureLegalConfig();
  const row = await prisma.legalConfig.findUnique({ where: { id: CONFIG_ID } });
  if (!row) {
    return {
      legalVersion: 1,
      termsSections: getDefaultTermsSections(),
      privacySections: getDefaultPrivacySections(),
      changeSummary: null,
      publishedAt: null,
      publishedById: null,
    };
  }

  const { termsSections, privacySections } = resolvePublishedSections(
    row.termsContent,
    row.privacyContent,
  );

  return {
    legalVersion: row.legalVersion,
    termsSections,
    privacySections,
    changeSummary: row.changeSummary,
    publishedAt: row.publishedAt,
    publishedById: row.publishedById,
  };
}

export async function getAdminLegalDraft(): Promise<AdminLegalDraft> {
  await ensureLegalConfig();
  const row = await prisma.legalConfig.findUnique({ where: { id: CONFIG_ID } });
  if (!row) {
    const termsSections = getDefaultTermsSections();
    const privacySections = getDefaultPrivacySections();
    return {
      legalVersion: 1,
      publishedTermsSections: termsSections,
      publishedPrivacySections: privacySections,
      publishedChangeSummary: null,
      publishedAt: null,
      draftTermsSections: termsSections,
      draftPrivacySections: privacySections,
      draftChangeSummary: null,
    };
  }

  const published = resolvePublishedSections(row.termsContent, row.privacyContent);
  const draftTerms = row.draftTermsContent
    ? parseTermsContent(row.draftTermsContent) ?? published.termsSections
    : published.termsSections;
  const draftPrivacy = row.draftPrivacyContent
    ? parsePrivacyContent(row.draftPrivacyContent) ?? published.privacySections
    : published.privacySections;

  return {
    legalVersion: row.legalVersion,
    publishedTermsSections: published.termsSections,
    publishedPrivacySections: published.privacySections,
    publishedChangeSummary: row.changeSummary,
    publishedAt: row.publishedAt,
    draftTermsSections: draftTerms,
    draftPrivacySections: draftPrivacy,
    draftChangeSummary: row.draftChangeSummary,
  };
}

export async function updateLegalDraft(input: {
  termsSections: TermsSection[];
  privacySections: PrivacySection[];
  changeSummary?: string | null;
}) {
  await ensureLegalConfig();
  const changeSummary =
    input.changeSummary === undefined
      ? undefined
      : input.changeSummary?.trim() || null;

  return prisma.legalConfig.update({
    where: { id: CONFIG_ID },
    data: {
      draftTermsContent: JSON.stringify(input.termsSections),
      draftPrivacyContent: JSON.stringify(input.privacySections),
      ...(changeSummary !== undefined ? { draftChangeSummary: changeSummary } : {}),
    },
  });
}

export async function publishLegalConfig(adminId: string) {
  await ensureLegalConfig();
  const row = await prisma.legalConfig.findUnique({ where: { id: CONFIG_ID } });
  if (!row) {
    throw new Error("Legal config not found");
  }

  const draftTerms = row.draftTermsContent
    ? parseTermsContent(row.draftTermsContent)
    : parseTermsContent(row.termsContent);
  const draftPrivacy = row.draftPrivacyContent
    ? parsePrivacyContent(row.draftPrivacyContent)
    : parsePrivacyContent(row.privacyContent);

  if (!draftTerms || !draftPrivacy) {
    throw new Error("Invalid draft legal content");
  }

  const now = new Date();
  const nextVersion = row.legalVersion + 1;
  const changeSummary = row.draftChangeSummary?.trim() || null;

  const updated = await prisma.legalConfig.update({
    where: { id: CONFIG_ID },
    data: {
      legalVersion: nextVersion,
      termsContent: JSON.stringify(draftTerms),
      privacyContent: JSON.stringify(draftPrivacy),
      changeSummary,
      publishedAt: now,
      publishedById: adminId,
      draftTermsContent: null,
      draftPrivacyContent: null,
      draftChangeSummary: null,
    },
  });

  clearLegalVersionCache();
  return updated;
}

export function formatLegalUpdatedLabel(publishedAt: Date | null): string {
  if (!publishedAt) return "September 2026";
  return publishedAt.toLocaleDateString("en-IN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Asia/Kolkata",
  });
}

export { HOBBY_DISCLAIMER };
