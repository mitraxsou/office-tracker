import { runScheduledCron } from "@/lib/cron-route";

export async function GET(request: Request) {
  return runScheduledCron(request, "purge-heartbeats");
}
