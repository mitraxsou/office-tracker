import { AppNav } from "@/components/AppNav";
import { HelpGuide } from "@/components/HelpGuide";
import { LegalFooter } from "@/components/LegalFooter";
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
      <main className="mx-auto max-w-5xl px-4 py-8">
        <HelpGuide isLoggedIn={!!user} isAdmin={user ? isAdmin(user) : false} />
        <LegalFooter className="mt-8" />
      </main>
    </>
  );
}
