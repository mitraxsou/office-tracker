import { redirect } from "next/navigation";
import { requireAuthenticatedUser, enforcePasswordChangeIfRequired, enforceTermsAcceptanceIfRequired } from "@/lib/session-guards";

export default async function HistoryPage() {
  const user = await requireAuthenticatedUser();
  enforcePasswordChangeIfRequired(user);
  await enforceTermsAcceptanceIfRequired(user, "/reports?tab=visits");

  redirect("/reports?tab=visits");
}
