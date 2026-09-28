import { redirect } from "next/navigation";
import { AppNav } from "@/components/AppNav";
import { AdminSubNav } from "@/components/AdminSubNav";
import { AdminAccountAccessRequests } from "@/components/AdminAccountAccessRequests";
import { requireAdmin } from "@/lib/admin";
import { enforceTermsAcceptanceIfRequired } from "@/lib/session-guards";

export default async function AdminAccountRequestsPage() {
  const admin = await requireAdmin();
  if (!admin) {
    redirect("/login");
  }
  await enforceTermsAcceptanceIfRequired(admin, "/admin/account-requests");

  return (
    <>
      <AppNav />
      <main className="mx-auto max-w-5xl space-y-4 px-4 py-6">
        <header>
          <h1 className="text-2xl font-semibold">Account requests</h1>
          <p className="mt-1 text-sm text-muted">
            Approve or reject access when open OTP self-registration is off
          </p>
        </header>
        <AdminSubNav active="account-requests" />
        <AdminAccountAccessRequests />
      </main>
    </>
  );
}
