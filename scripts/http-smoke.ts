import "dotenv/config";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
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
    "HTTP smoke passed: pages, sign-up/sign-in/sign-out, session revocation, private CRUD, ownership, CSRF, stale edits, archive/restore, persisted dashboard.",
  );
} finally {
  await db.user.deleteMany({ where: { id: { in: createdIds } } });
  await db.$disconnect();
}
