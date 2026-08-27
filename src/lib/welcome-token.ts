import { cookies } from "next/headers";

const WELCOME_TOKEN_COOKIE = "office-tracker-welcome-token";
const INSTALL_TOKEN_COOKIE = "office-tracker-install-token";

export async function setWelcomeToken(token: string) {
  await setShortLivedTokenCookie(WELCOME_TOKEN_COOKIE, token);
}

export async function setInstallToken(token: string) {
  await setShortLivedTokenCookie(INSTALL_TOKEN_COOKIE, token);
}

async function setShortLivedTokenCookie(name: string, token: string) {
  const cookieStore = await cookies();
  cookieStore.set(name, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 300,
    path: "/",
  });
}

export async function consumeWelcomeToken(): Promise<string | null> {
  return consumeShortLivedTokenCookie(WELCOME_TOKEN_COOKIE);
}

export async function consumeInstallToken(): Promise<string | null> {
  return consumeShortLivedTokenCookie(INSTALL_TOKEN_COOKIE);
}

export async function peekInstallToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(INSTALL_TOKEN_COOKIE)?.value ?? null;
}

async function consumeShortLivedTokenCookie(name: string): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(name)?.value ?? null;
  if (token) cookieStore.delete(name);
  return token;
}
