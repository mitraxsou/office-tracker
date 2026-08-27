import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AppNav } from "@/components/AppNav";
import { VisitList } from "@/components/VisitList";
import { formatDate } from "@/lib/visits";

export default async function HistoryPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const visits = await prisma.visit.findMany({
    where: { userId: user.id },
    orderBy: { startAt: "desc" },
    take: 50,
  });

  const grouped = visits.reduce<Record<string, typeof visits>>((acc, visit) => {
    const key = formatDate(visit.startAt, user.timezone);
    acc[key] = acc[key] ?? [];
    acc[key].push(visit);
    return acc;
  }, {});

  return (
    <>
      <AppNav />
      <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
        <div>
          <h1 className="text-2xl font-semibold">History</h1>
          <p className="text-sm text-muted">Last 50 visits (your data only)</p>
        </div>
        {Object.keys(grouped).length === 0 ? (
          <p className="text-muted">No visits yet.</p>
        ) : (
          Object.entries(grouped).map(([day, dayVisits]) => (
            <section key={day} className="card p-6">
              <h2 className="mb-4 font-medium text-accent">{day}</h2>
              <VisitList visits={dayVisits} timezone={user.timezone} />
            </section>
          ))
        )}
      </main>
    </>
  );
}
