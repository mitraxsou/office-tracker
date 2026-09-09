import Link from "next/link";
import { redeemOutOfOfficeLinkToken } from "@/lib/out-of-office";

export default async function OutOfOfficePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <main className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="text-xl font-semibold">Invalid link</h1>
        <p className="mt-2 text-sm text-muted">This out-of-office link is missing or incomplete.</p>
        <Link href="/dashboard" className="mt-6 inline-block text-accent hover:underline">
          Go to dashboard
        </Link>
      </main>
    );
  }

  try {
    const result = await redeemOutOfOfficeLinkToken(token);
    return (
      <main className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="text-xl font-semibold text-green-400">You&apos;re marked out of office</h1>
        <p className="mt-3 text-sm text-muted">
          No My Office Pulse reminders will be sent for{" "}
          <strong className="text-foreground">{result.dayKey}</strong>.
          {result.name || result.email ? (
            <>
              {" "}
              ({result.name ?? result.email})
            </>
          ) : null}
        </p>
        <p className="mt-2 text-xs text-muted">
          You can change this anytime in Settings → Out of office.
        </p>
        <Link href="/settings" className="btn-primary mt-8 inline-block px-4 py-2 text-sm">
          Open settings
        </Link>
      </main>
    );
  } catch {
    return (
      <main className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="text-xl font-semibold">Link expired or invalid</h1>
        <p className="mt-2 text-sm text-muted">
          Open Settings and mark out of office manually, or use a newer link from your alert.
        </p>
        <Link href="/settings" className="mt-6 inline-block text-accent hover:underline">
          Go to settings
        </Link>
      </main>
    );
  }
}
