import "dotenv/config";
import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma/client";
import {
  applicationService,
  DomainError,
} from "../../src/server/application-service";
import { seedApplications } from "../../prisma/seed-data";
const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith("_test"))
  throw new Error(
    "TEST_DATABASE_URL must point to a dedicated database ending in _test.",
  );
const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: url, max: 4 }),
});
const service = applicationService(db);
const run = randomUUID();
let owner: string;
let other: string;
const input = {
  company: "Fixture Corp",
  title: "Engineer",
  location: "Remote",
  workMode: "REMOTE",
  stage: "APPLIED",
  url: "",
  notes: "",
  appliedAt: "2026-01-10",
  firstResponseAt: "",
};
before(async () => {
  owner = (
    await db.user.create({
      data: { name: "Owner", email: `owner-${run}@example.test` },
    })
  ).id;
  other = (
    await db.user.create({
      data: { name: "Other", email: `other-${run}@example.test` },
    })
  ).id;
});
after(async () => {
  await db.user.deleteMany({
    where: { id: { in: [owner, other].filter(Boolean) } },
  });
  await db.$disconnect();
});
test("database persists CRUD with stage history and an audit trail", async () => {
  const app = await service.create(owner, input);
  const updated = await service.update(
    owner,
    { id: app.id, version: 0 },
    { ...input, stage: "SCREENING", firstResponseAt: "2026-01-12" },
  );
  assert.equal(updated.version, 1);
  assert.equal(updated.stage, "SCREENING");
  assert.equal(
    await db.stageEvent.count({ where: { applicationId: app.id } }),
    2,
  );
  assert.equal(await db.auditLog.count({ where: { entityId: app.id } }), 2);
  const fresh = await db.application.findUniqueOrThrow({
    where: { id: app.id },
  });
  assert.equal(fresh.firstResponseAt?.toISOString().slice(0, 10), "2026-01-12");
});
test("another user cannot list, update, or archive owned applications", async () => {
  const app = await service.create(owner, { ...input, company: "Private" });
  assert.equal((await service.list(other, { query: "Private" })).total, 0);
  assert.equal((await service.overview(other)).length, 0);
  for (const action of [
    () => service.update(other, { id: app.id, version: 0 }, input),
    () => service.archive(other, { id: app.id, version: 0 }, true),
  ])
    await assert.rejects(
      action,
      (e: unknown) => e instanceof DomainError && e.code === "NOT_FOUND",
    );
  assert.equal(
    (await db.application.findUniqueOrThrow({ where: { id: app.id } })).version,
    0,
  );
});
test("concurrent edits commit once, and the losing transaction leaves no audit/event", async () => {
  const app = await service.create(owner, input);
  const results = await Promise.allSettled([
    service.update(
      owner,
      { id: app.id, version: 0 },
      { ...input, stage: "SCREENING", firstResponseAt: "2026-01-11" },
    ),
    service.update(
      owner,
      { id: app.id, version: 0 },
      { ...input, stage: "TECHNICAL", firstResponseAt: "2026-01-11" },
    ),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  const rejected = results.find((r) => r.status === "rejected");
  assert.ok(rejected && rejected.reason instanceof DomainError);
  assert.equal(rejected.reason.code, "CONFLICT");
  assert.equal(
    await db.stageEvent.count({ where: { applicationId: app.id } }),
    2,
  );
  assert.equal(await db.auditLog.count({ where: { entityId: app.id } }), 2);
});
test("archive is reversible and preserves historical overview", async () => {
  const app = await service.create(owner, {
    ...input,
    company: `Archive-${run}`,
  });
  await service.archive(owner, { id: app.id, version: 0 }, true);
  assert.equal(
    (await service.list(owner, { query: `Archive-${run}` })).total,
    0,
  );
  assert.equal(
    (await service.list(owner, { query: `Archive-${run}`, archived: true }))
      .total,
    1,
  );
  assert.ok((await service.overview(owner)).some((a) => a.id === app.id));
  await service.archive(owner, { id: app.id, version: 1 }, false);
  assert.equal(
    (await service.list(owner, { query: `Archive-${run}` })).total,
    1,
  );
});
test("invalid edits leave row and audit history unchanged", async () => {
  const app = await service.create(owner, input);
  await assert.rejects(() =>
    service.update(
      owner,
      { id: app.id, version: 0 },
      { ...input, firstResponseAt: "2026-01-01" },
    ),
  );
  assert.equal(
    (await db.application.findUniqueOrThrow({ where: { id: app.id } })).version,
    0,
  );
  assert.equal(await db.auditLog.count({ where: { entityId: app.id } }), 1);
});
test("SQL constraints reject invalid data even without service validation", async () => {
  await assert.rejects(() =>
    db.application.create({
      data: {
        userId: owner,
        company: "Bad",
        title: "Bad",
        salaryMin: 200,
        salaryMax: 100,
      },
    }),
  );
  await assert.rejects(() =>
    db.application.create({
      data: {
        userId: owner,
        company: "Bad",
        title: "Bad",
        firstResponseAt: new Date(),
      },
    }),
  );
});
test("search, stage filtering and pagination compose", async () => {
  const key = `Page-${run}`;
  await db.application.createMany({
    data: Array.from({ length: 23 }, (_, i) => ({
      userId: owner,
      company: key,
      title: `Role ${i}`,
      stage: "APPLIED" as const,
      appliedAt: new Date("2026-01-10"),
    })),
  });
  const first = await service.list(owner, {
    query: key,
    stage: "APPLIED",
    page: 1,
  });
  const second = await service.list(owner, {
    query: key,
    stage: "APPLIED",
    page: 2,
  });
  assert.equal(first.total, 23);
  assert.equal(first.rows.length, 20);
  assert.equal(second.rows.length, 3);
  assert.equal(
    new Set([...first.rows, ...second.rows].map((a) => a.id)).size,
    23,
  );
  assert.equal((await service.list(other, { query: key })).total, 0);
});
test("synthetic seed is idempotent and does not overwrite edits", async () => {
  await seedApplications(db, other);
  assert.equal(await db.application.count({ where: { userId: other } }), 12);
  const first = await db.application.findFirstOrThrow({
    where: { userId: other },
  });
  await db.application.update({
    where: { id: first.id },
    data: { notes: "User edited" },
  });
  await seedApplications(db, other);
  assert.equal(await db.application.count({ where: { userId: other } }), 12);
  assert.equal(
    (await db.application.findUniqueOrThrow({ where: { id: first.id } })).notes,
    "User edited",
  );
});
