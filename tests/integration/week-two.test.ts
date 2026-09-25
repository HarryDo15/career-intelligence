import "dotenv/config";
import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma/client";
import { discoveryService } from "../../src/server/discovery-service";
import {
  applicationService,
  DomainError,
} from "../../src/server/application-service";
import { getAnalytics } from "../../src/server/analytics-service";
import {
  mockProvider,
  mockListings,
  type JobProvider,
} from "../../src/lib/jobs";
const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith("_test"))
  throw new Error("Use TEST_DATABASE_URL ending in _test.");
const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: url, max: 5 }),
});
const discovery = discoveryService(db);
const apps = applicationService(db);
const run = randomUUID();
let owner: string;
let other: string;
const input = {
  name: "Engineering",
  titles: ["engineer"],
  keywords: ["react"],
  excludedKeywords: ["intern"],
  locations: ["Singapore"],
  workModes: ["REMOTE"],
  enabled: true,
};
const application = {
  company: "Week2",
  title: "Engineer",
  location: "",
  workMode: "REMOTE",
  stage: "WISHLIST",
  url: "",
  notes: "",
  appliedAt: "",
  firstResponseAt: "",
};
before(async () => {
  owner = (
    await db.user.create({
      data: { name: "Week2 owner", email: `week2-${run}@example.test` },
    })
  ).id;
  other = (
    await db.user.create({
      data: { name: "Week2 other", email: `week2-other-${run}@example.test` },
    })
  ).id;
});
after(async () => {
  await db.user.deleteMany({
    where: { id: { in: [owner, other].filter(Boolean) } },
  });
  await db.$disconnect();
});
test("repeated and concurrent discovery produces one listing and match per profile", async () => {
  const profile = await discovery.saveProfile(owner, input);
  const event = {
    userId: owner,
    profileId: profile.id,
    version: 0,
    slot: "2026-09-24T10",
  };
  await Promise.all([discovery.run(event), discovery.run(event)]);
  await discovery.run({ ...event, slot: "2026-09-24T11" });
  assert.equal(await db.discoveredJob.count({ where: { userId: owner } }), 1);
  assert.equal(
    await db.jobMatch.count({ where: { profileId: profile.id } }),
    1,
  );
  assert.equal(
    await db.workflowRun.count({
      where: { profileId: profile.id, status: "SUCCEEDED" },
    }),
    2,
  );
});
test("multiple matching profiles share a listing and saving concurrently creates one Wishlist application", async () => {
  const profile = await discovery.saveProfile(owner, {
    ...input,
    name: "Another search",
  });
  await discovery.run({
    userId: owner,
    profileId: profile.id,
    version: 0,
    slot: "2026-09-24T12",
  });
  const jobs = await discovery.listJobs(owner);
  assert.equal(jobs.total, 1);
  assert.equal(jobs.rows[0].matches.length, 2);
  const id = jobs.rows[0].id;
  const saved = await Promise.all([
    discovery.saveJob(owner, id),
    discovery.saveJob(owner, id),
  ]);
  assert.equal(saved[0], saved[1]);
  const app = await db.application.findUniqueOrThrow({
    where: { id: saved[0] },
  });
  assert.equal(app.stage, "WISHLIST");
  assert.equal(app.appliedAt, null);
  assert.equal(
    await db.stageEvent.count({ where: { applicationId: app.id } }),
    1,
  );
  assert.equal((await discovery.listJobs(owner, "new")).total, 0);
  assert.equal((await discovery.listJobs(owner, "saved")).total, 1);
});
test("cross-user profile changes, jobs and workflow events cannot affect another user", async () => {
  const profile = await db.searchProfile.findFirstOrThrow({
    where: { userId: owner },
  });
  const job = await db.discoveredJob.findFirstOrThrow({
    where: { userId: owner },
  });
  await assert.rejects(
    () => discovery.saveJob(other, job.id),
    (e) => e instanceof DomainError && e.code === "NOT_FOUND",
  );
  await assert.rejects(() => discovery.dismiss(other, job.id, true));
  await assert.rejects(() =>
    discovery.saveProfile(other, input, { id: profile.id, version: 0 }),
  );
  assert.deepEqual(
    await discovery.run({
      userId: other,
      profileId: profile.id,
      version: 0,
      slot: "2026-09-24T13",
    }),
    { skipped: true, count: 0 },
  );
  assert.equal((await discovery.listJobs(other)).total, 0);
  assert.equal((await discovery.profiles(other)).length, 0);
});
test("a profile edited or paused during provider work cannot persist stale results", async () => {
  const profile = await discovery.saveProfile(owner, input);
  let release!: () => void;
  let entered!: () => void;
  const waiting = new Promise<void>((r) => {
    entered = r;
  });
  const hold = new Promise<void>((r) => {
    release = r;
  });
  const provider: JobProvider = {
    name: "mock",
    async search() {
      entered();
      await hold;
      return mockListings;
    },
  };
  const running = discoveryService(db, provider).run({
    userId: owner,
    profileId: profile.id,
    version: 0,
    slot: "2026-09-24T14",
  });
  await waiting;
  await discovery.saveProfile(
    owner,
    { ...input, enabled: false },
    { id: profile.id, version: 0 },
  );
  release();
  assert.deepEqual(await running, { skipped: true, count: 0 });
  assert.equal(
    await db.jobMatch.count({ where: { profileId: profile.id } }),
    0,
  );
  await assert.rejects(
    () => discovery.saveProfile(owner, input, { id: profile.id, version: 0 }),
    (e) => e instanceof DomainError && e.code === "CONFLICT",
  );
});
test("provider failure records a safe error and retry recovers the same run", async () => {
  const profile = await discovery.saveProfile(owner, input);
  const event = {
    userId: owner,
    profileId: profile.id,
    version: 0,
    slot: "2026-09-24T15",
  };
  const broken: JobProvider = {
    name: "mock",
    async search() {
      throw new Error("secret provider details");
    },
  };
  await assert.rejects(() => discoveryService(db, broken).run(event));
  let log = await db.workflowRun.findFirstOrThrow({
    where: { profileId: profile.id },
  });
  assert.equal(log.status, "FAILED");
  assert.equal(log.errorCode, "PROVIDER_FAILED");
  await discoveryService(db, mockProvider).run(event);
  log = await db.workflowRun.findFirstOrThrow({
    where: { profileId: profile.id },
  });
  assert.equal(log.status, "SUCCEEDED");
  assert.equal(log.attempts, 2);
  assert.equal(log.errorCode, null);
});
test("dismiss/restore and profile deletion preserve saved applications", async () => {
  const job = await db.discoveredJob.findFirstOrThrow({
    where: { userId: owner },
  });
  await discovery.dismiss(owner, job.id, true);
  assert.equal((await discovery.listJobs(owner, "dismissed")).total, 1);
  await discovery.dismiss(owner, job.id, false);
  assert.equal((await discovery.listJobs(owner, "saved")).total, 1);
  const profile = await db.searchProfile.findFirstOrThrow({
    where: { userId: owner },
  });
  await discovery.removeProfile(owner, {
    id: profile.id,
    version: profile.version,
  });
  assert.equal(
    await db.application.count({
      where: { userId: owner, discoveredJobId: job.id },
    }),
    1,
  );
});
test("board moves require dates, preserve exact existing timestamps, and reject stale and cross-user writes", async () => {
  const app = await apps.create(owner, application);
  await assert.rejects(() =>
    apps.move(owner, { id: app.id, version: 0 }, { stage: "APPLIED" }),
  );
  const moved = await apps.move(
    owner,
    { id: app.id, version: 0 },
    {
      stage: "SCREENING",
      appliedAt: "2026-03-01",
      firstResponseAt: "2026-03-02",
    },
  );
  assert.equal(moved.version, 1);
  await assert.rejects(() =>
    apps.move(other, { id: app.id, version: 1 }, { stage: "REJECTED" }),
  );
  await assert.rejects(() =>
    apps.move(owner, { id: app.id, version: 0 }, { stage: "REJECTED" }),
  );
  const exact = new Date("2026-03-02T14:45:00.000Z");
  await db.application.update({
    where: { id: app.id },
    data: { firstResponseAt: exact },
  });
  await apps.move(owner, { id: app.id, version: 1 }, { stage: "REJECTED" });
  assert.equal(
    (
      await db.application.findUniqueOrThrow({ where: { id: app.id } })
    ).firstResponseAt?.toISOString(),
    exact.toISOString(),
  );
  const board = await apps.board(owner, "Week2");
  assert.equal(board.find((c) => c.stage === "REJECTED")?.total, 1);
  assert.ok((await apps.board(other)).every((c) => c.total === 0));
});
test("analytics derives historical conversion from persisted stage events and isolates owners", async () => {
  const result = await getAnalytics(db, owner, {
    start: "2026-03-01",
    end: "2026-03-31",
    group: "month",
    timezone: "UTC",
  });
  assert.equal(result.total, 1);
  assert.equal(result.interviewed, 1);
  assert.equal(result.interviewRate, 100);
  assert.equal(result.statuses.find((s) => s.stage === "REJECTED")?.count, 1);
  const otherResult = await getAnalytics(db, other, {
    start: "2026-03-01",
    end: "2026-03-31",
    group: "week",
    timezone: "UTC",
  });
  assert.equal(otherResult.total, 0);
});
test("profile limit is enforced inside a transaction", async () => {
  for (let i = 0; i < 10; i++)
    await discovery.saveProfile(other, { ...input, name: `Limit ${i}` });
  await assert.rejects(
    () => discovery.saveProfile(other, input),
    (e) => e instanceof DomainError && e.code === "CONFLICT",
  );
});

