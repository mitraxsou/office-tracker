import { redirect } from "next/navigation";
import { getCurrentUser } from "./auth";
import { getCurrentLegalVersion } from "./legal-config";
import { isBreakglassEmail } from "./breakglass-shared";
import { userNeedsTermsAcceptance } from "./terms-acceptance";

export async function requireAuthenticatedUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export function enforcePasswordChangeIfRequired(user: {
  email: string;
  mustChangePassword: boolean;
}) {
  if (user.mustChangePassword && !isBreakglassEmail(user.email)) {
    redirect("/settings?mustChange=1");
  }
}

export async function enforceTermsAcceptanceIfRequired(
  user: {
    mustChangePassword: boolean;
    email: string;
    termsAcceptedVersion: number | null;
  },
  nextPath = "/dashboard",
) {
  if (user.mustChangePassword && !isBreakglassEmail(user.email)) {
    return;
  }
  const currentLegalVersion = await getCurrentLegalVersion();
  if (userNeedsTermsAcceptance(user, currentLegalVersion)) {
    redirect(`/terms/accept?next=${encodeURIComponent(nextPath)}`);
  }
}
