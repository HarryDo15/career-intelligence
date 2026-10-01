import "dotenv/config";
import { after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma/client";
import { gmailSync, type GmailProvider } from "../../src/server/gmail/sync";
import { outlookReview } from "../../src/server/outlook/review";
import { seal, unseal } from "../../src/server/outlook/crypto";
import {
  beginMailState,
  consumeMailState,
} from "../../src/server/mail/oauth-state";
import { storeGmailConnection } from "../../src/server/gmail/oauth";
import { MailError } from "../../src/server/outlook/graph";
const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith("_test"))
  throw new Error("Use a dedicated _test database.");
process.env.TOKEN_ENCRYPTION_KEY = "b".repeat(64);
const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: url, max: 5 }),
});
const users: string[] = [],
  review = outlookReview(db);
const date = new Date(Date.now() - 86400_000).toISOString();
const mail = {
  id: "fixture",
  receivedDateTime: date,
  subject: "Bank of America Application Update",
  bodyPreview: "Check the portal for your application status.",
};
const cache = JSON.stringify({ refresh_token: "fixture-refresh" });
async function fixture() {
  const user = await db.user.create({
    data: { name: "Fixture", email: `${randomUUID()}@example.test` },
  });
  users.push(user.id);
  const connection = await db.gmailConnection.create({
    data: {
      userId: user.id,
      googleAccountId: randomUUID(),
      emailAddress: "fixture@gmail.com",
      encryptedTokens: seal(cache, `gmail-tokens:${user.id}`),
      scopes: ["gmail.readonly"],
      importSince: new Date(Date.now() - 30 * 86400_000),
    },
  });
  return { userId: user.id, connectionId: connection.id };
}
const provider = (): GmailProvider => ({
  refresh: async () => ({ token: "fixture-token", cache }),
  page: async () => ({
    messages: [mail],
    cursor: { phase: "history", historyId: "100" },
    more: false,
  }),
});
after(async () => {
  await db.user.deleteMany({ where: { id: { in: users } } });
  await db.verification.deleteMany({
    where: {
      identifier: {
        in: users.flatMap((u) => [`gmail:${u}`, `gmail-completing:${u}`]),
      },
    },
  });
  await db.$disconnect();
});
test("Gmail encrypts payload/cursor, deduplicates and requires an explicit reviewed stage", async () => {
  const f = await fixture(),
    sync = gmailSync(db, provider());
  assert.equal((await sync(f.userId, f.connectionId)).count, 1);
  assert.equal((await sync(f.userId, f.connectionId)).count, 0);
  const row = (await review.list(f.userId)).rows[0];
  assert.equal(row.provider, "Gmail");
  assert.equal(row.stage, null);
  const signal = await db.emailSignal.findUniqueOrThrow({
    where: { id: row.id },
  });
  assert.ok(!signal.encryptedPayload?.includes("Bank of America"));
  const connection = await db.gmailConnection.findUniqueOrThrow({
    where: { id: f.connectionId },
  });
  assert.equal(
    JSON.parse(
      unseal(connection.encryptedSyncState!, `gmail-cursor:${f.connectionId}`),
    ).historyId,
    "100",
  );
  assert.equal(await db.application.count({ where: { userId: f.userId } }), 0);
  const input = {
    id: row.id,
    company: "Fixture Corp",
    title: "Engineer",
    appliedAt: date.slice(0, 10),
    stage: "",
  };
  await assert.rejects(() => review.accept(f.userId, input));
  const accepted = await review.accept(f.userId, {
    ...input,
    stage: "APPLIED",
  });
  await review.disconnect(f.userId, "gmail");
  assert.equal(await db.application.count({ where: { id: accepted.id! } }), 1);
  assert.equal((await review.list(f.userId)).total, 0);
});
test("Gmail enforces ownership for sync, review, and dismiss", async () => {
  const a = await fixture(),
    b = await fixture(),
    sync = gmailSync(db, provider());
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
test("Gmail lease excludes concurrent syncs and disconnect cancels an in-flight write", async () => {
  const f = await fixture(),
    p = provider();
  let calls = 0;
  const page = p.page;
  p.page = async (...args) => {
    calls++;
    await new Promise((r) => setTimeout(r, 30));
    return page(...args);
  };
  const sync = gmailSync(db, p);
  await Promise.all([
    sync(f.userId, f.connectionId),
    sync(f.userId, f.connectionId),
  ]);
  assert.equal(calls, 1);
  p.page = async (...args) => {
    await review.disconnect(f.userId, "gmail");
    return page(...args);
  };
  assert.equal((await sync(f.userId, f.connectionId)).status, "disconnected");
  assert.equal((await review.list(f.userId)).total, 0);
});
test("Gmail checkpoints pagination and a reconnect fences out stale sync writes", async () => {
  const f = await fixture(),
    p = provider();
  p.page = async () => ({
    messages: [mail],
    cursor: { phase: "full", historyId: "100", pageToken: "next" },
    more: true,
  });
  const sync = gmailSync(db, p);
  assert.equal((await sync(f.userId, f.connectionId)).more, true);
  assert.equal(
    (
      await db.gmailConnection.findUniqueOrThrow({
        where: { id: f.connectionId },
      })
    ).lastSyncedAt,
    null,
  );
  p.page = async (_token, _since, cursor) => {
    assert.equal(cursor?.pageToken, "next");
    await db.gmailConnection.update({
      where: { id: f.connectionId },
      data: { version: { increment: 1 }, syncLease: null, leaseUntil: null },
    });
    return {
      messages: [{ ...mail, id: "second" }],
      cursor: { phase: "history", historyId: "200" },
      more: false,
    };
  };
  assert.equal((await sync(f.userId, f.connectionId)).status, "disconnected");
  assert.equal((await review.list(f.userId)).total, 1);
});
test("Gmail persists throttling, resets expired history and requires reconnect for revoked consent", async () => {
  const f = await fixture(),
    p = provider(),
    sync = gmailSync(db, p);
  await sync(f.userId, f.connectionId);
  for (const code of [
    "THROTTLED",
    "CURSOR_EXPIRED",
    "REAUTH_REQUIRED",
  ] as const) {
    p.page = async () => {
      throw new MailError(code, 120);
    };
    assert.equal((await sync(f.userId, f.connectionId)).status, code);
    const row = await db.gmailConnection.findUniqueOrThrow({
      where: { id: f.connectionId },
    });
    assert.ok(row.nextSyncAt! > new Date());
    if (code === "CURSOR_EXPIRED") assert.equal(row.encryptedSyncState, null);
    if (code === "REAUTH_REQUIRED") assert.equal(row.reauthRequired, true);
    assert.equal((await sync(f.userId, f.connectionId)).status, "unavailable");
    await db.gmailConnection.update({
      where: { id: f.connectionId },
      data: { nextSyncAt: null },
    });
  }
});
test("Gmail OAuth state is browser/user bound, single-use and cancelled by disconnect", async () => {
  const a = await fixture(),
    b = await fixture();
  const state = await beginMailState(db, a.userId, "gmail");
  await assert.rejects(() =>
    consumeMailState(db, a.userId, state.state, "wrong", "gmail"),
  );
  await assert.rejects(() =>
    consumeMailState(db, b.userId, state.state, state.state, "gmail"),
  );
  const verifier = await consumeMailState(
    db,
    a.userId,
    state.state,
    state.state,
    "gmail",
  );
  await assert.rejects(() =>
    consumeMailState(db, a.userId, state.state, state.state, "gmail"),
  );
  const old = await db.gmailConnection.findUniqueOrThrow({
    where: { id: a.connectionId },
  });
  await storeGmailConnection(
    db,
    a.userId,
    verifier,
    old.googleAccountId,
    "fixture@gmail.com",
    cache,
    [],
  );
  assert.equal(
    (
      await db.gmailConnection.findUniqueOrThrow({
        where: { id: a.connectionId },
      })
    ).version,
    1,
  );
  const cancelled = await beginMailState(db, a.userId, "gmail");
  const cancelledVerifier = await consumeMailState(
    db,
    a.userId,
    cancelled.state,
    cancelled.state,
    "gmail",
  );
  await review.disconnect(a.userId, "gmail");
  await assert.rejects(() =>
    storeGmailConnection(
      db,
      a.userId,
      cancelledVerifier,
      old.googleAccountId,
      "fixture@gmail.com",
      cache,
      [],
    ),
  );
});
test("database requires exactly one mailbox provider on each email signal", async () => {
  const f = await fixture();
  await assert.rejects(() =>
    db.emailSignal.create({
      data: {
        messageId: "orphan",
        receivedAt: new Date(),
        reasonCode: "FIXTURE",
        confidence: 0.5,
        classifierVersion: "fixture",
      },
    }),
  );
  const outlook = await db.outlookConnection.create({
    data: {
      userId: f.userId,
      microsoftAccountId: randomUUID(),
      encryptedTokenCache: "fixture",
      scopes: [],
    },
  });
  await assert.rejects(() =>
    db.emailSignal.create({
      data: {
        connectionId: outlook.id,
        gmailConnectionId: f.connectionId,
        messageId: "two",
        receivedAt: new Date(),
        reasonCode: "FIXTURE",
        confidence: 0.5,
        classifierVersion: "fixture",
      },
    }),
  );
  await review.disconnect(f.userId, "gmail");
  assert.equal(
    await db.outlookConnection.count({ where: { id: outlook.id } }),
    1,
  );
});
