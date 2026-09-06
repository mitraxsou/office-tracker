import { isBreakglassEmail } from "./breakglass-shared";

export type TermsUser = {
  email: string;
  mustChangePassword: boolean;
  termsAcceptedAt: Date | null;
  termsAcceptedVersion: number | null;
};

export function userNeedsTermsAcceptance(
  user: { termsAcceptedVersion: number | null },
  currentLegalVersion: number,
): boolean {
  if (user.termsAcceptedVersion === null) {
    return true;
  }
  return user.termsAcceptedVersion < currentLegalVersion;
}

export function getPostLoginRedirect(
  user: TermsUser,
  currentLegalVersion: number,
  opts?: { isNewUser?: boolean },
): string {
  if (user.mustChangePassword && !isBreakglassEmail(user.email)) {
    return "/settings?mustChange=1";
  }

  if (userNeedsTermsAcceptance(user, currentLegalVersion)) {
    const next = opts?.isNewUser ? "/settings?welcome=1" : "/dashboard";
    return `/terms/accept?next=${encodeURIComponent(next)}`;
  }

  if (opts?.isNewUser) {
    return "/settings?welcome=1";
  }

  return "/dashboard";
}

export function sanitizeTermsAcceptNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return "/dashboard";
  }
  if (next.startsWith("/terms/accept")) {
    return "/dashboard";
  }
  return next;
}
