import { z } from "zod";
import { outlookSync } from "@/server/outlook/sync";
import { inngest } from "./client";
import { getDb } from "@/server/db";
import { discoveryService } from "@/server/discovery-service";
import { discoveryEvent, hourSlot } from "@/features/discovery/validation";
export const hourlyDiscovery = inngest.createFunction(
  { id: "hourly-job-discovery", triggers: { cron: "0 * * * *" }, retries: 3 },
  async ({ event, step }) => {
    const slot = hourSlot(new Date(event.ts ?? Date.now()));
    let cursor: string | undefined;
    let batch = 0;
    let dispatched = 0;
    while (true) {
      const after = cursor;
      const profiles = await step.run(`profiles-${batch}`, () =>
        getDb().searchProfile.findMany({
          where: { enabled: true, ...(after ? { id: { gt: after } } : {}) },
          orderBy: { id: "asc" },
          take: 100,
          select: { id: true, userId: true, version: true },
        }),
      );
      if (!profiles.length) break;
      await step.sendEvent(
        `dispatch-${batch}`,
        profiles.map((p) => ({
          name: "career/discovery.requested",
          id: `discovery-${p.id}-${p.version}-${slot}`,
          data: { profileId: p.id, userId: p.userId, version: p.version, slot },
        })),
      );
      dispatched += profiles.length;
      cursor = profiles[profiles.length - 1].id;
      batch++;
      if (profiles.length < 100) break;
    }
    return { dispatched };
  },
);
export const discoverProfile = inngest.createFunction(
  {
    id: "discover-profile",
    triggers: { event: "career/discovery.requested" },
    concurrency: { limit: 1, key: "event.data.profileId" },
    retries: 3,
  },
  async ({ event, step }) => {
    const input = discoveryEvent.parse(event.data);
    return step.run("match-and-save", () =>
      discoveryService(getDb()).run(input),
    );
  },
);
export const scheduleMail = inngest.createFunction(
  {
    id: "schedule-outlook-sync",
    triggers: { cron: "*/10 * * * *" },
    retries: 3,
  },
  async ({ step }) => {
    let cursor: string | undefined;
    let batch = 0;
    while (true) {
      const after = cursor;
      const connections = await step.run(`mailboxes-${batch}`, () =>
        getDb().outlookConnection.findMany({
          where: {
            reauthRequired: false,
            ...(after ? { id: { gt: after } } : {}),
          },
          orderBy: { id: "asc" },
          take: 100,
          select: { id: true, userId: true },
        }),
      );
      if (!connections.length) break;
      await step.sendEvent(
        `sync-${batch}`,
        connections.map((c) => ({
          name: "career/outlook.sync",
          data: { connectionId: c.id, userId: c.userId },
        })),
      );
      cursor = connections[connections.length - 1].id;
      batch++;
      if (connections.length < 100) break;
    }
  },
);
export const syncMailbox = inngest.createFunction(
  {
    id: "sync-outlook-mailbox",
    triggers: { event: "career/outlook.sync" },
    concurrency: { limit: 1, key: "event.data.connectionId" },
    retries: 3,
  },
  async ({ event, step }) => {
    const input = z
      .object({
        connectionId: z.string().min(1).max(128),
        userId: z.string().min(1).max(128),
      })
      .parse(event.data);
    let total = 0;
    for (let page = 0; page < 20; page++) {
      const result = await step.run(`mail-page-${page}`, () =>
        outlookSync(getDb())(input.userId, input.connectionId),
      );
      total += result.count;
      if (!result.more) break;
    }
    return { suggestions: total };
  },
);
export const functions = [
  hourlyDiscovery,
  discoverProfile,
  scheduleMail,
  syncMailbox,
];
