import { Shell } from "@/components/workspace/shell";
import { Overview } from "@/components/workspace/overview";
import { requireUser } from "@/server/auth";
import { getDb } from "@/server/db";
import { applicationService } from "@/server/application-service";
export const dynamic = "force-dynamic";
export default async function Dashboard() {
  const user = await requireUser();
  const applications = await applicationService(getDb()).overview(user.id);
  return (
    <Shell name={user.name}>
      <Overview applications={applications} />
    </Shell>
  );
}
