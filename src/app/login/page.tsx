import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LegalFooter } from "@/components/LegalFooter";
import {
  authenticateUser,
  clearLoginAttempts,
  createSession,
  getLoginAttemptCount,
  MAX_LOGIN_ATTEMPTS,
  recordFailedLoginAttempt,
} from "@/lib/auth";
import {
  checkPasswordLoginIpLimit,
  getClientIpFromHeaders,
  recordPasswordLoginIpAttempt,
} from "@/lib/auth-rate-limit";
import { getCurrentLegalVersion } from "@/lib/legal-config";
import { getPostLoginRedirect } from "@/lib/terms-acceptance";
import { LoginForm } from "./LoginForm";

const LOCKOUT_MESSAGE =
  "Too many failed attempts. Contact your pilot admin to reset your password.";
const PASSWORD_IP_LIMIT_MESSAGE =
  "Too many sign-in attempts from this network. Try again in 15 minutes.";

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
    const headerStore = await headers();
    const ip = getClientIpFromHeaders(headerStore);
    const ipLimit = await checkPasswordLoginIpLimit(ip);
    if (!ipLimit.allowed) {
      redirect(`/login?error=${encodeURIComponent(PASSWORD_IP_LIMIT_MESSAGE)}`);
    }
    await recordPasswordLoginIpAttempt(ip);

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
    const currentLegalVersion = await getCurrentLegalVersion();
    redirect(getPostLoginRedirect(user, currentLegalVersion));
  }

  return (
    <div className="auth-shell flex min-h-screen flex-col items-center justify-center px-4 py-8">
      <div className="fixed right-4 top-4 z-50">
        <ThemeToggle />
      </div>
      <LoginForm
        error={params.error}
        lockedOut={lockedOut}
        lockoutMessage={LOCKOUT_MESSAGE}
        passwordLogin={login}
      />
      <LegalFooter className="mt-6" />
    </div>
  );
}
