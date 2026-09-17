import { Shell } from "@/components/workspace/shell";
import { Overview } from "@/components/workspace/overview";
import { Tracker } from "@/components/workspace/tracker";
import { demoApplications } from "@/lib/demo";
export const dynamic = "force-dynamic";
export default async function DemoPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const p = await searchParams;
  const applications = demoApplications();
  const query = typeof p.q === "string" ? p.q.slice(0, 160) : "";
  const stage = typeof p.stage === "string" ? p.stage : "";
  const archived = p.archived === "true";
  const filtered = applications.filter(
    (a) =>
      !archived &&
      (!stage || a.stage === stage) &&
      `${a.company} ${a.title}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <Shell
      demo
      active={p.view === "applications" ? "applications" : "dashboard"}
    >
      {p.view === "applications" ? (
        <Tracker
          demo
          rows={filtered}
          total={filtered.length}
          query={query}
          stage={stage}
          archived={archived}
        />
      ) : (
        <Overview demo applications={applications} />
      )}
    </Shell>
  );
}
