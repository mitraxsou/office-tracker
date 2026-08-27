import { cookies } from "next/headers";

const WELCOME_TOKEN_COOKIE = "office-tracker-welcome-token";

export async function setWelcomeToken(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(WELCOME_TOKEN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 300,
    path: "/",
  });
}

export async function consumeWelcomeToken(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(WELCOME_TOKEN_COOKIE)?.value ?? null;
  if (token) cookieStore.delete(WELCOME_TOKEN_COOKIE);
  return token;
}
