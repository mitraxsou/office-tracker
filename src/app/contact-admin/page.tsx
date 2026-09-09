import { redirect } from "next/navigation";
import { AppNav } from "@/components/AppNav";
import { ContactAdminForm } from "@/components/ContactAdminForm";
import { getCurrentUser } from "@/lib/auth";
import {
  isValidAdminContactCategory,
  listUserAdminContactThreads,
  type AdminContactCategory,
} from "@/lib/admin-contact";
import { enforcePasswordChangeIfRequired, enforceTermsAcceptanceIfRequired } from "@/lib/session-guards";

export default async function ContactAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  enforcePasswordChangeIfRequired(user);
  await enforceTermsAcceptanceIfRequired(user, "/contact-admin");

  const params = await searchParams;
  const initialCategory: AdminContactCategory | undefined = isValidAdminContactCategory(
    params.category ?? "",
  )
    ? (params.category as AdminContactCategory)
    : undefined;

  const threads = await listUserAdminContactThreads(user.id);

  return (
    <>
      <AppNav />
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
        <div>
          <h1 className="text-2xl font-semibold">Reach out to admin</h1>
          <p className="text-sm text-muted">
            Share issues, concerns, or feedback with the pilot admins.
          </p>
        </div>
        <ContactAdminForm
          initialThreads={threads}
          initialCategory={initialCategory}
        />
      </main>
    </>
  );
}
