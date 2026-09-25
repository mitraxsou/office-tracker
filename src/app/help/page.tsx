import Link from "next/link";
import { AppNav } from "@/components/AppNav";
import { HelpGuide } from "@/components/HelpGuide";
import { LegalFooter } from "@/components/LegalFooter";
import { APP_NAME } from "@/lib/agent-branding";
import { getCurrentUser } from "@/lib/auth";
import { enforcePasswordChangeIfRequired } from "@/lib/session-guards";
import { isAdmin } from "@/lib/admin";

export default async function HelpPage() {
  const user = await getCurrentUser();
  if (user) {
    enforcePasswordChangeIfRequired(user);
  }

  const isLoggedIn = !!user;

  return (
    <>
      <AppNav />
      <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
        <header className="page-hero">
          <h1 className="text-2xl font-semibold">How to use {APP_NAME}</h1>
          <p className="mt-2 text-sm text-muted">
            Internal pilot: track at least <strong>5 hours per day in the office</strong> on your PwC laptop.
            A small Windows agent reports presence on office Wi-Fi. You can read this before you sign in.
          </p>
          {!isLoggedIn && (
            <p className="mt-3 text-sm">
              <Link href="/login" className="text-accent hover:underline">
                Sign in
              </Link>
              {" · "}
              <Link href="/register" className="text-accent hover:underline">
                Register
              </Link>
            </p>
          )}
        </header>

        <HelpGuide isLoggedIn={isLoggedIn} isAdmin={user ? isAdmin(user) : false} />
        <LegalFooter className="mt-8" />
      </main>
    </>
  );
}
