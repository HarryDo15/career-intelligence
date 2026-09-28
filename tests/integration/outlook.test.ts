import "dotenv/config";
import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma/client";
import { outlookSync, type MailProvider } from "../../src/server/outlook/sync";
import { outlookReview } from "../../src/server/outlook/review";
import { seal } from "../../src/server/outlook/crypto";
import {
  consumeOutlookState,
  storeOutlookConnection,
} from "../../src/server/outlook/oauth";
import { MailError } from "../../src/server/outlook/graph";
const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith("_test"))
  throw new Error("Use a dedicated _test database.");
process.env.TOKEN_ENCRYPTION_KEY = "b".repeat(64);
const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: url, max: 5 }),
});
const users: string[] = [];
const review = outlookReview(db);
const graphUrl =
  "https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages/delta?$deltatoken=fixture";
const date = new Date(Date.now() - 86400_000).toISOString();
const mail = (id = randomUUID()) => ({
  id,
  receivedDateTime: date,
  subject: "Application received",
  bodyPreview: "Thank you for applying for Engineer at Fixture Corp.",
});
async function fixture() {
  const user = await db.user.create({
    data: { name: "Fixture", email: `${randomUUID()}@example.test` },
  });
  users.push(user.id);
  const connection = await db.outlookConnection.create({
    data: {
      userId: user.id,
      microsoftAccountId: randomUUID(),
      encryptedTokenCache: seal("fixture-cache", `tokens:${user.id}`),
      scopes: ["Mail.Read"],
      importSince: new Date(Date.now() - 30 * 86400_000),
    },
  });
  return { userId: user.id, connectionId: connection.id };
}
const provider = (messages = [mail()]): MailProvider => ({
  refresh: async () => ({ token: "fixture-token", cache: "fixture-cache" }),
  page: async () => ({ messages, delta: graphUrl }),
});
after(async () => {
  await db.user.deleteMany({ where: { id: { in: users } } });
  await db.verification.deleteMany({
    where: {
      identifier: {
        in: users.flatMap((u) => [`outlook:${u}`, `outlook-completing:${u}`]),
      },
    },
  });
  await db.$disconnect();
});
before(() => {
  assert.ok(url);
});
test("sync stores encrypted source and cursor, repeat delivery is idempotent", async () => {
  const f = await fixture(),
    p = provider(),
    run = outlookSync(db, p);
  assert.equal((await run(f.userId, f.connectionId)).count, 1);
  assert.equal((await run(f.userId, f.connectionId)).count, 0);
  const signal = await db.emailSignal.findFirstOrThrow({
    where: { connectionId: f.connectionId },
  });
  assert.ok(!signal.encryptedPayload?.includes("Fixture Corp"));
  assert.equal(
    (await review.list(f.userId)).rows[0].source.company,
    "Fixture Corp",
  );
  assert.equal(await db.application.count({ where: { userId: f.userId } }), 0);
});
test("wrong user cannot sync, read, dismiss, or approve another mailbox", async () => {
  const a = await fixture(),
    b = await fixture();
  const sync = outlookSync(db, provider());
  assert.equal((await sync(b.userId, a.connectionId)).status, "unavailable");
  await sync(a.userId, a.connectionId);
  const row = (await review.list(a.userId)).rows[0];
  assert.equal((await review.list(b.userId)).total, 0);
  await assert.rejects(() => review.dismiss(b.userId, row.id));
  await assert.rejects(() =>
    review.accept(b.userId, {
      id: row.id,
      company: "Fixture",
      title: "Engineer",
      appliedAt: date.slice(0, 10),
      stage: "APPLIED",
    }),
  );
});
test("concurrent sync claims one lease and only fetches one page", async () => {
  const f = await fixture();
  let calls = 0;
  const p = provider();
  p.page = async () => {
    calls++;
    await new Promise((r) => setTimeout(r, 30));
    return { messages: [mail()], delta: graphUrl };
  };
  const run = outlookSync(db, p);
  await Promise.all([
    run(f.userId, f.connectionId),
    run(f.userId, f.connectionId),
  ]);
  assert.equal(calls, 1);
});
test("disconnect during a fetch cancels persistence and preserves approved applications", async () => {
  const f = await fixture(),
    p = provider();
  p.page = async () => {
    await review.disconnect(f.userId);
    return { messages: [mail()], delta: graphUrl };
  };
  assert.equal(
    (await outlookSync(db, p)(f.userId, f.connectionId)).status,
    "disconnected",
  );
  assert.equal(
    await db.emailSignal.count({ where: { connectionId: f.connectionId } }),
    0,
  );
});
test("429 persists delay and suppresses early retries; 410 clears cursor", async () => {
  const f = await fixture(),
    p = provider();
  await outlookSync(db, p)(f.userId, f.connectionId);
  p.page = async () => {
    throw new MailError("THROTTLED", 120);
  };
  assert.equal(
    (await outlookSync(db, p)(f.userId, f.connectionId)).status,
    "THROTTLED",
  );
  assert.equal(
    (await outlookSync(db, p)(f.userId, f.connectionId)).status,
    "unavailable",
  );
  await db.outlookConnection.update({
    where: { id: f.connectionId },
    data: { nextSyncAt: null },
  });
  p.page = async () => {
    throw new MailError("CURSOR_EXPIRED");
  };
  assert.equal(
    (await outlookSync(db, p)(f.userId, f.connectionId)).status,
    "CURSOR_EXPIRED",
  );
  assert.equal(
    await db.mailSyncCursor.count({ where: { connectionId: f.connectionId } }),
    0,
  );
});
test("expired consent is visible and blocks subsequent background reads", async () => {
  const f = await fixture(),
    p = provider();
  p.refresh = async () => {
    throw new MailError("REAUTH_REQUIRED");
  };
  await outlookSync(db, p)(f.userId, f.connectionId);
  assert.equal(
    (
      await db.outlookConnection.findUniqueOrThrow({
        where: { id: f.connectionId },
      })
    ).reauthRequired,
    true,
  );
});
test("concurrent approval creates one application and stage event, disconnect preserves it", async () => {
  const f = await fixture();
  await outlookSync(db, provider())(f.userId, f.connectionId);
  const row = (await review.list(f.userId)).rows[0];
  const input = {
    id: row.id,
    company: "Fixture Corp",
    title: "Engineer",
    appliedAt: date.slice(0, 10),
    stage: "APPLIED",
  };
  const results = await Promise.all([
    review.accept(f.userId, input),
    review.accept(f.userId, input),
  ]);
  assert.equal(results[0].id, results[1].id);
  const app = await db.application.findUniqueOrThrow({
    where: { id: results[0].id! },
  });
  assert.equal(app.appliedAt?.toISOString(), date);
  assert.equal(
    await db.stageEvent.count({ where: { applicationId: app.id } }),
    1,
  );
  await review.disconnect(f.userId);
  assert.equal(await db.application.count({ where: { id: app.id } }), 1);
  assert.equal(
    await db.emailSignal.count({ where: { connectionId: f.connectionId } }),
    0,
  );
});
test("late email adds history without regressing stage; stale review rejected", async () => {
  const f = await fixture();
  const app = await db.application.create({
    data: {
      userId: f.userId,
      company: "Fixture",
      title: "Engineer",
      stage: "OFFER",
      appliedAt: new Date(Date.now() - 5 * 86400_000),
      firstResponseAt: new Date(Date.now() - 3 * 86400_000),
    },
  });
  await db.stageEvent.create({
    data: {
      applicationId: app.id,
      toStage: "OFFER",
      source: "MANUAL",
      occurredAt: new Date(),
      idempotencyKey: randomUUID(),
    },
  });
  await outlookSync(
    db,
    provider([
      {
        ...mail(),
        subject: "Technical interview invitation",
        bodyPreview: "Please join our technical interview.",
      },
    ]),
  )(f.userId, f.connectionId);
  const row = (await review.list(f.userId)).rows[0];
  const input = {
    id: row.id,
    applicationId: app.id,
    version: 5,
    company: "",
    title: "",
    appliedAt: "",
    stage: "TECHNICAL",
  };
  await assert.rejects(() => review.accept(f.userId, input));
  assert.equal(
    (await review.accept(f.userId, { ...input, version: 0 })).historical,
    true,
  );
  assert.equal(
    (await db.application.findUniqueOrThrow({ where: { id: app.id } })).stage,
    "OFFER",
  );
});
test("two emails for the same company/role require linking instead of duplicate creation", async () => {
  const f = await fixture();
  await outlookSync(db, provider([mail(), mail()]))(f.userId, f.connectionId);
  const rows = (await review.list(f.userId)).rows;
  const input = {
    company: "Fixture Corp",
    title: "Engineer",
    appliedAt: date.slice(0, 10),
    stage: "APPLIED",
  };
  await review.accept(f.userId, { ...input, id: rows[0].id });
  await assert.rejects(() =>
    review.accept(f.userId, { ...input, id: rows[1].id }),
  );
});
test("OAuth state binds user/browser, expires, and consumes only once", async () => {
  const f = await fixture(),
    state = randomUUID(),
    identifier = `outlook:${f.userId}`;
  await db.verification.create({
    data: {
      id: randomUUID(),
      identifier,
      expiresAt: new Date(Date.now() + 60000),
      value: seal(
        JSON.stringify({
          stateHash: createHash("sha256").update(state).digest("hex"),
          verifier: "fixture-verifier",
          expires: Date.now() + 60000,
        }),
        identifier,
      ),
    },
  });
  await assert.rejects(() =>
    consumeOutlookState(db, f.userId, state, "wrong-cookie"),
  );
  assert.equal(
    await consumeOutlookState(db, f.userId, state, state),
    "fixture-verifier",
  );
  await assert.rejects(() => consumeOutlookState(db, f.userId, state, state));
});

