import Link from "next/link";
import { Shell } from "@/components/workspace/shell";
import { Overview } from "@/components/workspace/overview";
import { requireUser } from "@/server/auth";
import { getDb } from "@/server/db";
import { applicationService } from "@/server/application-service";
import { getAnalytics } from "@/server/analytics-service";
import { analyticsInput, defaultFilter } from "@/lib/analytics";
export const dynamic = "force-dynamic";
export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const db = getDb();
  const profile = await db.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { timezone: true },
  });
  const params = await searchParams;
  const defaults = defaultFilter(profile.timezone);
  const parsed = analyticsInput.safeParse(
    Object.fromEntries(
      Object.entries(defaults).map(([k, v]) => [k, params[k] ?? v]),
    ),
  );
  if (!parsed.success)
    return (
      <Shell name={user.name}>
        <p role="alert" className="panel p-6">
          Choose valid dates (up to two years), a week/month grouping, and an
          IANA timezone.{" "}
          <Link href="/dashboard" className="text-primary underline">
            Reset filters
          </Link>
        </p>
      </Shell>
    );
  const [data, recent] = await Promise.all([
    getAnalytics(db, user.id, parsed.data),
    applicationService(db).list(user.id),
  ]);
  return (
    <Shell name={user.name}>
      <Overview applications={recent.rows} data={data} />
    </Shell>
  );
}
