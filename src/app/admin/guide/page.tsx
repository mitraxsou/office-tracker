import { redirect } from "next/navigation";
import { AppNav } from "@/components/AppNav";
import { AdminGuide } from "@/components/AdminGuide";
import { AdminSubNav } from "@/components/AdminSubNav";
import { requireAdmin } from "@/lib/admin";
import { enforcePasswordChangeIfRequired, enforceTermsAcceptanceIfRequired } from "@/lib/session-guards";

export default async function AdminGuidePage() {
  const admin = await requireAdmin();
  if (!admin) redirect("/dashboard");
  enforcePasswordChangeIfRequired(admin);
  await enforceTermsAcceptanceIfRequired(admin, "/admin/guide");

  return (
    <>
      <AppNav />
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8">
        <header className="page-hero">
          <h1 className="text-2xl font-semibold">Admin guide</h1>
          <p className="mt-2 text-sm text-muted">
            Standard operating procedures, feature reference, and troubleshooting for pilot
            administrators. This is a hobby project for fun, not official PwC tooling.
          </p>
        </header>
        <AdminSubNav active="guide" />
        <AdminGuide />
      </main>
    </>
  );
}
