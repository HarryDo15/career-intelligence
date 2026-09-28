import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@/generated/prisma/client";
import { classify } from "./classifier";
import { seal, unseal } from "./crypto";
import { fetchMailPage, initialUrl, MailError, type MailPage } from "./graph";
import { refreshAccess } from "./microsoft";
export type MailProvider = {
  refresh: typeof refreshAccess;
  page: (token: string, url: string) => Promise<MailPage>;
};
export function outlookSync(
  db: PrismaClient,
  provider: MailProvider = { refresh: refreshAccess, page: fetchMailPage },
) {
  return async function syncPage(userId: string, connectionId: string) {
    const lease = randomUUID(),
      now = new Date();
    const claimed = await db.outlookConnection.updateMany({
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
    const connection = await db.outlookConnection.findFirst({
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
        unseal(connection.encryptedTokenCache, `tokens:${userId}`),
        connection.microsoftAccountId,
      );
      // Persist refreshed credentials before Graph fetch, including on throttling.
      const refreshed = await db.outlookConnection.updateMany({
        where: scope,
        data: { encryptedTokenCache: seal(token.cache, `tokens:${userId}`) },
      });
      if (!refreshed.count)
        return { count: 0, more: false, status: "disconnected" };
      const cursor = await db.mailSyncCursor.findUnique({
        where: { connectionId_folderId: { connectionId, folderId: "inbox" } },
      });
      const encryptedUrl =
        cursor?.encryptedNextLink ?? cursor?.encryptedDeltaLink;
      const url = encryptedUrl
        ? unseal(encryptedUrl, `cursor:${connectionId}`)
        : initialUrl(connection.importSince);
      const page = await provider.page(token.token, url);
      return await db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "OutlookConnection" WHERE id = ${connectionId} FOR UPDATE`;
        if (!(await tx.outlookConnection.findFirst({ where: scope })))
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
              connectionId_messageId: { connectionId, messageId: message.id },
            },
          });
          if (existing) continue;
          await tx.emailSignal.create({
            data: {
              connectionId,
              messageId: message.id,
              receivedAt,
              proposedStage: signal.stage,
              confidence: signal.confidence,
              classifierVersion: "rules-v1",
              reasonCode: signal.reasonCode,
              encryptedPayload: seal(
                JSON.stringify(signal.payload),
                `signal:${connectionId}:${message.id}`,
              ),
            },
          });
          count++;
        }
        const cursorData = {
          encryptedNextLink: page.next
            ? seal(page.next, `cursor:${connectionId}`)
            : null,
          ...(page.delta
            ? { encryptedDeltaLink: seal(page.delta, `cursor:${connectionId}`) }
            : {}),
        };
        await tx.mailSyncCursor.upsert({
          where: { connectionId_folderId: { connectionId, folderId: "inbox" } },
          create: { connectionId, folderId: "inbox", ...cursorData },
          update: cursorData,
        });
        await tx.outlookConnection.update({
          where: { id: connectionId },
          data: {
            syncLease: null,
            leaseUntil: null,
            lastErrorCode: null,
            nextSyncAt: null,
            ...(!page.next ? { lastSyncedAt: new Date() } : {}),
          },
        });
        await tx.auditLog.create({
          data: {
            userId,
            action: "outlook.page-synced",
            entityType: "OutlookConnection",
            entityId: connectionId,
            metadata: { suggestions: count, more: !!page.next },
          },
        });
        return { count, more: !!page.next, status: "synced" };
      });
    } catch (error) {
      const failure =
        error instanceof MailError ? error : new MailError("PROVIDER_FAILED");
      await db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "OutlookConnection" WHERE id = ${connectionId} FOR UPDATE`;
        const changed = await tx.outlookConnection.updateMany({
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
          await tx.mailSyncCursor.deleteMany({ where: { connectionId } });
      });
      // Retry-After is stored durably; next scheduled run resumes without busy retries.
      return { count: 0, more: false, status: failure.code };
    }
  };
}
