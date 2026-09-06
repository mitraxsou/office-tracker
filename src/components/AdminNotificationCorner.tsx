import Link from "next/link";
import type { AdminInboxItem } from "@/lib/admin-inbox";

export function AdminNotificationCorner({
  total,
  items,
}: {
  total: number;
  items: AdminInboxItem[];
}) {
  return (
    <details className="relative">
      <summary
        className="relative cursor-pointer list-none rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-sm hover:bg-[var(--border)]"
        aria-label={`${total} open admin requests`}
        title="Admin requests"
      >
        <span aria-hidden="true">🔔</span>
        {total > 0 && (
          <span className="absolute -right-2 -top-2 min-w-5 rounded-full bg-[var(--pwc-orange)] px-1 text-center text-xs font-semibold text-white">
            {total > 99 ? "99+" : total}
          </span>
        )}
      </summary>
      <div className="absolute right-0 z-50 mt-2 w-[min(20rem,calc(100vw-2rem))] rounded-xl border border-[var(--border)] bg-[var(--background-elevated)] p-3 shadow-xl">
        <div className="mb-2 flex items-center justify-between">
          <p className="font-medium">Admin requests</p>
          <Link href="/admin/inbox" className="text-xs text-accent hover:underline">
            Open inbox
          </Link>
        </div>
        {items.length === 0 ? (
          <p className="py-3 text-sm text-muted">No open requests.</p>
        ) : (
          <ul className="max-h-80 space-y-1 overflow-y-auto">
            {items.slice(0, 6).map((entry) => (
              <li key={`${entry.kind}:${entry.id}`}>
                <Link
                  href={entry.href}
                  className="block rounded-lg p-2 text-sm hover:bg-[var(--border)]"
                >
                  <span className="font-medium">{entry.label}</span>
                  <span className="block truncate text-xs text-muted">
                    {entry.userName ?? entry.userEmail}: {entry.summary}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </details>
  );
}
