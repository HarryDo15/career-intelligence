import { test } from "node:test";
import assert from "node:assert/strict";
import { microsoftConfig } from "../src/server/outlook/microsoft";
import { seal, unseal } from "../src/server/outlook/crypto";
import { classify } from "../src/server/outlook/classifier";
import {
  fetchMailPage,
  safeGraphUrl,
  MailError,
} from "../src/server/outlook/graph";
process.env.TOKEN_ENCRYPTION_KEY = "a".repeat(64);
const base = {
  id: "fixture",
  receivedDateTime: "2026-09-20T12:00:00Z",
  subject: "",
  bodyPreview: "",
};
test("authenticated encryption binds ciphertext to its user and purpose", () => {
  const value = seal("secret", "tokens:alice");
  assert.equal(unseal(value, "tokens:alice"), "secret");
  assert.notEqual(value, seal("secret", "tokens:alice"));
  assert.throws(() => unseal(value, "tokens:bob"));
  const parts = value.split(".");
  parts[3] = Buffer.from("tampered").toString("base64url");
  assert.throws(() => unseal(parts.join("."), "tokens:alice"));
});
test("classifier detects confirmations with conservative employer suggestions", () => {
  const signal = classify({
    ...base,
    subject: "Application received",
    bodyPreview:
      "Thank you for applying for Platform Engineer at Fixture Labs.",
  });
  assert.equal(signal?.stage, "APPLIED");
  assert.equal(signal?.payload.company, "Fixture Labs");
  assert.equal(signal?.payload.title, "Platform Engineer");
});
test("classifier gives rejection priority over quoted interview language", () => {
  assert.equal(
    classify({
      ...base,
      subject: "Interview outcome",
      bodyPreview: "Unfortunately we are not moving forward.",
    })?.stage,
    "REJECTED",
  );
  assert.equal(
    classify({
      ...base,
      subject: "Your job offer",
      bodyPreview: "Offer of employment for this role.",
    })?.stage,
    "OFFER",
  );
  assert.equal(
    classify({ ...base, subject: "Technical interview invitation" })?.stage,
    "TECHNICAL",
  );
  assert.equal(
    classify({ ...base, subject: "Interview invitation" })?.stage,
    "SCREENING",
  );
  assert.equal(classify({ ...base, subject: "Special offer: 50% off" }), null);
  assert.equal(
    classify({ ...base, subject: "Application received", isDraft: true }),
    null,
  );
});
test("Graph continuation rejects foreign origins and unexpected paths", () => {
  for (const url of [
    "https://evil.test/v1.0/me/mailFolders/inbox/messages/delta",
    "http://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages/delta",
    "https://graph.microsoft.com/v1.0/users",
    "https://name@graph.microsoft.com/v1.0/me/mailFolders/inbox/messages/delta",
  ])
    assert.throws(() => safeGraphUrl(url));
});
const url =
  "https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages/delta";
test("Graph records Retry-After and classifies expired and denied requests", async () => {
  for (const [status, code] of [
    [429, "THROTTLED"],
    [410, "CURSOR_EXPIRED"],
    [401, "REAUTH_REQUIRED"],
    [500, "PROVIDER_FAILED"],
  ] as const) {
    await assert.rejects(
      () =>
        fetchMailPage(
          "token",
          url,
          async () =>
            new Response("", { status, headers: { "Retry-After": "120" } }),
        ),
      (e: unknown) =>
        e instanceof MailError &&
        e.code === code &&
        (status !== 429 || e.retryAfter === 120),
    );
  }
});
test("Graph ignores deleted messages and validates returned continuation before persistence", async () => {
  const result = await fetchMailPage("token", url, async () =>
    Response.json({
      value: [{ id: "deleted", "@removed": { reason: "deleted" } }, base],
      "@odata.deltaLink": url + "?$deltatoken=x",
    }),
  );
  assert.equal(result.messages.length, 1);
  await assert.rejects(() =>
    fetchMailPage("token", url, async () =>
      Response.json({ value: [], "@odata.nextLink": "https://evil.test" }),
    ),
  );
});

test("OAuth configuration requires same-origin HTTPS or HTTP loopback", () => {
  const keys = [
    "MICROSOFT_CLIENT_ID",
    "MICROSOFT_CLIENT_SECRET",
    "MICROSOFT_TENANT_ID",
    "MICROSOFT_REDIRECT_URI",
    "APP_URL",
  ] as const;
  const saved = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  try {
    Object.assign(process.env, {
      MICROSOFT_CLIENT_ID: "fixture",
      MICROSOFT_CLIENT_SECRET: "fixture",
      MICROSOFT_TENANT_ID: "common",
      APP_URL: "http://127.0.0.1:3100",
      MICROSOFT_REDIRECT_URI:
        "http://127.0.0.1:3100/api/integrations/outlook/callback",
    });
    assert.ok(microsoftConfig());
    for (const origin of ["ftp://localhost", "http://example.test"]) {
      process.env.APP_URL = origin;
      process.env.MICROSOFT_REDIRECT_URI =
        origin + "/api/integrations/outlook/callback";
      assert.throws(() => microsoftConfig());
    }
    process.env.APP_URL = "https://example.test";
    process.env.MICROSOFT_REDIRECT_URI =
      "https://other.test/api/integrations/outlook/callback";
    assert.throws(() => microsoftConfig());
  } finally {
    for (const k of keys) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  }
});
