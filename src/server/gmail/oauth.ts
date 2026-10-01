import { CodeChallengeMethod } from "google-auth-library";
import type { PrismaClient } from "@/generated/prisma/client";
import { beginMailState, digest } from "../mail/oauth-state";
import { seal } from "../outlook/crypto";
import {
  googleClient,
  googleConfig,
  googleScopes,
  gmailScope,
  storedTokens,
} from "./google";
import { gmailApi } from "./api";
export const gmailCookie = "career-gmail-state";
export async function beginGmail(db: PrismaClient, userId: string) {
  const client = googleClient();
  const { state, challenge } = await beginMailState(db, userId, "gmail");
  return {
    state,
    url: client.generateAuthUrl({
      scope: googleScopes,
      access_type: "offline",
      prompt: "consent select_account",
      state,
      code_challenge: challenge,
      code_challenge_method: CodeChallengeMethod.S256,
    }),
  };
}
export async function completeGmail(
  db: PrismaClient,
  userId: string,
  code: string,
  verifier: string,
) {
  const client = googleClient();
  const { tokens } = await client.getToken({
    code,
    codeVerifier: verifier,
    redirect_uri: googleConfig().redirectUri,
  });
  if (
    !tokens.access_token ||
    !tokens.id_token ||
    !tokens.scope?.split(" ").includes(gmailScope)
  )
    throw new Error("Missing Gmail consent.");
  const ticket = await client.verifyIdToken({
    idToken: tokens.id_token,
    audience: googleConfig().clientId,
  });
  const identity = ticket.getPayload();
  if (!identity?.sub || !identity.email_verified)
    throw new Error("Unverified Google identity.");
  const mailbox = await gmailApi().profile(tokens.access_token);
  await storeGmailConnection(
    db,
    userId,
    verifier,
    identity.sub,
    mailbox.emailAddress,
    JSON.stringify(storedTokens.parse(tokens)),
    tokens.scope.split(" "),
  );
}
export async function storeGmailConnection(
  db: PrismaClient,
  userId: string,
  verifier: string,
  accountId: string,
  emailAddress: string,
  cache: string,
  scopes: string[],
) {
  storedTokens.parse(JSON.parse(cache));
  await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
    const marker = await tx.verification.deleteMany({
      where: {
        identifier: `gmail-completing:${userId}`,
        value: digest(verifier),
        expiresAt: { gt: new Date() },
      },
    });
    if (!marker.count) throw new Error("Connection expired or cancelled.");
    const old = await tx.gmailConnection.findUnique({ where: { userId } });
    if (old && old.googleAccountId !== accountId)
      throw new Error("Disconnect Gmail before switching accounts.");
    const encryptedTokens = seal(cache, `gmail-tokens:${userId}`);
    if (old)
      await tx.gmailConnection.update({
        where: { id: old.id },
        data: {
          emailAddress,
          encryptedTokens,
          scopes,
          version: { increment: 1 },
          syncLease: null,
          leaseUntil: null,
          reauthRequired: false,
          lastErrorCode: null,
          nextSyncAt: null,
        },
      });
    else
      await tx.gmailConnection.create({
        data: {
          userId,
          googleAccountId: accountId,
          emailAddress,
          encryptedTokens,
          scopes,
          importSince: new Date(Date.now() - 30 * 86400_000),
        },
      });
    await tx.auditLog.create({
      data: {
        userId,
        action: "gmail.connected",
        entityType: "User",
        entityId: userId,
      },
    });
  });
}
