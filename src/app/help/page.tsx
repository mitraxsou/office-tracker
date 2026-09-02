import { AppNav } from "@/components/AppNav";
import { HelpGuide } from "@/components/HelpGuide";
import { getCurrentUser } from "@/lib/auth";
import { enforcePasswordChangeIfRequired } from "@/lib/session-guards";
import { isAdmin } from "@/lib/admin";

export default async function HelpPage() {
  const user = await getCurrentUser();
  if (user) {
    enforcePasswordChangeIfRequired(user);
  }

  return (
    <>
      <AppNav />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <HelpGuide isLoggedIn={!!user} isAdmin={user ? isAdmin(user) : false} />
      </main>
    </>
  );
}
