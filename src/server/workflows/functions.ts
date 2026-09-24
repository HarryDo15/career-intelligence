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
export const functions = [hourlyDiscovery, discoverProfile];
