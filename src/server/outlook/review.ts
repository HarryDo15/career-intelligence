import type { PrismaClient } from "@/generated/prisma/client";
import { z } from "zod";
import { DomainError } from "../application-service";
import { unseal } from "./crypto";
import { sourcePayload } from "./classifier";
import { applicationInput } from "@/features/applications/validation";
const id = z.string().min(1).max(128);
const reviewInput = z.object({
  id,
  applicationId: id.optional(),
  version: z.number().int().nonnegative().optional(),
  company: z.string(),
  title: z.string(),
  appliedAt: z.string(),
  stage: z.enum(["APPLIED", "SCREENING", "TECHNICAL", "OFFER", "REJECTED"]),
});
const notFound = () =>
  new DomainError("NOT_FOUND", "Email suggestion not found.");
export function outlookReview(db: PrismaClient) {
  return {
    async list(userId: string, page = 1) {
      page = z.number().int().min(1).max(10000).parse(page);
      const where = {
        connection: { userId },
        reviewStatus: "PENDING" as const,
      };
      const [rows, total] = await db.$transaction([
        db.emailSignal.findMany({
          where,
          orderBy: [{ receivedAt: "desc" }, { id: "asc" }],
          take: 20,
          skip: (page - 1) * 20,
        }),
        db.emailSignal.count({ where }),
      ]);
      return {
        total,
        rows: rows.map((s) => ({
          id: s.id,
          receivedAt: s.receivedAt.toISOString(),
          stage: s.proposedStage,
          reason: s.reasonCode,
          source: s.encryptedPayload
            ? sourcePayload.parse(
                JSON.parse(
                  unseal(
                    s.encryptedPayload,
                    `signal:${s.connectionId}:${s.messageId}`,
                  ),
                ),
              )
            : {
                subject: "Source unavailable",
                sender: "",
                excerpt: "",
                company: "",
                title: "",
              },
        })),
      };
    },
    async dismiss(userId: string, input: unknown) {
      const signalId = id.parse(input);
      const changed = await db.emailSignal.updateMany({
        where: {
          id: signalId,
          connection: { userId },
          reviewStatus: "PENDING",
        },
        data: { reviewStatus: "DISMISSED", reviewedAt: new Date() },
      });
      if (!changed.count) throw notFound();
    },
    async accept(userId: string, input: unknown) {
      const value = reviewInput.parse(input);
      return db.$transaction(async (tx) => {
        // Shared user lock also serializes new-record reviews and disconnect.
        await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
        const signal = await tx.emailSignal.findFirst({
          where: { id: value.id, connection: { userId } },
        });
        if (!signal) throw notFound();
        if (signal.reviewStatus === "ACCEPTED")
          return { id: signal.applicationId, historical: false };
        if (signal.reviewStatus !== "PENDING")
          throw new DomainError(
            "CONFLICT",
            "This suggestion was already dismissed.",
          );
        if (value.applicationId)
          await tx.$queryRaw`SELECT id FROM "Application" WHERE id = ${value.applicationId} AND "userId" = ${userId} FOR UPDATE`;
        const app = value.applicationId
          ? await tx.application.findFirst({
              where: { id: value.applicationId, userId },
            })
          : null;
        if (value.applicationId && !app) throw notFound();
        if (app && (app.version !== value.version || app.archivedAt))
          throw new DomainError(
            "CONFLICT",
            "Application changed or is archived. Refresh before reviewing.",
          );
        if (
          !app &&
          (await tx.application.findFirst({
            where: {
              userId,
              company: { equals: value.company.trim(), mode: "insensitive" },
              title: { equals: value.title.trim(), mode: "insensitive" },
            },
          }))
        )
          throw new DomainError(
            "CONFLICT",
            "A matching company and role already exist. Select that application instead.",
          );
        const date = signal.receivedAt.toISOString().slice(0, 10);
        const appliedAt =
          app?.appliedAt ??
          (value.stage === "APPLIED" && value.appliedAt === date
            ? signal.receivedAt
            : new Date(`${value.appliedAt}T00:00:00.000Z`));
        const response = value.stage !== "APPLIED" ? signal.receivedAt : null;
        const firstResponseAt =
          response && (!app?.firstResponseAt || response < app.firstResponseAt)
            ? response
            : (app?.firstResponseAt ?? null);
        const valid = applicationInput.parse({
          company: app?.company ?? value.company,
          title: app?.title ?? value.title,
          appliedAt: Number.isNaN(appliedAt.getTime())
            ? "invalid"
            : appliedAt.toISOString().slice(0, 10),
          firstResponseAt: firstResponseAt?.toISOString().slice(0, 10) ?? "",
          stage: value.stage,
          workMode: app?.workMode ?? "UNKNOWN",
          url: app?.url ?? "",
        });
        if (signal.receivedAt < appliedAt)
          throw new DomainError(
            "CONFLICT",
            "This email predates submission. Correct the submission date in the tracker before linking it.",
          );
        const latest = app
          ? await tx.stageEvent.findFirst({
              where: { applicationId: app.id },
              orderBy: { occurredAt: "desc" },
            })
          : null;
        const historical = !!latest && signal.receivedAt < latest.occurredAt;
        const saved = app
          ? await tx.application.update({
              where: { id: app.id },
              data: {
                stage: historical ? app.stage : value.stage,
                appliedAt,
                firstResponseAt,
                version: { increment: 1 },
              },
            })
          : await tx.application.create({
              data: {
                userId,
                company: valid.company,
                title: valid.title,
                stage: value.stage,
                appliedAt,
                firstResponseAt,
              },
            });
        await tx.stageEvent.create({
          data: {
            applicationId: saved.id,
            fromStage: historical ? null : app?.stage,
            toStage: value.stage,
            source: "EMAIL",
            occurredAt: signal.receivedAt,
            idempotencyKey: `email:${signal.id}`,
          },
        });
        const accepted = await tx.emailSignal.updateMany({
          where: { id: signal.id, reviewStatus: "PENDING" },
          data: {
            applicationId: saved.id,
            reviewStatus: "ACCEPTED",
            reviewedAt: new Date(),
          },
        });
        if (!accepted.count)
          throw new DomainError(
            "CONFLICT",
            "Suggestion changed. Refresh and retry.",
          );
        await tx.auditLog.create({
          data: {
            userId,
            action: "outlook.review-accepted",
            entityType: "Application",
            entityId: saved.id,
            metadata: { historical },
          },
        });
        return { id: saved.id, historical };
      });
    },
    async disconnect(userId: string) {
      await db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
        await tx.verification.deleteMany({
          where: {
            identifier: {
              in: [`outlook:${userId}`, `outlook-completing:${userId}`],
            },
          },
        });
        await tx.outlookConnection.deleteMany({ where: { userId } });
        await tx.auditLog.create({
          data: {
            userId,
            action: "outlook.disconnected",
            entityType: "User",
            entityId: userId,
          },
        });
      });
    },
  };
}
