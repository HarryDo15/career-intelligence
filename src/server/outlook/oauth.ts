import { randomBytes, createHash, timingSafeEqual } from "node:crypto";
import type { PrismaClient } from "@/generated/prisma/client";
import { z } from "zod";
import { seal, unseal } from "./crypto";
import { microsoftClient, microsoftConfig, mailScopes } from "./microsoft";
export const oauthCookie = "career-outlook-state";
const hash = (v: string) => createHash("sha256").update(v).digest("hex");
const stateSchema = z.object({
  stateHash: z.string(),
  verifier: z.string(),
  expires: z.number(),
});
export async function beginOutlook(db: PrismaClient, userId: string) {
  const state = randomBytes(32).toString("base64url"),
    verifier = randomBytes(48).toString("base64url");
  const identifier = `outlook:${userId}`;
  const expiresAt = new Date(Date.now() + 10 * 60_000);
  await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
    await tx.verification.deleteMany({
      where: {
        identifier: { in: [identifier, `outlook-completing:${userId}`] },
      },
    });
    await tx.verification.create({
      data: {
        id: randomBytes(24).toString("hex"),
        identifier,
        expiresAt,
        value: seal(
          JSON.stringify({
            stateHash: hash(state),
            verifier,
            expires: expiresAt.getTime(),
          }),
          identifier,
        ),
      },
    });
  });
  const url = await microsoftClient().getAuthCodeUrl({
    scopes: [...mailScopes, "offline_access"],
    redirectUri: microsoftConfig().redirectUri,
    state,
    codeChallenge: createHash("sha256").update(verifier).digest("base64url"),
    codeChallengeMethod: "S256",
    prompt: "select_account",
  });
  return { url, state };
}
// Consume before the network exchange: callbacks and expired browser states cannot replay.
export async function consumeOutlookState(
  db: PrismaClient,
  userId: string,
  state: string,
  cookie: string,
) {
  if (
    !state ||
    state.length > 256 ||
    state.length !== cookie.length ||
    !timingSafeEqual(Buffer.from(state), Buffer.from(cookie))
  )
    throw new Error("Invalid OAuth state.");
  const identifier = `outlook:${userId}`;
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
    const saved = await tx.verification.findFirst({
      where: { identifier, expiresAt: { gt: new Date() } },
    });
    if (!saved) throw new Error("Expired OAuth state.");
    const data = stateSchema.parse(JSON.parse(unseal(saved.value, identifier)));
    if (data.expires <= Date.now() || data.stateHash !== hash(state))
      throw new Error("Invalid OAuth state.");
    await tx.verification.delete({ where: { id: saved.id } });
    await tx.verification.create({
      data: {
        id: randomBytes(24).toString("hex"),
        identifier: `outlook-completing:${userId}`,
        expiresAt: saved.expiresAt,
        value: hash(data.verifier),
      },
    });
    return data.verifier;
  });
}
export async function completeOutlook(
  db: PrismaClient,
  userId: string,
  code: string,
  verifier: string,
) {
  const app = microsoftClient();
  const result = await app.acquireTokenByCode({
    code,
    codeVerifier: verifier,
    scopes: [...mailScopes, "offline_access"],
    redirectUri: microsoftConfig().redirectUri,
  });
  if (
    !result.account ||
    !result.scopes.some((s) => /(?:^|\/)mail\.read$/i.test(s))
  )
    throw new Error("Missing mailbox consent.");
  await storeOutlookConnection(
    db,
    userId,
    verifier,
    result.account.homeAccountId,
    app.getTokenCache().serialize(),
    result.scopes,
  );
}
// Internal persistence boundary; only call after MSAL has exchanged the code.
export async function storeOutlookConnection(
  db: PrismaClient,
  userId: string,
  verifier: string,
  accountId: string,
  serializedCache: string,
  scopes: string[],
) {
  await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
    const pending = await tx.verification.deleteMany({
      where: {
        identifier: `outlook-completing:${userId}`,
        value: hash(verifier),
        expiresAt: { gt: new Date() },
      },
    });
    if (!pending.count)
      throw new Error("Connection attempt expired or was cancelled.");
    const old = await tx.outlookConnection.findUnique({ where: { userId } });
    if (old && old.microsoftAccountId !== accountId)
      throw new Error(
        "Disconnect the current mailbox before switching accounts.",
      );
    const cache = seal(serializedCache, `tokens:${userId}`);
    if (old)
      await tx.outlookConnection.update({
        where: { id: old.id },
        data: {
          encryptedTokenCache: cache,
          scopes,
          reauthRequired: false,
          lastErrorCode: null,
          syncLease: null,
          leaseUntil: null,
          nextSyncAt: null,
          version: { increment: 1 },
        },
      });
    else
      await tx.outlookConnection.create({
        data: {
          userId,
          microsoftAccountId: accountId,
          encryptedTokenCache: cache,
          scopes,
          importSince: new Date(Date.now() - 30 * 86400_000),
        },
      });
    await tx.auditLog.create({
      data: {
        userId,
        action: "outlook.connected",
        entityType: "OutlookConnection",
        entityId: userId,
      },
    });
  });
}
