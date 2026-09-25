import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { enforcePasswordChangeIfRequired, enforceTermsAcceptanceIfRequired } from "@/lib/session-guards";
import { AppNav } from "@/components/AppNav";
import { AdminSubNav } from "@/components/AdminSubNav";
import { AdminUsersDashboard } from "@/components/AdminUsersDashboard";

export default async function AdminUsersPage() {
  const admin = await requireAdmin();
  if (!admin) redirect("/dashboard");
  enforcePasswordChangeIfRequired(admin);
  await enforceTermsAcceptanceIfRequired(admin, "/admin/users");

  return (
    <>
      <AppNav />
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8">
        <header className="page-hero">
          <h1 className="text-2xl font-semibold">Users & tokens</h1>
          <p className="mt-1 text-sm text-muted">
            Create pilot users, issue install tokens per laptop, search and paginate the user list,
            and correct profile data or visits from each user card.
          </p>
        </header>
        <AdminSubNav active="users" />
        <AdminUsersDashboard />
      </main>
    </>
  );
}
