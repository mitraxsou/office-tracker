import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { getAppConfig } from "@/lib/app-config";
import { AppNav } from "@/components/AppNav";
import { AdminSettingsForm } from "@/components/AdminSettingsForm";
import Link from "next/link";

export default async function AdminSettingsPage() {
  const admin = await requireAdmin();
  if (!admin) redirect("/dashboard");

  const config = await getAppConfig();

  return (
    <>
      <AppNav />
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
        <div>
          <Link href="/admin" className="text-sm text-accent hover:underline">
            ← Admin dashboard
          </Link>
          <h1 className="mt-2 text-2xl font-semibold">Global settings</h1>
          <p className="text-sm text-muted">Hours target and office SSIDs for all users</p>
        </div>
        <AdminSettingsForm
          hoursTarget={config.hoursTarget}
          officeSsids={config.officeSsids}
          maxDevicesPerUser={config.maxDevicesPerUser}
        />
      </main>
    </>
  );
}
