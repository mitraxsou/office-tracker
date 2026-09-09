import Link from "next/link";
import { redirect } from "next/navigation";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ImpersonationBanner } from "@/components/ImpersonationBanner";
import {
  AppNavMobileGuestActions,
  AppNavMobileMenu,
  type NavLink,
} from "@/components/AppNavMobileMenu";
import { destroySession, getCurrentUser, getImpersonationContext, getRealCurrentUser } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { APP_NAME } from "@/lib/agent-branding";
import { APP_VERSION } from "@/lib/app-version";
import { getAdminInbox } from "@/lib/admin-inbox";
import { AdminNotificationCorner } from "@/components/AdminNotificationCorner";
import { AdminImpersonatePicker } from "@/components/AdminImpersonatePicker";

function NavLinks({ links, className }: { links: NavLink[]; className?: string }) {
  return (
    <>
      {links.map((link) => (
        <Link key={`${link.href}:${link.label}`} href={link.href} className={`link-nav text-sm ${className ?? ""}`}>
          {link.label}
        </Link>
      ))}
    </>
  );
}

export async function AppNav() {
  const user = await getCurrentUser();
  const realUser = user ? await getRealCurrentUser() : null;
  const impersonation = await getImpersonationContext();

  if (!user) {
    return (
      <nav className="border-b border-[var(--border)] bg-[var(--background-elevated)]">
        <div className="mx-auto flex max-w-6xl min-w-0 items-center justify-between gap-3 px-4 py-4">
          <Link href="/help" className="flex min-w-0 shrink items-center gap-2 font-semibold">
            <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-[var(--pwc-orange)]" />
            <span className="truncate">{APP_NAME}</span>
          </Link>
          <div className="hidden items-center gap-3 md:flex">
            <ThemeToggle />
            <Link href="/help" className="link-nav text-sm">
              Help
            </Link>
            <Link href="/terms" className="link-nav text-sm">
              Terms
            </Link>
            <Link href="/privacy" className="link-nav text-sm">
              Privacy
            </Link>
            <Link href="/login" className="btn-primary px-3 py-1.5 text-sm">
              Sign in
            </Link>
          </div>
          <AppNavMobileGuestActions />
        </div>
      </nav>
    );
  }

  async function logout() {
    "use server";
    await destroySession();
    redirect("/login");
  }

  const adminAccess = isAdmin(realUser ?? user);
  const inbox = adminAccess ? await getAdminInbox() : null;
  const displayName = user.name ?? user.email;

  const navLinks: NavLink[] = [
    { href: "/dashboard", label: "Today" },
    { href: "/reports", label: "Reports" },
    { href: "/history", label: "History" },
    { href: "/settings", label: "Settings" },
    ...(adminAccess ? [{ href: "/admin", label: "Admin" }] : []),
    { href: "/help", label: "Help" },
  ];

  const logoutButton = (
    <button type="submit" className="link-nav min-h-11 px-0 py-2 text-sm md:min-h-0 md:py-0">
      Sign out
    </button>
  );

  const logoutForm = (
    <form action={logout}>
      {logoutButton}
    </form>
  );

  const adminToolsDesktop = (
    <>
      {inbox && <AdminNotificationCorner total={inbox.total} items={inbox.items} />}
      {adminAccess && !impersonation && <AdminImpersonatePicker />}
    </>
  );

  const adminToolsMobile = (
    <>
      {inbox && (
        <AdminNotificationCorner
          total={inbox.total}
          items={inbox.items}
          placement="drawer"
        />
      )}
      {adminAccess && !impersonation && <AdminImpersonatePicker placement="drawer" />}
    </>
  );

  return (
    <>
      {impersonation && (
        <ImpersonationBanner email={impersonation.email} name={impersonation.name} />
      )}
      <nav className="border-b border-[var(--border)] bg-[var(--background-elevated)]">
        <div className="mx-auto flex max-w-6xl min-w-0 items-center justify-between gap-3 px-4 py-4">
          <div className="flex min-w-0 items-center gap-6">
            <Link href="/dashboard" className="flex min-w-0 shrink items-center gap-2 font-semibold">
              <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-[var(--pwc-orange)]" />
              <span className="truncate">{APP_NAME}</span>
            </Link>
            <div className="hidden items-center gap-6 md:flex">
              <NavLinks links={navLinks} />
            </div>
          </div>

          <div className="hidden min-w-0 items-center gap-3 md:flex">
            {adminToolsDesktop}
            <ThemeToggle />
            <Link href="/help#whats-new" className="shrink-0 text-xs text-muted hover:text-accent">
              v{APP_VERSION}
            </Link>
            <span className="max-w-[10rem] truncate text-sm text-muted" title={user.email}>
              {displayName}
            </span>
            <form action={logout}>{logoutButton}</form>
          </div>

          <AppNavMobileMenu
            links={navLinks}
            userName={displayName}
            userEmail={user.email}
            version={APP_VERSION}
            adminTools={adminToolsMobile}
            logoutForm={logoutForm}
          />
        </div>
      </nav>
    </>
  );
}
