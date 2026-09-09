import Link from "next/link";
import { redirect } from "next/navigation";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ImpersonationBanner } from "@/components/ImpersonationBanner";
import {
  AppNavMobileGuestMenu,
  AppNavMobileMenu,
  type NavLink,
} from "@/components/AppNavMobileMenu";
import { AppNavUserMenu } from "@/components/AppNavUserMenu";
import { destroySession, getCurrentUser, getImpersonationContext, getRealCurrentUser } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { APP_NAME } from "@/lib/agent-branding";
import { APP_VERSION } from "@/lib/app-version";
import { getAdminInbox } from "@/lib/admin-inbox";
import { AdminNotificationCorner } from "@/components/AdminNotificationCorner";
import { AdminImpersonatePicker } from "@/components/AdminImpersonatePicker";
import { GlobalSearch } from "@/components/GlobalSearch";

function NavLinks({ links, className }: { links: NavLink[]; className?: string }) {
  return (
    <>
      {links.map((link) => (
        <Link
          key={`${link.href}:${link.label}`}
          href={link.href}
          className={`link-nav whitespace-nowrap text-sm ${className ?? ""}`}
        >
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
        <div className="mx-auto flex max-w-6xl min-w-0 items-center justify-between gap-3 px-4 py-3 md:py-4">
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
          <AppNavMobileGuestMenu />
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

  const primaryNavLinks: NavLink[] = [
    { href: "/dashboard", label: "Today" },
    { href: "/reports", label: "Reports" },
    { href: "/history", label: "History" },
    { href: "/settings", label: "Settings" },
    { href: "/help", label: "Help" },
  ];

  const secondaryNavLinks: NavLink[] = [
    { href: "/contact-admin", label: "Contact admin" },
    ...(adminAccess ? [{ href: "/admin", label: "Admin" }] : []),
  ];

  const mobileNavLinks: NavLink[] = [...primaryNavLinks, ...secondaryNavLinks];

  const logoutButton = (
    <button
      type="submit"
      className="block w-full rounded-lg px-3 py-2 text-left text-sm link-nav hover:bg-[var(--border)]/40 md:px-3 md:py-2"
    >
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
        <div className="mx-auto flex max-w-6xl min-w-0 items-center justify-between gap-2 px-4 py-3 md:gap-3 md:py-4">
          <div className="flex min-w-0 items-center gap-4 lg:gap-6">
            <Link href="/dashboard" className="flex min-w-0 shrink items-center gap-2 font-semibold">
              <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-[var(--pwc-orange)]" />
              <span className="truncate">{APP_NAME}</span>
            </Link>
            <div className="hidden items-center gap-4 md:flex md:gap-5">
              <NavLinks links={primaryNavLinks} />
            </div>
          </div>

          <div className="hidden min-w-0 items-center gap-2 md:flex md:gap-3">
            <GlobalSearch isAdmin={adminAccess} />
            {adminToolsDesktop}
            <ThemeToggle />
            <AppNavUserMenu
              displayName={displayName}
              userEmail={user.email}
              showAdminLink={adminAccess}
              version={APP_VERSION}
              logoutForm={logoutForm}
            />
          </div>

          <div className="flex shrink-0 items-center gap-1.5 md:hidden">
            <GlobalSearch isAdmin={adminAccess} compact />
            <AppNavMobileMenu
              links={mobileNavLinks}
              primaryCount={primaryNavLinks.length}
              userName={displayName}
              userEmail={user.email}
              version={APP_VERSION}
              adminTools={adminToolsMobile}
              logoutForm={logoutForm}
            />
          </div>
        </div>
      </nav>
    </>
  );
}
