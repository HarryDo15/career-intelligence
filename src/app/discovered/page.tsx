import { Shell } from "@/components/workspace/shell";
import { Discovery } from "@/components/workspace/discovery";
import { requireUser } from "@/server/auth";
import { getDb } from "@/server/db";
import { discoveryService } from "@/server/discovery-service";
import { localWorkflows } from "@/server/workflows/client";
export const dynamic = "force-dynamic";
export default async function Discovered({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const view =
    typeof params.view === "string" &&
    ["new", "saved", "dismissed"].includes(params.view)
      ? params.view
      : "new";
  const raw = Number(params.page);
  const page = Number.isInteger(raw) && raw > 0 && raw <= 10000 ? raw : 1;
  const service = discoveryService(getDb());
  const [profiles, jobs] = await Promise.all([
    service.profiles(user.id),
    service.listJobs(user.id, view, page),
  ]);
  return (
    <Shell name={user.name} active="discovered">
      <Discovery
        profiles={profiles}
        {...jobs}
        view={view}
        scheduling={localWorkflows || Boolean(process.env.INNGEST_SIGNING_KEY)}
      />
    </Shell>
  );
}
