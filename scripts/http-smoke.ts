import "dotenv/config";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { outlookSync } from "../src/server/outlook/sync";
import { outlookReview } from "../src/server/outlook/review";
import { seal } from "../src/server/outlook/crypto";
const origin = process.env.APP_URL!;
if (!["127.0.0.1", "localhost"].includes(new URL(origin).hostname))
  throw new Error("HTTP smoke is restricted to localhost.");
const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
const run = randomUUID();
const createdIds: string[] = [];
const headers = {
  "Content-Type": "application/json",
  Origin: origin,
  "X-Real-IP": "127.0.0.2",
};
async function signup(label: string) {
  const email = `smoke-${label}-${run}@example.test`;
  const password = randomBytes(24).toString("base64url");
  const response = await fetch(`${origin}/api/auth/sign-up/email`, {
    method: "POST",
    headers,
    body: JSON.stringify({ name: `Smoke ${label}`, email, password }),
  });
  assert.equal(
    response.status,
    200,
    `sign-up: ${await response.clone().text()}`,
  );
  const user = (await response.json()).user;
  createdIds.push(user.id);
  const cookie = response.headers
    .getSetCookie()
    .map((v) => v.split(";")[0])
    .join("; ");
  assert.ok(cookie);
  return { cookie, email, password };
}
async function mutate(cookie: string, payload: unknown, customOrigin = origin) {
  return fetch(`${origin}/api/applications`, {
    method: "POST",
    headers: { ...headers, Origin: customOrigin, Cookie: cookie },
    body: JSON.stringify(payload),
  });
}
try {
  for (const route of ["/demo", "/sign-in", "/api/health"]) {
    const res = await fetch(origin + route);
    assert.equal(res.status, 200, route);
  }
  const unauth = await fetch(origin + "/api/applications");
  assert.equal(unauth.status, 401);
  const protectedPage = await fetch(origin + "/applications", {
    redirect: "manual",
  });
  if (protectedPage.status === 200) {
    const redirectHtml = await protectedPage.text();
    assert.ok(
      redirectHtml.includes("/sign-in") &&
        redirectHtml.includes("NEXT_REDIRECT"),
    );
    assert.ok(!redirectHtml.includes("Your applications"));
  } else assert.equal(protectedPage.status, 307);
  const one = await signup("one");
  const two = await signup("two");
  const input = {
    company: "HTTP fixture",
    title: "Engineer",
    location: "",
    workMode: "REMOTE",
    stage: "APPLIED",
    url: "",
    notes: "",
    appliedAt: "2026-01-10",
    firstResponseAt: "",
  };
  const created = await mutate(one.cookie, { operation: "create", input });
  assert.equal(created.status, 201, await created.clone().text());
  const app = (await created.json()).application;
  assert.equal(
    (
      await mutate(two.cookie, {
        operation: "update",
        meta: { id: app.id, version: 0 },
        input,
      })
    ).status,
    404,
  );
  assert.equal(
    (
      await mutate(
        one.cookie,
        { operation: "archive", meta: { id: app.id, version: 0 } },
        "https://evil.example",
      )
    ).status,
    403,
  );
  const listing = await fetch(origin + "/api/applications", {
    headers: { Cookie: two.cookie },
  });
  assert.equal((await listing.json()).total, 0);
  const update = await mutate(one.cookie, {
    operation: "update",
    meta: { id: app.id, version: 0 },
    input: { ...input, stage: "SCREENING", firstResponseAt: "2026-01-11" },
  });
  assert.equal(update.status, 200);
  assert.equal(
    (
      await mutate(one.cookie, {
        operation: "update",
        meta: { id: app.id, version: 0 },
        input,
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await mutate(one.cookie, {
        operation: "archive",
        meta: { id: app.id, version: 1 },
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await mutate(one.cookie, {
        operation: "restore",
        meta: { id: app.id, version: 2 },
      })
    ).status,
    200,
  );
  const persisted = await db.application.findUniqueOrThrow({
    where: { id: app.id },
  });
  assert.equal(persisted.version, 3);
  assert.equal(persisted.archivedAt, null);
  const dashboard = await fetch(origin + "/dashboard", {
    headers: { Cookie: one.cookie },
  });
  assert.equal(dashboard.status, 200);
  const html = await dashboard.text();
  assert.ok(html.includes("HTTP fixture"));
  for (const path of [
    "/applications?layout=board",
    "/discovered",
    "/email-review",
    "/dashboard?start=2026-01-01&end=2026-01-31&group=month&timezone=UTC",
  ]) {
    const page = await fetch(origin + path, {
      headers: { Cookie: one.cookie },
    });
    assert.equal(page.status, 200, path);
  }
  const move = await mutate(one.cookie, {
    operation: "move",
    meta: { id: app.id, version: 3 },
    input: { stage: "TECHNICAL" },
  });
  assert.equal(move.status, 200);
  const discoveryPost = async (cookie: string, body: unknown) =>
    fetch(origin + "/api/discovery", {
      method: "POST",
      headers: { ...headers, Cookie: cookie },
      body: JSON.stringify(body),
    });
  assert.equal((await fetch(origin + "/api/discovery")).status, 401);
  const profileResponse = await discoveryPost(one.cookie, {
    operation: "profile.save",
    input: {
      name: "HTTP discovery",
      titles: ["engineer"],
      keywords: ["react"],
      excludedKeywords: ["intern"],
      locations: ["Singapore"],
      workModes: ["REMOTE"],
      enabled: true,
    },
  });
  assert.equal(
    profileResponse.status,
    200,
    await profileResponse.clone().text(),
  );
  const profile = (await profileResponse.json()).result;
  const runDiscovery = await discoveryPost(one.cookie, {
    operation: "run",
    input: { id: profile.id, version: 0 },
  });
  assert.equal(runDiscovery.status, 200);
  assert.equal((await runDiscovery.json()).result.count, 1);
  const matches = await fetch(origin + "/api/discovery", {
    headers: { Cookie: one.cookie },
  });
  const matched = (await matches.json()).jobs.rows;
  assert.equal(matched.length, 1);
  assert.equal(
    (
      await discoveryPost(two.cookie, {
        operation: "save",
        input: matched[0].id,
      })
    ).status,
    404,
  );
  const firstSave = await discoveryPost(one.cookie, {
    operation: "save",
    input: matched[0].id,
  });
  const secondSave = await discoveryPost(one.cookie, {
    operation: "save",
    input: matched[0].id,
  });
  assert.equal(firstSave.status, 200);
  assert.equal(
    (await firstSave.json()).result,
    (await secondSave.json()).result,
  );
  assert.equal(
    (
      await db.application.findUniqueOrThrow({
        where: { discoveredJobId: matched[0].id },
      })
    ).stage,
    "WISHLIST",
  );
  const outlookConnect = origin + "/api/integrations/outlook/connect";
  assert.equal(
    (
      await fetch(outlookConnect, {
        method: "POST",
        headers: { Origin: origin },
        redirect: "manual",
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await fetch(outlookConnect, {
        method: "POST",
        headers: { Cookie: one.cookie, Origin: "https://evil.example" },
        redirect: "manual",
      })
    ).status,
    403,
  );
  const callback = await fetch(
    origin +
      "/api/integrations/outlook/callback?state=invalid&code=synthetic-invalid",
    { headers: { Cookie: one.cookie }, redirect: "manual" },
  );
  assert.equal(callback.status, 303);
  assert.ok(
    callback.headers
      .get("location")
      ?.endsWith("/email-review?connection=failed"),
  );
  assert.equal(
    await db.outlookConnection.count({ where: { userId: { in: createdIds } } }),
    0,
  );
  const mailbox = await db.outlookConnection.create({
    data: {
      userId: createdIds[0],
      microsoftAccountId: `fixture-${run}`,
      encryptedTokenCache: seal("synthetic-cache", `tokens:${createdIds[0]}`),
      scopes: ["Mail.Read"],
      importSince: new Date(Date.now() - 30 * 86400_000),
    },
  });
  const received = new Date(Date.now() - 86400_000).toISOString();
  await outlookSync(db, {
    refresh: async () => ({ token: "synthetic", cache: "synthetic-cache" }),
    page: async () => ({
      messages: [
        {
          id: run,
          receivedDateTime: received,
          subject: "Application received <script>synthetic</script>",
          bodyPreview:
            "Thank you for applying for Engineer at HTTP Mail Fixture.",
        },
      ],
      delta:
        "https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages/delta?$deltatoken=synthetic",
    }),
  })(createdIds[0], mailbox.id);
  const reviewHtml = await (
    await fetch(origin + "/email-review", { headers: { Cookie: one.cookie } })
  ).text();
  assert.ok(reviewHtml.includes("HTTP Mail Fixture"));
  assert.ok(reviewHtml.includes("&lt;script&gt;synthetic&lt;/script&gt;"));
  assert.ok(!reviewHtml.includes("<script>synthetic</script>"));
  const otherHtml = await (
    await fetch(origin + "/email-review", { headers: { Cookie: two.cookie } })
  ).text();
  assert.ok(!otherHtml.includes("HTTP Mail Fixture"));
  const suggestion = (await outlookReview(db).list(createdIds[0])).rows[0];
  await outlookReview(db).accept(createdIds[0], {
    id: suggestion.id,
    company: "HTTP Mail Fixture",
    title: "Engineer",
    stage: "APPLIED",
    appliedAt: received.slice(0, 10),
  });
  const afterImport = await (
    await fetch(origin + "/dashboard", { headers: { Cookie: one.cookie } })
  ).text();
  assert.ok(afterImport.includes("HTTP Mail Fixture"));
  const signout = await fetch(origin + "/api/auth/sign-out", {
    method: "POST",
    headers: { ...headers, Cookie: one.cookie },
    body: "{}",
  });
  assert.equal(signout.status, 200);
  assert.equal(
    (
      await fetch(origin + "/api/applications", {
        headers: { Cookie: one.cookie },
      })
    ).status,
    401,
  );
  const signin = await fetch(origin + "/api/auth/sign-in/email", {
    method: "POST",
    headers,
    body: JSON.stringify({ email: one.email, password: one.password }),
  });
  assert.equal(signin.status, 200, await signin.clone().text());
  console.log(
    "HTTP smoke passed: pages, sign-up/sign-in/sign-out, session revocation, private CRUD, ownership, CSRF, stale edits, archive/restore, persisted dashboard, Kanban moves, discovery profiles/runs, idempotent save, Outlook page, connection CSRF and invalid callback rejection, encrypted source rendering, and reviewed import reflected in the dashboard.",
  );
} finally {
  await db.user.deleteMany({ where: { id: { in: createdIds } } });
  await db.$disconnect();
}
