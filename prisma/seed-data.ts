import type { PrismaClient } from "../src/generated/prisma/client";
import { demoApplications } from "../src/lib/demo";
export async function seedApplications(db: PrismaClient, userId: string) {
  for (const row of demoApplications()) {
    const { id: demoId, ...rest } = row;
    const id = `seed-${userId}-${demoId}`;
    await db.application.upsert({
      where: { id },
      update: {},
      create: {
        ...rest,
        id,
        userId,
        createdAt: new Date(row.createdAt),
        appliedAt: row.appliedAt ? new Date(row.appliedAt) : null,
        firstResponseAt: row.firstResponseAt
          ? new Date(row.firstResponseAt)
          : null,
        archivedAt: null,
        history: {
          create: {
            source: "IMPORT",
            toStage: row.stage,
            occurredAt: new Date(row.appliedAt ?? row.createdAt),
            idempotencyKey: `seed:${id}`,
          },
        },
      },
    });
  }
}
