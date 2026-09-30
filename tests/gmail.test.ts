import { test } from "node:test";
import assert from "node:assert/strict";
import { gmailApi, normalizeGmail } from "../src/server/gmail/api";
import { classify } from "../src/server/outlook/classifier";
import { MailError } from "../src/server/outlook/graph";
import { googleConfig } from "../src/server/gmail/google";
const raw = (id = "abc") => ({
  id,
  internalDate: "1790337600000",
  snippet: "Check your application&#39;s status &amp; next steps.",
  labelIds: [],
  payload: {
    headers: [
      { name: "Subject", value: "Bank of America Application Update" },
      { name: "From", value: "Recruiting <fixture@example.test>" },
    ],
  },
});
test("archived Gmail application updates queue for review without inventing a stage", () => {
  const mail = normalizeGmail(raw())!;
  assert.equal(mail.from?.emailAddress.address, "fixture@example.test");
  assert.match(mail.bodyPreview, /application's status & next steps/);
  assert.equal(classify(mail)?.stage, null);
  assert.equal(classify(mail)?.reasonCode, "APPLICATION_UPDATE_REVIEW");
  for (const label of ["SPAM", "TRASH", "DRAFT", "SENT"])
    assert.equal(normalizeGmail({ ...raw(), labelIds: [label] }), null);
});
test("backfill captures history before listing and catches up without restricting to Inbox", async () => {
  const paths: URL[] = [];
  const api = gmailApi(async (input, options) => {
    const url = new URL(String(input));
    paths.push(url);
    assert.equal(url.origin, "https://gmail.googleapis.com");
    assert.equal(options?.redirect, "error");
    if (url.pathname.endsWith("profile"))
      return Response.json({
        emailAddress: "fixture@gmail.com",
        historyId: "100",
      });
    if (url.pathname.endsWith("messages")) {
      assert.ok(!url.searchParams.get("q")?.includes("in:inbox"));
      return Response.json({ messages: [{ id: "abc" }] });
    }
    if (url.pathname.endsWith("history")) {
      assert.equal(url.searchParams.get("startHistoryId"), "100");
      return Response.json({ historyId: "110", history: [] });
    }
    assert.equal(url.searchParams.get("format"), "metadata");
    return Response.json(raw());
  });
  const first = await api.page("token", new Date("2026-09-01"), null);
  assert.equal(paths[0].pathname.split("/").at(-1), "profile");
  assert.equal(first.messages.length, 1);
  assert.equal(first.more, true);
  const last = await api.page("token", new Date("2026-09-01"), first.cursor);
  assert.equal(last.more, false);
  assert.equal(last.cursor.historyId, "110");
});
test("large history pages drain durably before advancing to the next provider page", async () => {
  let histories = 0;
  const api = gmailApi(async (input) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith("history")) {
      histories++;
      if (histories === 1)
        return Response.json({
          historyId: "200",
          nextPageToken: "next",
          history: [
            {
              messagesAdded: Array.from({ length: 31 }, (_, i) => ({
                message: { id: `m${i}` },
              })),
            },
          ],
        });
      assert.equal(url.searchParams.get("pageToken"), "next");
      assert.equal(url.searchParams.get("startHistoryId"), "100");
      return Response.json({ historyId: "220" });
    }
    return Response.json(raw(url.pathname.split("/").at(-1)));
  });
  const first = await api.page("token", new Date(), {
    phase: "history",
    historyId: "100",
  });
  assert.equal(first.messages.length, 25);
  assert.equal(first.cursor.pendingIds?.length, 6);
  const second = await api.page("token", new Date(), first.cursor);
  assert.equal(second.messages.length, 6);
  assert.equal(histories, 1);
  assert.equal(second.more, true);
  const last = await api.page("token", new Date(), second.cursor);
  assert.equal(last.cursor.historyId, "220");
  assert.equal(last.more, false);
});
test("Gmail handles expired history, revoked consent, throttling and deleted messages", async () => {
  for (const [status, code] of [
    [404, "CURSOR_EXPIRED"],
    [401, "REAUTH_REQUIRED"],
    [429, "THROTTLED"],
    [500, "PROVIDER_FAILED"],
  ] as const) {
    await assert.rejects(
      () =>
        gmailApi(
          async () =>
            new Response("", { status, headers: { "retry-after": "120" } }),
        ).page("token", new Date(), { phase: "history", historyId: "1" }),
      (e: unknown) =>
        e instanceof MailError &&
        e.code === code &&
        (status !== 429 || e.retryAfter === 120),
    );
  }
  const api = gmailApi(async (input) =>
    String(input).includes("/history?")
      ? Response.json({
          historyId: "2",
          history: [{ messagesAdded: [{ message: { id: "gone" } }] }],
        })
      : new Response("", { status: 404 }),
  );
  assert.deepEqual(
    (await api.page("token", new Date(), { phase: "history", historyId: "1" }))
      .messages,
    [],
  );
});
test("Google callback configuration rejects other origins and nonlocal HTTP", () => {
  const keys = [
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "GOOGLE_REDIRECT_URI",
    "APP_URL",
    "TOKEN_ENCRYPTION_KEY",
  ] as const;
  const saved = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  try {
    Object.assign(process.env, {
      GOOGLE_CLIENT_ID: "fixture",
      GOOGLE_CLIENT_SECRET: "fixture",
      APP_URL: "http://127.0.0.1:3100",
      GOOGLE_REDIRECT_URI:
        "http://127.0.0.1:3100/api/integrations/gmail/callback",
      TOKEN_ENCRYPTION_KEY: "a".repeat(64),
    });
    assert.ok(googleConfig());
    process.env.GOOGLE_REDIRECT_URI =
      "https://evil.test/api/integrations/gmail/callback";
    assert.throws(() => googleConfig());
    process.env.APP_URL = "http://example.test";
    process.env.GOOGLE_REDIRECT_URI =
      "http://example.test/api/integrations/gmail/callback";
    assert.throws(() => googleConfig());
  } finally {
    for (const key of keys) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  }
});
