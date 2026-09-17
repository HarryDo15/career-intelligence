import type { PrismaClient, Prisma } from "@/generated/prisma/client";
import {
  applicationInput,
  mutationMeta,
  listInput,
} from "@/features/applications/validation";
import type { ApplicationRow } from "@/lib/application";
export class DomainError extends Error {
  constructor(
    public code: "NOT_FOUND" | "CONFLICT",
    message: string,
  ) {
    super(message);
  }
}
const selection = {
  id: true,
  company: true,
  title: true,
  location: true,
  workMode: true,
  stage: true,
  url: true,
  notes: true,
  appliedAt: true,
  firstResponseAt: true,
  archivedAt: true,
  createdAt: true,
  version: true,
} satisfies Prisma.ApplicationSelect;
type Selected = Prisma.ApplicationGetPayload<{ select: typeof selection }>;
export function toRow(a: Selected): ApplicationRow {
  return {
    ...a,
    appliedAt: a.appliedAt?.toISOString() ?? null,
    firstResponseAt: a.firstResponseAt?.toISOString() ?? null,
    archivedAt: a.archivedAt?.toISOString() ?? null,
    createdAt: a.createdAt.toISOString(),
  };
}
// Internal service: callers MUST derive userId from a validated session, never request JSON.
export function applicationService(db: PrismaClient) {
  return {
    async list(userId: string, input: unknown = {}) {
      const { query, stage, archived, page } = listInput.parse(input);
      const where: Prisma.ApplicationWhereInput = {
        userId,
        archivedAt: archived ? { not: null } : null,
        ...(stage ? { stage } : {}),
        ...(query
          ? {
              OR: [
                { company: { contains: query, mode: "insensitive" } },
                { title: { contains: query, mode: "insensitive" } },
              ],
            }
          : {}),
      };
      const [total, rows] = await db.$transaction([
        db.application.count({ where }),
        db.application.findMany({
          where,
          select: selection,
          orderBy: [{ createdAt: "desc" }, { id: "asc" }],
          take: 20,
          skip: (page - 1) * 20,
        }),
      ]);
      return { total, page, pageSize: 20, rows: rows.map(toRow) };
    },
    async overview(userId: string) {
      // Server-only data for the initial personal-scale overview. No cross-user cache.
      const rows = await db.application.findMany({
        where: { userId },
        select: selection,
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      });
      return rows.map(toRow);
    },
    async create(userId: string, input: unknown) {
      const data = applicationInput.parse(input);
      return db.$transaction(async (tx) => {
        const a = await tx.application.create({
          data: {
            ...data,
            userId,
            url: data.url || null,
            location: data.location || null,
            notes: data.notes || null,
          },
          select: selection,
        });
        await tx.stageEvent.create({
          data: {
            applicationId: a.id,
            toStage: a.stage,
            source: "MANUAL",
            occurredAt: a.appliedAt ?? new Date(),
            idempotencyKey: `create:${a.id}`,
          },
        });
        await tx.auditLog.create({
          data: {
            userId,
            action: "application.created",
            entityType: "Application",
            entityId: a.id,
          },
        });
        return toRow(a);
      });
    },
    async update(userId: string, meta: unknown, input: unknown) {
      const { id, version } = mutationMeta.parse(meta);
      const data = applicationInput.parse(input);
      return db.$transaction(async (tx) => {
        const before = await tx.application.findFirst({
          where: { id, userId },
          select: selection,
        });
        if (!before)
          throw new DomainError("NOT_FOUND", "Application not found.");
        const result = await tx.application.updateMany({
          where: { id, userId, version },
          data: {
            ...data,
            url: data.url || null,
            notes: data.notes || null,
            location: data.location || null,
            version: { increment: 1 },
          },
        });
        if (result.count !== 1)
          throw new DomainError(
            "CONFLICT",
            "This application changed in another tab. Close the form, refresh, and try again.",
          );
        if (before.stage !== data.stage)
          await tx.stageEvent.create({
            data: {
              applicationId: id,
              fromStage: before.stage,
              toStage: data.stage,
              source: "MANUAL",
              occurredAt: new Date(),
              idempotencyKey: `update:${id}:${version + 1}`,
            },
          });
        await tx.auditLog.create({
          data: {
            userId,
            action: "application.updated",
            entityType: "Application",
            entityId: id,
            metadata: { version: version + 1 },
          },
        });
        return toRow(
          await tx.application.findUniqueOrThrow({
            where: { id },
            select: selection,
          }),
        );
      });
    },
    async archive(userId: string, meta: unknown, archived: boolean) {
      const { id, version } = mutationMeta.parse(meta);
      return db.$transaction(async (tx) => {
        const before = await tx.application.findFirst({
          where: { id, userId },
          select: { id: true },
        });
        if (!before)
          throw new DomainError("NOT_FOUND", "Application not found.");
        const result = await tx.application.updateMany({
          where: { id, userId, version },
          data: {
            archivedAt: archived ? new Date() : null,
            version: { increment: 1 },
          },
        });
        if (result.count !== 1)
          throw new DomainError(
            "CONFLICT",
            "This application changed. Refresh before trying again.",
          );
        await tx.auditLog.create({
          data: {
            userId,
            action: archived ? "application.archived" : "application.restored",
            entityType: "Application",
            entityId: id,
          },
        });
      });
    },
  };
}
