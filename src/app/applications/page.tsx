import { Shell } from "@/components/workspace/shell";
import { Tracker } from "@/components/workspace/tracker";
import { requireUser } from "@/server/auth";
import { getDb } from "@/server/db";
import { applicationService } from "@/server/application-service";
import { stages, type Stage } from "@/lib/application";
export const dynamic = "force-dynamic";
export default async function Applications({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q.slice(0, 160) : "";
  const stage =
    typeof params.stage === "string" && stages.includes(params.stage as Stage)
      ? (params.stage as Stage)
      : undefined;
  const rawPage = Number(params.page);
  const page =
    Number.isInteger(rawPage) && rawPage > 0 && rawPage <= 10000 ? rawPage : 1;
  const archived = params.archived === "true";
  const result = await applicationService(getDb()).list(user.id, {
    query,
    stage,
    page,
    archived,
  });
  return (
    <Shell name={user.name} active="applications">
      <Tracker
        {...result}
        query={query}
        stage={stage}
        archived={archived}
        initialNew={params.new === "1"}
      />
    </Shell>
  );
}
