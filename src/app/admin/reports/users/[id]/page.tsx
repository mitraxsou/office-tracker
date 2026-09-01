import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { AppNav } from "@/components/AppNav";
import { AdminSubNav } from "@/components/AdminSubNav";
import { AdminUserReport } from "@/components/AdminUserReport";

export default async function AdminUserReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const admin = await requireAdmin();
  if (!admin) redirect("/dashboard");

  const { id } = await params;

  return (
    <>
      <AppNav />
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8">
        <AdminSubNav active="reports" />
        <AdminUserReport userId={id} />
      </main>
    </>
  );
}
