import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { isBreakglassEmail } from "@/lib/breakglass";

export default async function Home() {
  const user = await getCurrentUser();
  if (user?.mustChangePassword && !isBreakglassEmail(user.email)) {
    redirect("/settings?mustChange=1");
  }
  redirect(user ? "/dashboard" : "/login");
}
