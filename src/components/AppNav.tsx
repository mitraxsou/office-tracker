import Link from "next/link";
import { redirect } from "next/navigation";
import { destroySession, getCurrentUser } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";

export async function AppNav() {
  const user = await getCurrentUser();
  if (!user) return null;

  async function logout() {
    "use server";
    await destroySession();
    redirect("/login");
  }

  return (
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
          <Link href="/history" className="link-nav text-sm">
            History
          </Link>
          <Link href="/settings" className="link-nav text-sm">
            Settings
          </Link>
          {isAdmin(user) && (
            <Link href="/admin" className="link-nav text-sm">
              Admin
            </Link>
          )}
          <Link href="/help" className="link-nav text-sm">
            Help
          </Link>
        </div>
        <form action={logout}>
          <button type="submit" className="link-nav text-sm">
            Sign out
          </button>
        </form>
      </div>
    </nav>
  );
}
