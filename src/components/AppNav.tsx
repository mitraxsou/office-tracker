import Link from "next/link";
import { redirect } from "next/navigation";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ImpersonationBanner } from "@/components/ImpersonationBanner";
import { destroySession, getCurrentUser, getImpersonationContext, getRealCurrentUser } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";

export async function AppNav() {
  const user = await getCurrentUser();
  const realUser = user ? await getRealCurrentUser() : null;
  const impersonation = await getImpersonationContext();

  if (!user) {
    return (
      <nav className="border-b border-[var(--border)] bg-[var(--background-elevated)]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link href="/help" className="flex items-center gap-2 font-semibold">
            <span className="inline-block h-2 w-2 rounded-full bg-[var(--pwc-orange)]" />
            PwC Office Pulse
          </Link>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link href="/help" className="link-nav text-sm">
              Help
            </Link>
            <Link href="/login" className="btn-primary px-3 py-1.5 text-sm">
              Sign in
            </Link>
          </div>
        </div>
      </nav>
    );
  }

  async function logout() {
    "use server";
    await destroySession();
    redirect("/login");
  }

  return (
    <>
      {impersonation && (
        <ImpersonationBanner email={impersonation.email} name={impersonation.name} />
      )}
      <nav className="border-b border-[var(--border)] bg-[var(--background-elevated)]">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
            <span className="inline-block h-2 w-2 rounded-full bg-[var(--pwc-orange)]" />
            PwC Office Pulse
          </Link>
          <Link href="/dashboard" className="link-nav text-sm">
            Today
          </Link>
          <Link href="/reports" className="link-nav text-sm">
            Reports
          </Link>
          <Link href="/history" className="link-nav text-sm">
            History
          </Link>
          <Link href="/settings" className="link-nav text-sm">
            Settings
          </Link>
          {isAdmin(realUser ?? user) && (
            <Link href="/admin" className="link-nav text-sm">
              Admin
            </Link>
          )}
          <Link href="/help" className="link-nav text-sm">
            Help
          </Link>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <span className="text-sm text-muted" title={user.email}>
            {user.name ?? user.email}
          </span>
          <form action={logout}>
            <button type="submit" className="link-nav text-sm">
              Sign out
            </button>
          </form>
        </div>
      </div>
    </nav>
    </>
  );
}
