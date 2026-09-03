export type CronAuthResult =
  | { ok: true }
  | { ok: false; status: 401 | 503; error: string };

export function authorizeCronRequest(request: Request): CronAuthResult {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return { ok: false, status: 503, error: "CRON_SECRET not configured" };
  }

  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }

  return { ok: true };
}