test("pagination checkpoints each committed page and resumes after interruption", async () => {
  const f = await fixture(),
    first = mail(),
    second = mail();
  const nextUrl = graphUrl.replace("deltatoken", "skiptoken");
  let calls = 0;
  const p = provider();
  p.page = async (_token, url) => {
    calls++;
    if (calls === 1) return { messages: [first], next: nextUrl };
    assert.equal(url, nextUrl);
    return { messages: [first, second], delta: graphUrl };
  };
  const sync = outlookSync(db, p);
  assert.equal((await sync(f.userId, f.connectionId)).more, true);
  assert.equal(
    (
      await db.outlookConnection.findUniqueOrThrow({
        where: { id: f.connectionId },
      })
    ).lastSyncedAt,
    null,
  );
  assert.equal((await sync(f.userId, f.connectionId)).count, 1);
  assert.equal((await review.list(f.userId)).total, 2);
});
test("reconnect version change during sync prevents stale writes", async () => {
  const f = await fixture(),
    p = provider();
  p.page = async () => {
    await db.outlookConnection.update({
      where: { id: f.connectionId },
      data: { version: { increment: 1 }, syncLease: null, leaseUntil: null },
    });
    return { messages: [mail()], delta: graphUrl };
  };
  assert.equal(
    (await outlookSync(db, p)(f.userId, f.connectionId)).status,
    "disconnected",
  );
  assert.equal((await review.list(f.userId)).total, 0);
});
test("old and future messages are excluded; dismissed suggestions stay dismissed on replay", async () => {
  const f = await fixture(),
    p = provider([
      mail(),
      {
        ...mail(),
        receivedDateTime: new Date(Date.now() - 40 * 86400_000).toISOString(),
      },
      {
        ...mail(),
        receivedDateTime: new Date(Date.now() + 86400_000).toISOString(),
      },
    ]);
  const sync = outlookSync(db, p);
  await sync(f.userId, f.connectionId);
  const row = (await review.list(f.userId)).rows[0];
  assert.equal((await review.list(f.userId)).total, 1);
  await review.dismiss(f.userId, row.id);
  await sync(f.userId, f.connectionId);
  assert.equal((await review.list(f.userId)).total, 0);
  await assert.rejects(() =>
    review.accept(f.userId, {
      id: row.id,
      company: "Fixture",
      title: "Engineer",
      stage: "APPLIED",
      appliedAt: date.slice(0, 10),
    }),
  );
});
test("expired OAuth state cannot be consumed", async () => {
  const f = await fixture(),
    state = randomUUID(),
    identifier = `outlook:${f.userId}`;
  await db.verification.create({
    data: {
      id: randomUUID(),
      identifier,
      expiresAt: new Date(Date.now() - 1000),
      value: seal(
        JSON.stringify({
          stateHash: createHash("sha256").update(state).digest("hex"),
          verifier: "expired",
          expires: Date.now() - 1000,
        }),
        identifier,
      ),
    },
  });
  await assert.rejects(() => consumeOutlookState(db, f.userId, state, state));
});

