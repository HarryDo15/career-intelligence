import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@/generated/prisma/client";
import { classify } from "../outlook/classifier";
import { seal, unseal } from "../outlook/crypto";
import { MailError } from "../outlook/graph";
import { gmailApi, gmailCursor, type GmailCursor, type GmailPage } from "./api";
import { refreshGmail } from "./google";
export type GmailProvider = {
  refresh: typeof refreshGmail;
  page: (
    token: string,
    since: Date,
    cursor: GmailCursor | null,
  ) => Promise<GmailPage>;
};
export function gmailSync(
  db: PrismaClient,
  provider: GmailProvider = { refresh: refreshGmail, page: gmailApi().page },
) {
  return async function syncPage(userId: string, connectionId: string) {
    const lease = randomUUID(),
      now = new Date();
    const claimed = await db.gmailConnection.updateMany({
      where: {
        id: connectionId,
        userId,
        reauthRequired: false,
        AND: [
          { OR: [{ leaseUntil: null }, { leaseUntil: { lt: now } }] },
          { OR: [{ nextSyncAt: null }, { nextSyncAt: { lte: now } }] },
        ],
      },
      data: { syncLease: lease, leaseUntil: new Date(Date.now() + 120_000) },
    });
    if (!claimed.count) return { count: 0, more: false, status: "unavailable" };
    const connection = await db.gmailConnection.findFirst({
      where: { id: connectionId, userId, syncLease: lease },
    });
    if (!connection) return { count: 0, more: false, status: "disconnected" };
    const scope = {
      id: connectionId,
      userId,
      version: connection.version,
      syncLease: lease,
    };
    try {
      const token = await provider.refresh(
        unseal(connection.encryptedTokens, `gmail-tokens:${userId}`),
      );
      // Persist refreshed credentials before Gmail fetch, including on throttling.
      const refreshed = await db.gmailConnection.updateMany({
        where: scope,
        data: { encryptedTokens: seal(token.cache, `gmail-tokens:${userId}`) },
      });
      if (!refreshed.count)
        return { count: 0, more: false, status: "disconnected" };
      const cursor = connection.encryptedSyncState
        ? gmailCursor.parse(
            JSON.parse(
              unseal(
                connection.encryptedSyncState,
                `gmail-cursor:${connectionId}`,
              ),
            ),
          )
        : null;
      const page = await provider.page(
        token.token,
        connection.importSince,
        cursor,
      );
      return await db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "GmailConnection" WHERE id = ${connectionId} FOR UPDATE`;
        if (!(await tx.gmailConnection.findFirst({ where: scope })))
          return { count: 0, more: false, status: "disconnected" };
        let count = 0;
        for (const message of page.messages) {
          const receivedAt = new Date(message.receivedDateTime);
          if (receivedAt < connection.importSince || receivedAt > new Date())
            continue;
          const signal = classify(message);
          if (!signal) continue;
          const existing = await tx.emailSignal.findUnique({
            where: {
              gmailConnectionId_messageId: {
                gmailConnectionId: connectionId,
                messageId: message.id,
              },
            },
          });
          if (existing) continue;
          await tx.emailSignal.create({
            data: {
              gmailConnectionId: connectionId,
              messageId: message.id,
              receivedAt,
              proposedStage: signal.stage,
              confidence: signal.confidence,
              classifierVersion: "rules-v2",
              reasonCode: signal.reasonCode,
              encryptedPayload: seal(
                JSON.stringify(signal.payload),
                `signal:${connectionId}:${message.id}`,
              ),
            },
          });
          count++;
        }
        await tx.gmailConnection.update({
          where: { id: connectionId },
          data: {
            encryptedSyncState: seal(
              JSON.stringify(page.cursor),
              `gmail-cursor:${connectionId}`,
            ),
            syncLease: null,
            leaseUntil: null,
            lastErrorCode: null,
            nextSyncAt: null,
            ...(!page.more ? { lastSyncedAt: new Date() } : {}),
          },
        });
        await tx.auditLog.create({
          data: {
            userId,
            action: "gmail.page-synced",
            entityType: "GmailConnection",
            entityId: connectionId,
            metadata: { suggestions: count, more: !!page.more },
          },
        });
        return { count, more: !!page.more, status: "synced" };
      });
    } catch (error) {
      const failure =
        error instanceof MailError ? error : new MailError("PROVIDER_FAILED");
      await db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "GmailConnection" WHERE id = ${connectionId} FOR UPDATE`;
        const changed = await tx.gmailConnection.updateMany({
          where: scope,
          data: {
            syncLease: null,
            leaseUntil: null,
            lastErrorCode: failure.code,
            reauthRequired: failure.code === "REAUTH_REQUIRED",
            nextSyncAt: new Date(Date.now() + failure.retryAfter * 1000),
          },
        });
        if (changed.count && failure.code === "CURSOR_EXPIRED")
          await tx.gmailConnection.update({
            where: { id: connectionId },
            data: { encryptedSyncState: null },
          });
      });
      // Retry-After is stored durably; next scheduled run resumes without busy retries.
      return { count: 0, more: false, status: failure.code };
    }
  };
}
