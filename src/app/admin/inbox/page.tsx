import Link from "next/link";
import { redirect } from "next/navigation";
import { AppNav } from "@/components/AppNav";
import { AdminSubNav } from "@/components/AdminSubNav";
import { requireAdmin } from "@/lib/admin";
import { getAdminInbox } from "@/lib/admin-inbox";
import { enforcePasswordChangeIfRequired } from "@/lib/session-guards";

export default async function AdminInboxPage() {
  const admin = await requireAdmin();
  if (!admin) redirect("/dashboard");
  enforcePasswordChangeIfRequired(admin);
  const inbox = await getAdminInbox();

  return (
    <>
      <AppNav />
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8">
        <div>
          <h1 className="text-2xl font-semibold">Admin inbox</h1>
          <p className="text-sm text-muted">{inbox.total} open user requests across all review queues</p>
        </div>
        <AdminSubNav active="inbox" />
        <section className="card overflow-hidden">
          {inbox.items.length === 0 ? (
            <p className="p-6 text-sm text-muted">No open requests.</p>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {inbox.items.map((item) => (
                <li key={`${item.kind}:${item.id}`} className="flex items-center justify-between gap-4 p-4">
                  <div className="min-w-0">
                    <p className="font-medium">{item.label}</p>
                    <p className="truncate text-sm text-muted">
                      {item.userName ?? item.userEmail} ({item.userEmail}): {item.summary}
                    </p>
                    <time className="text-xs text-muted" dateTime={item.createdAt}>
                      {new Date(item.createdAt).toLocaleString("en-IN")}
                    </time>
                  </div>
                  <Link href={item.href} className="btn-secondary shrink-0 px-3 py-1.5 text-sm">
                    Review
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </>
  );
}
