import Link from "next/link";
import { redirect } from "next/navigation";
import { createSession, isRegistrationAllowed, registerUser } from "@/lib/auth";
import { setWelcomeToken, setInstallToken } from "@/lib/welcome-token";

export default function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  return <RegisterForm searchParams={searchParams} />;
}

async function RegisterForm({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  if (!(await isRegistrationAllowed())) {
    redirect("/login?error=Registration+is+disabled");
  }

  async function register(formData: FormData) {
    "use server";
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");
    const name = String(formData.get("name") ?? "");

    if (password.length < 8) {
      redirect("/register?error=Password+must+be+at+least+8+characters");
    }

    try {
      const { user, plainAgentToken } = await registerUser(email, password, name || undefined);
      await createSession(user.id);
      await setWelcomeToken(plainAgentToken);
      await setInstallToken(plainAgentToken);
      redirect("/settings?welcome=1");
    } catch {
      redirect("/register?error=Email+already+registered");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="card w-full max-w-md p-8 shadow-xl">
        <div className="mb-6 flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-full bg-[var(--pwc-orange)]" />
          <h1 className="text-2xl font-semibold">Create account</h1>
        </div>
        <p className="text-sm text-muted">Pilot sign-up for colleagues tracking 5 office hours per day.</p>
        {params.error && (
          <p className="mt-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">
            {params.error}
          </p>
        )}
        <form action={register} className="mt-6 space-y-4">
          <div>
            <label className="mb-1 block text-sm text-muted">Name</label>
            <input name="name" type="text" className="w-full rounded-lg border px-3 py-2" />
          </div>
          <div>
            <label className="mb-1 block text-sm text-muted">Email</label>
            <input name="email" type="email" required className="w-full rounded-lg border px-3 py-2" />
          </div>
          <div>
            <label className="mb-1 block text-sm text-muted">Password</label>
            <input
              name="password"
              type="password"
              required
              minLength={8}
              className="w-full rounded-lg border px-3 py-2"
            />
          </div>
          <button type="submit" className="btn-primary w-full px-4 py-2">
            Register
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-muted">
          Already have an account?{" "}
          <Link href="/login" className="text-accent hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
