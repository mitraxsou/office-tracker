import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { AppNav } from "@/components/AppNav";
import { AdminDashboard } from "@/components/AdminDashboard";
import Link from "next/link";

export default async function AdminPage() {
  const admin = await requireAdmin();
  if (!admin) redirect("/dashboard");

  return (
    <>
      <AppNav />
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Admin dashboard</h1>
            <p className="text-sm text-muted">Reporting, users, and org settings</p>
          </div>
          <Link href="/admin/settings" className="btn-secondary px-4 py-2 text-sm">
            Global settings
          </Link>
        </div>
        <AdminDashboard />
      </main>
    </>
  );
}