test("late provider failure cannot overwrite a completed run", async () => {
  const profile = await discovery.saveProfile(owner, input);
  const event = {
    userId: owner,
    profileId: profile.id,
    version: 0,
    slot: "2026-09-24T20",
  };
  let release!: () => void;
  let entered!: () => void;
  const ready = new Promise<void>((r) => {
    entered = r;
  });
  const hold = new Promise<void>((r) => {
    release = r;
  });
  const slow: JobProvider = {
    name: "mock",
    async search() {
      entered();
      await hold;
      throw new Error("late error");
    },
  };
  const failing = discoveryService(db, slow).run(event);
  await ready;
  await discovery.run(event);
  release();
  const recovered = await failing;
  assert.equal(recovered.count, 1);
  assert.equal(
    (
      await db.workflowRun.findFirstOrThrow({
        where: { profileId: profile.id },
      })
    ).status,
    "SUCCEEDED",
  );
});
test("invalid provider URLs never become saved listings", async () => {
  const profile = await discovery.saveProfile(owner, input);
  const unsafe: JobProvider = {
    name: "unsafe",
    async search() {
      return [{ ...mockListings[0], canonicalUrl: "javascript:alert(1)" }];
    },
  };
  await assert.rejects(() =>
    discoveryService(db, unsafe).run({
      userId: owner,
      profileId: profile.id,
      version: 0,
      slot: "2026-09-24T21",
    }),
  );
  assert.equal(
    await db.discoveredJob.count({
      where: { userId: owner, provider: "unsafe" },
    }),
    0,
  );
});
