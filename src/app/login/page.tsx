import Link from "next/link";
import { redirect } from "next/navigation";
import { ThemeToggle } from "@/components/ThemeToggle";
import { authenticateUser, createSession } from "@/lib/auth";

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  return <LoginForm searchParams={searchParams} />;
}

async function LoginForm({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  async function login(formData: FormData) {
    "use server";
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");
    const user = await authenticateUser(email, password);
    if (!user) {
      redirect("/login?error=Invalid+email+or+password");
    }
    await createSession(user.id);
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="fixed right-4 top-4 z-50">
        <ThemeToggle />
      </div>
      <div className="card w-full max-w-md p-8 shadow-xl">
        <div className="mb-6 flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-full bg-[var(--pwc-orange)]" />
          <h1 className="text-2xl font-semibold">Office Tracker</h1>
        </div>
        <p className="text-sm text-muted">
          Track your 5-hour office presence. Office Wi-Fi SSIDs are set on the server, not on your laptop.
        </p>
        {params.error && (
          <p className="mt-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">
            {params.error}
          </p>
        )}
        <form action={login} className="mt-6 space-y-4">
          <div>
            <label className="mb-1 block text-sm text-muted">Email</label>
            <input
              name="email"
              type="email"
              required
              className="w-full rounded-lg border px-3 py-2"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-muted">Password</label>
            <input
              name="password"
              type="password"
              required
              className="w-full rounded-lg border px-3 py-2"
            />
          </div>
          <button type="submit" className="btn-primary w-full px-4 py-2">
            Sign in
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-muted">
          No account?{" "}
          <Link href="/register" className="text-accent hover:underline">
            Register
          </Link>
        </p>
        <p className="mt-3 text-center text-sm text-muted">
          New to Office Pulse?{" "}
          <Link href="/help" className="text-accent hover:underline">
            Read the setup guide
          </Link>
        </p>
      </div>
    </div>
  );
}
