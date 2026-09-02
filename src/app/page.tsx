import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export default async function Home() {
  const user = await getCurrentUser();
  if (user?.mustChangePassword) {
    redirect("/settings?mustChange=1");
  }
  redirect(user ? "/dashboard" : "/login");
}
