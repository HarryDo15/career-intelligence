import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { discoveryService } from "../src/server/discovery-service";
import { hourSlot } from "../src/features/discovery/validation";
const origin = process.env.APP_URL!;
if (
  !["localhost", "127.0.0.1"].includes(new URL(origin).hostname) ||
  process.env.INNGEST_DEV !== "1"
)
  throw new Error(
    "Workflow smoke requires explicit loopback Inngest development mode.",
  );
const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
const run = randomUUID();
let userId: string | undefined;
try {
  const response = await fetch(origin + "/api/inngest");
  assert.equal(response.status, 200, "App workflow endpoint must be enabled.");
  userId = (
    await db.user.create({
      data: { name: "Workflow smoke", email: `workflow-${run}@example.test` },
    })
  ).id;
  const profile = await discoveryService(db).saveProfile(userId, {
    name: "Workflow fixture",
    titles: ["engineer"],
    keywords: ["react"],
    excludedKeywords: ["intern"],
    locations: ["Singapore"],
    workModes: ["REMOTE"],
    enabled: true,
  });
  const slot = hourSlot();
  const data = { userId, profileId: profile.id, version: 0, slot };
  async function send(id: string) {
    const r = await fetch("http://127.0.0.1:8288/e/dev", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "career/discovery.requested", id, data }),
    });
    assert.equal(r.status, 200, await r.clone().text());
  }
  await send(`workflow-${run}`);
  await send(`workflow-${run}`);
  const end = Date.now() + 45000;
  let complete = false;
  while (Date.now() < end) {
    const log = await db.workflowRun.findFirst({
      where: { profileId: profile.id, status: "SUCCEEDED" },
    });
    if (log) {
      assert.equal(log.resultCount, 1);
      complete = true;
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  assert.ok(
    complete,
    "Background discovery did not finish within 45 seconds. Ensure Inngest has synchronized the app.",
  );
  assert.equal(await db.discoveredJob.count({ where: { userId } }), 1);
  assert.equal(
    await db.jobMatch.count({ where: { profileId: profile.id } }),
    1,
  );
  assert.equal(
    await db.workflowRun.count({ where: { profileId: profile.id } }),
    1,
  );
  console.log(
    "Workflow smoke passed: event delivered through local Inngest, matching jobs persisted, duplicate delivery produces one listing and run.",
  );
} finally {
  if (userId) await db.user.delete({ where: { id: userId } });
  await db.$disconnect();
}
