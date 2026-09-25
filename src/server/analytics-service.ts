import type { PrismaClient } from "@/generated/prisma/client";
import { summarize, windowFor } from "@/lib/analytics";
export async function getAnalytics(
  db: PrismaClient,
  userId: string,
  input: unknown,
) {
  const { filter, start, end } = windowFor(input);
  const [cohort, active] = await db.$transaction(
    [
      db.application.findMany({
        where: { userId, appliedAt: { gte: start, lt: end } },
        select: {
          stage: true,
          appliedAt: true,
          firstResponseAt: true,
          history: {
            select: { toStage: true },
            where: { toStage: { in: ["SCREENING", "TECHNICAL", "OFFER"] } },
          },
        },
      }),
      db.application.count({
        where: {
          userId,
          archivedAt: null,
          stage: { in: ["APPLIED", "SCREENING", "TECHNICAL"] },
        },
      }),
    ],
    { isolationLevel: "RepeatableRead" },
  );
  return summarize(cohort, filter, active);
}
