import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LegalFooter } from "@/components/LegalFooter";
import { RequestAccountForm } from "@/components/RequestAccountForm";
import { APP_NAME } from "@/lib/agent-branding";
import { isOtpSelfRegistrationAllowed } from "@/lib/otp-auth";

export default async function RequestAccountPage() {
  const otpSelfRegistration = await isOtpSelfRegistrationAllowed();

  return (
    <div className="auth-shell flex min-h-screen flex-col items-center justify-center px-4 py-8">
      <div className="fixed right-4 top-4 z-50">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-md space-y-4">
        <div className="card p-6">
          <h1 className="text-xl font-semibold">Request a {APP_NAME} account</h1>
          <p className="mt-2 text-sm text-muted">
            {otpSelfRegistration
              ? "Open OTP self-registration is on: you can also try signing in with your PwC email on the login page. Prefer admin review? Submit the form below."
              : "Open self-registration is currently closed. Submit your details and a pilot admin will decide whether to create your account. After approval, sign in with a Teams OTP."}
          </p>
          <RequestAccountForm />
        </div>
        <p className="text-center text-sm text-muted">
          Already have access?{" "}
          <Link href="/login" className="text-accent hover:underline">
            Sign in
          </Link>
          {" · "}
          <Link href="/help" className="text-accent hover:underline">
            Help
          </Link>
        </p>
      </div>
      <LegalFooter className="mt-6" />
    </div>
  );
}
