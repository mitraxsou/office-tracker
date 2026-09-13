import { notFound } from "next/navigation";
import { AppNav } from "@/components/AppNav";
import { DevSimulatorPanel } from "@/components/DevSimulatorPanel";
import { isDevSimulatorEnabled } from "@/lib/dev-simulator";

export default function DevSimulatorPage() {
  if (!isDevSimulatorEnabled()) {
    notFound();
  }

  return (
    <>
      <AppNav />
      <main className="mx-auto max-w-4xl space-y-6 px-4 py-8">
        <div>
          <h1 className="text-2xl font-semibold">Agent event simulator</h1>
          <p className="text-sm text-muted">
            Trigger agent sync events for demo users without installing multiple Windows agents.
            Use with seeded dashboard data from <code>npm run seed:demo</code>.
          </p>
        </div>
        <DevSimulatorPanel />
      </main>
    </>
  );
}
