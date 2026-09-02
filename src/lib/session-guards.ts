import { redirect } from "next/navigation";
import { getCurrentUser } from "./auth";
import { isBreakglassEmail } from "./breakglass-shared";

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
