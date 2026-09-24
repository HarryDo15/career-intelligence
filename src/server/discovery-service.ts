import type { PrismaClient } from "@/generated/prisma/client";
import { DomainError } from "./application-service";
import {
  profileInput,
  profileMeta,
  jobIdInput,
  discoveryEvent,
  hourSlot,
} from "@/features/discovery/validation";
import {
  listingBatch,
  mockProvider,
  matchJob,
  type JobProvider,
  type ProfileRow,
  type DiscoveredRow,
} from "@/lib/jobs";
export function discoveryService(
  db: PrismaClient,
  provider: JobProvider = mockProvider,
) {
  return {
    async profiles(userId: string): Promise<ProfileRow[]> {
      const profiles = await db.searchProfile.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        include: { runs: { orderBy: { startedAt: "desc" }, take: 1 } },
      });
      return profiles.map((p) => ({
        id: p.id,
        version: p.version,
        name: p.name,
        titles: p.titles,
        keywords: p.keywords,
        excludedKeywords: p.excludedKeywords,
        locations: p.locations,
        workModes: p.workModes.filter(
          (v): v is "REMOTE" | "HYBRID" | "ONSITE" => v !== "UNKNOWN",
        ),
        enabled: p.enabled,
        lastRunAt: p.lastRunAt?.toISOString() ?? null,
        lastStatus: p.runs[0]?.dedupeKey.includes(`:v${p.version}:`)
          ? p.runs[0].status
          : null,
        lastResultCount: p.runs[0]?.dedupeKey.includes(`:v${p.version}:`)
          ? p.runs[0].resultCount
          : null,
      }));
    },
    async saveProfile(userId: string, input: unknown, meta?: unknown) {
      const data = profileInput.parse(input);
      if (meta) {
        const { id, version } = profileMeta.parse(meta);
        return db.$transaction(async (tx) => {
          if (!(await tx.searchProfile.findFirst({ where: { id, userId } })))
            throw new DomainError("NOT_FOUND", "Search profile not found.");
          const changed = await tx.searchProfile.updateMany({
            where: { id, userId, version },
            data: { ...data, lastRunAt: null, version: { increment: 1 } },
          });
          if (!changed.count)
            throw new DomainError(
              "CONFLICT",
              "This search profile changed. Refresh and try again.",
            );
          // Matches represent the latest profile definition, not stale prior filters.
          await tx.jobMatch.deleteMany({ where: { profileId: id } });
          return tx.searchProfile.findUniqueOrThrow({ where: { id } });
        });
      }
      return db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
        if ((await tx.searchProfile.count({ where: { userId } })) >= 10)
          throw new DomainError(
            "CONFLICT",
            "You can have up to 10 search profiles.",
          );
        return tx.searchProfile.create({ data: { ...data, userId } });
      });
    },
    async removeProfile(userId: string, meta: unknown) {
      const { id, version } = profileMeta.parse(meta);
      const result = await db.searchProfile.deleteMany({
        where: { id, userId, version },
      });
      if (!result.count)
        throw new DomainError(
          "CONFLICT",
          "Profile missing or changed. Refresh and try again.",
        );
    },
    async listJobs(userId: string, view = "new", page = 1) {
      const where = {
        userId,
        ...(view === "dismissed"
          ? { dismissedAt: { not: null } }
          : { dismissedAt: null }),
        ...(view === "saved"
          ? { application: { isNot: null } }
          : view === "new"
            ? { application: { is: null } }
            : {}),
      };
      const [total, rows] = await db.$transaction([
        db.discoveredJob.count({ where }),
        db.discoveredJob.findMany({
          where,
          orderBy: [{ discoveredAt: "desc" }, { id: "asc" }],
          take: 20,
          skip: (page - 1) * 20,
          include: {
            application: { select: { id: true } },
            matches: {
              where: { profile: { userId } },
              include: { profile: { select: { name: true } } },
              orderBy: { score: "desc" },
            },
          },
        }),
      ]);
      return {
        total,
        page,
        rows: rows.map((j) => ({
          id: j.id,
          externalId: j.externalId,
          canonicalUrl: j.canonicalUrl,
          company: j.company,
          title: j.title,
          description: j.description,
          location: j.location ?? "",
          workMode: j.workMode as DiscoveredRow["workMode"],
          publishedAt: j.publishedAt?.toISOString() ?? "",
          discoveredAt: j.discoveredAt.toISOString(),
          dismissedAt: j.dismissedAt?.toISOString() ?? null,
          applicationId: j.application?.id ?? null,
          matches: j.matches.map((m) => ({
            name: m.profile.name,
            score: m.score,
            reasons: m.reasons,
          })),
        })),
      };
    },
    async saveJob(userId: string, input: unknown) {
      const id = jobIdInput.parse(input);
      return db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "DiscoveredJob" WHERE id = ${id} AND "userId" = ${userId} FOR UPDATE`;
        const job = await tx.discoveredJob.findFirst({ where: { id, userId } });
        if (!job)
          throw new DomainError("NOT_FOUND", "Discovered job not found.");
        const existing = await tx.application.findUnique({
          where: { discoveredJobId: id },
        });
        if (existing) {
          if (existing.userId !== userId)
            throw new DomainError("NOT_FOUND", "Application not found.");
          return existing.id;
        }
        const a = await tx.application.create({
          data: {
            userId,
            discoveredJobId: id,
            company: job.company,
            title: job.title,
            url: job.canonicalUrl,
            description: job.description,
            location: job.location,
            workMode: job.workMode,
            stage: "WISHLIST",
          },
        });
        await tx.stageEvent.create({
          data: {
            applicationId: a.id,
            toStage: "WISHLIST",
            source: "IMPORT",
            occurredAt: new Date(),
            idempotencyKey: `discovered:${id}`,
          },
        });
        await tx.auditLog.create({
          data: {
            userId,
            action: "discovery.saved",
            entityType: "Application",
            entityId: a.id,
          },
        });
        await tx.discoveredJob.update({
          where: { id },
          data: { dismissedAt: null },
        });
        return a.id;
      });
    },
    async dismiss(userId: string, input: unknown, dismissed: boolean) {
      const id = jobIdInput.parse(input);
      const changed = await db.discoveredJob.updateMany({
        where: { id, userId },
        data: { dismissedAt: dismissed ? new Date() : null },
      });
      if (!changed.count)
        throw new DomainError("NOT_FOUND", "Discovered job not found.");
    },
    async run(input: unknown) {
      const event = discoveryEvent.parse(input);
      const { profileId, userId, version, slot } = event;
      const profile = await db.searchProfile.findFirst({
        where: { id: profileId, userId, version, enabled: true },
      });
      if (!profile) return { skipped: true, count: 0 };
      const key = `discovery:${provider.name}:${profileId}:v${version}:${slot}`;
      const previous = await db.workflowRun.findUnique({
        where: { dedupeKey: key },
      });
      if (previous?.status === "SUCCEEDED")
        return { skipped: false, count: previous.resultCount };
      let listings;
      try {
        listings = listingBatch.parse(
          await provider.search(profileInput.parse(profile)),
        );
      } catch {
        const recovered = await db.$transaction(async (tx) => {
          await tx.$queryRaw`SELECT id FROM "SearchProfile" WHERE id = ${profileId} AND "userId" = ${userId} FOR UPDATE`;
          if (
            !(await tx.searchProfile.findFirst({
              where: { id: profileId, userId, version, enabled: true },
            }))
          )
            return { skipped: true, count: 0 };
          const existing = await tx.workflowRun.findUnique({
            where: { dedupeKey: key },
          });
          if (existing?.status === "SUCCEEDED")
            return { skipped: false, count: existing.resultCount };
          await tx.workflowRun.upsert({
            where: { dedupeKey: key },
            create: {
              userId,
              profileId,
              workflow: "discovery",
              dedupeKey: key,
              status: "FAILED",
              attempts: 1,
              errorCode: "PROVIDER_FAILED",
              finishedAt: new Date(),
            },
            update: {
              status: "FAILED",
              attempts: { increment: 1 },
              errorCode: "PROVIDER_FAILED",
              finishedAt: new Date(),
            },
          });
          return null;
        });
        if (recovered) return recovered;
        throw new Error("Job provider failed; retry this run.");
      }
      return db.$transaction(
        async (tx) => {
          await tx.$queryRaw`SELECT id FROM "SearchProfile" WHERE id = ${profileId} AND "userId" = ${userId} FOR UPDATE`;
          const current = await tx.searchProfile.findFirst({
            where: { id: profileId, userId, version, enabled: true },
          });
          if (!current) return { skipped: true, count: 0 };
          const completed = await tx.workflowRun.findUnique({
            where: { dedupeKey: key },
          });
          if (completed?.status === "SUCCEEDED")
            return { skipped: false, count: completed.resultCount };
          let count = 0;
          for (const listing of listings) {
            const match = matchJob(listing, profileInput.parse(current));
            if (!match) continue;
            const job = await tx.discoveredJob.upsert({
              where: {
                userId_provider_externalId: {
                  userId,
                  provider: provider.name,
                  externalId: listing.externalId,
                },
              },
              create: {
                ...listing,
                userId,
                provider: provider.name,
                publishedAt: new Date(listing.publishedAt),
              },
              update: {
                title: listing.title,
                description: listing.description,
                location: listing.location,
                workMode: listing.workMode,
              },
            });
            await tx.jobMatch.upsert({
              where: { profileId_jobId: { profileId, jobId: job.id } },
              create: { profileId, jobId: job.id, ...match },
              update: match,
            });
            count++;
          }
          await tx.searchProfile.update({
            where: { id: profileId },
            data: { lastRunAt: new Date() },
          });
          await tx.workflowRun.upsert({
            where: { dedupeKey: key },
            create: {
              userId,
              profileId,
              workflow: "discovery",
              dedupeKey: key,
              status: "SUCCEEDED",
              attempts: 1,
              resultCount: count,
              finishedAt: new Date(),
            },
            update: {
              status: "SUCCEEDED",
              attempts: { increment: 1 },
              resultCount: count,
              errorCode: null,
              finishedAt: new Date(),
            },
          });
          return { skipped: false, count };
        },
        { timeout: 15000 },
      );
    },
    async runManual(userId: string, input: unknown) {
      const { id, version } = profileMeta.parse(input);
      return this.run({ profileId: id, userId, version, slot: hourSlot() });
    },
  };
}
