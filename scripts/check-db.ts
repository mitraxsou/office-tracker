import { PrismaClient } from "@prisma/client";

async function main() {
  const p = new PrismaClient();
  const h = await p.heartbeat.findMany({ orderBy: { recordedAt: "desc" }, take: 3 });
  const v = await p.visit.findMany({ orderBy: { startAt: "desc" }, take: 3 });
  const at = await p.agentToken.findFirst({
    include: { user: { include: { agentDevices: true } } },
  });
  console.log("HEARTBEATS", JSON.stringify(h, null, 2));
  console.log("VISITS", JSON.stringify(v, null, 2));
  console.log(
    "DEVICES",
    at?.user.agentDevices.map((d) => d.serialNumber).join(",") ?? "none"
  );
  await p.$disconnect();
}

main();
