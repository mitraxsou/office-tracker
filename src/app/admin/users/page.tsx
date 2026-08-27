import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { AppNav } from "@/components/AppNav";
import { AdminSubNav } from "@/components/AdminSubNav";
import { AdminUsersDashboard } from "@/components/AdminUsersDashboard";

export default async function AdminUsersPage() {
  const admin = await requireAdmin();
  if (!admin) redirect("/dashboard");

  return (
    <>
      <AppNav />
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8">
        <div>
          <h1 className="text-2xl font-semibold">Users & tokens</h1>
          <p className="text-sm text-muted">
            Create pilot users, issue install tokens per laptop, and manage devices
          </p>
        </div>
        <AdminSubNav active="users" />
        <AdminUsersDashboard />
      </main>
    </>
  );
}
