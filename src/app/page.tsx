import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentLegalVersion } from "@/lib/legal-config";
import { getPostLoginRedirect } from "@/lib/terms-acceptance";

export default async function Home() {
  const user = await getCurrentUser();
  if (user) {
    const currentLegalVersion = await getCurrentLegalVersion();
    redirect(getPostLoginRedirect(user, currentLegalVersion));
  }
  redirect("/login");
}