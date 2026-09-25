import Link from "next/link";
import { Shell } from "@/components/workspace/shell";
import { Overview } from "@/components/workspace/overview";
import { Tracker } from "@/components/workspace/tracker";
import { Kanban } from "@/components/workspace/kanban";
import { Discovery } from "@/components/workspace/discovery";
import { demoApplications } from "@/lib/demo";
import { analyticsInput, defaultFilter, summarize } from "@/lib/analytics";
import {
  mockListings,
  matchJob,
  type ProfileRow,
  type DiscoveredRow,
} from "@/lib/jobs";
import { stages } from "@/lib/application";
export const dynamic = "force-dynamic";
export default async function DemoPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
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
  let content;
  if (p.view === "applications")
    content =
      p.layout === "board" ? (
        <Kanban
          demo
          query={query}
          columns={stages.map((s) => ({
            stage: s,
            total: filtered.filter((a) => a.stage === s).length,
            rows: filtered.filter((a) => a.stage === s),
          }))}
        />
      ) : (
        <Tracker
          demo
          rows={filtered}
          total={filtered.length}
          query={query}
          stage={stage}
          archived={archived}
        />
      );
  else if (p.view === "discovered") {
    const profile: ProfileRow = {
      id: "demo-profile",
      name: "My next engineering role",
      titles: ["engineer"],
      keywords: ["typescript", "react"],
      excludedKeywords: ["intern"],
      locations: [],
      workModes: ["REMOTE"],
      enabled: true,
      version: 0,
      lastRunAt: null,
      lastStatus: null,
      lastResultCount: null,
    };
    const tab =
      typeof p.tab === "string" && ["new", "saved", "dismissed"].includes(p.tab)
        ? p.tab
        : "new";
    const rows: DiscoveredRow[] =
      tab === "new"
        ? mockListings.flatMap((job) => {
            const match = matchJob(job, profile);
            return match
              ? [
                  {
                    ...job,
                    id: job.externalId,
                    discoveredAt: job.publishedAt,
                    dismissedAt: null,
                    applicationId: null,
                    matches: [{ name: profile.name, ...match }],
                  },
                ]
              : [];
          })
        : [];
    content = (
      <Discovery
        demo
        profiles={[profile]}
        rows={rows}
        total={rows.length}
        view={tab}
      />
    );
  } else {
    const defaults = defaultFilter();
    const parsed = analyticsInput.safeParse(
      Object.fromEntries(
        Object.entries(defaults).map(([k, v]) => [k, p[k] ?? v]),
      ),
    );
    if (!parsed.success)
      content = (
        <p role="alert" className="panel p-6">
          Invalid date range or timezone.{" "}
          <Link href="/demo" className="text-primary underline">
            Reset filters
          </Link>
        </p>
      );
    else {
      const data = summarize(
        applications.map((a) => ({
          stage: a.stage,
          appliedAt: a.appliedAt ? new Date(a.appliedAt) : null,
          firstResponseAt: a.firstResponseAt
            ? new Date(a.firstResponseAt)
            : null,
          history: [{ toStage: a.stage }],
        })),
        parsed.data,
        applications.filter((a) =>
          ["APPLIED", "SCREENING", "TECHNICAL"].includes(a.stage),
        ).length,
      );
      content = (
        <Overview
          demo
          applications={applications.filter((a) => !a.archivedAt)}
          data={data}
        />
      );
    }
  }
  return (
    <Shell
      demo
      active={
        p.view === "applications"
          ? "applications"
          : p.view === "discovered"
            ? "discovered"
            : "dashboard"
      }
    >
      {content}
    </Shell>
  );
}
