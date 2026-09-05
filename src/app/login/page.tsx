import { redirect } from "next/navigation";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  authenticateUser,
  clearLoginAttempts,
  createSession,
  getLoginAttemptCount,
  MAX_LOGIN_ATTEMPTS,
  recordFailedLoginAttempt,
} from "@/lib/auth";
import { isBreakglassEmail } from "@/lib/breakglass";
import { LoginForm } from "./LoginForm";

const LOCKOUT_MESSAGE =
  "Too many failed attempts. Contact your pilot admin to reset your password.";

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  return <LoginPageContent searchParams={searchParams} />;
}

async function LoginPageContent({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const attemptCount = await getLoginAttemptCount();
  const lockedOut = attemptCount >= MAX_LOGIN_ATTEMPTS;

  async function login(formData: FormData) {
    "use server";
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");
    const user = await authenticateUser(email, password);
    if (!user) {
      const attempts = await recordFailedLoginAttempt();
      if (attempts >= MAX_LOGIN_ATTEMPTS) {
        redirect(`/login?error=${encodeURIComponent(LOCKOUT_MESSAGE)}`);
      }
      redirect("/login?error=Invalid+email+or+password");
    }
    await clearLoginAttempts();
    await createSession(user.id);
    if (user.mustChangePassword && !isBreakglassEmail(user.email)) {
      redirect("/settings?mustChange=1");
    }
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="fixed right-4 top-4 z-50">
        <ThemeToggle />
      </div>
      <LoginForm
        error={params.error}
        lockedOut={lockedOut}
        lockoutMessage={LOCKOUT_MESSAGE}
        passwordLogin={login}
      />
    </div>
  );
}