test("connection persistence refreshes the same mailbox and respects callback cancellation", async () => {
  const f = await fixture();
  const original = await db.outlookConnection.findUniqueOrThrow({
    where: { id: f.connectionId },
  });
  async function marker(verifier: string) {
    await db.verification.create({
      data: {
        id: randomUUID(),
        identifier: `outlook-completing:${f.userId}`,
        value: createHash("sha256").update(verifier).digest("hex"),
        expiresAt: new Date(Date.now() + 60000),
      },
    });
  }
  await marker("reconnect");
  await storeOutlookConnection(
    db,
    f.userId,
    "reconnect",
    original.microsoftAccountId,
    "new-cache",
    ["Mail.Read"],
  );
  const fresh = await db.outlookConnection.findUniqueOrThrow({
    where: { id: f.connectionId },
  });
  assert.equal(fresh.version, 1);
  assert.equal(
    fresh.importSince.toISOString(),
    original.importSince.toISOString(),
  );
  await assert.rejects(() =>
    storeOutlookConnection(
      db,
      f.userId,
      "reconnect",
      original.microsoftAccountId,
      "duplicate",
      ["Mail.Read"],
    ),
  );
  await marker("switch");
  await assert.rejects(() =>
    storeOutlookConnection(db, f.userId, "switch", randomUUID(), "other", [
      "Mail.Read",
    ]),
  );
  await marker("cancelled");
  await review.disconnect(f.userId);
  await assert.rejects(() =>
    storeOutlookConnection(
      db,
      f.userId,
      "cancelled",
      original.microsoftAccountId,
      "late",
      ["Mail.Read"],
    ),
  );
  assert.equal(
    await db.outlookConnection.count({ where: { userId: f.userId } }),
    0,
  );
});
