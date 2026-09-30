import { Shell } from "@/components/workspace/shell";
import { EmailReview } from "@/components/workspace/email-review";
import { requireUser } from "@/server/auth";
import { getDb } from "@/server/db";
import { outlookReview } from "@/server/outlook/review";
import { gmailConfigured } from "@/server/gmail/google";
import { outlookConfigured } from "@/server/outlook/microsoft";
import { z } from "zod";
export const dynamic = "force-dynamic";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser(),
    db = getDb(),
    query = await searchParams;
  const page = z.coerce
    .number()
    .int()
    .min(1)
    .max(10000)
    .catch(1)
    .parse(query.page ?? 1);
  const [connection, gmail, queue, applications] = await Promise.all([
    db.outlookConnection.findUnique({
      where: { userId: user.id },
      select: {
        lastSyncedAt: true,
        reauthRequired: true,
        lastErrorCode: true,
        nextSyncAt: true,
      },
    }),
    db.gmailConnection.findUnique({
      where: { userId: user.id },
      select: {
        emailAddress: true,
        lastSyncedAt: true,
        reauthRequired: true,
        lastErrorCode: true,
        nextSyncAt: true,
      },
    }),
    outlookReview(db).list(user.id, page),
    db.application.findMany({
      where: { userId: user.id, archivedAt: null },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        company: true,
        title: true,
        version: true,
        appliedAt: true,
        stage: true,
      },
    }),
  ]);
  const label = query.provider === "gmail" ? "Gmail" : "Outlook";
  const notices: Record<string, string> = {
    connected: `${label} connected. Sync now to import the last 30 days, or wait for the background sync.`,
    denied:
      "Mailbox access was declined. You can connect again whenever you’re ready.",
    failed:
      "Connection could not complete. Try again; disconnect first if switching mailboxes.",
    "not-configured": `${label} setup is incomplete. See the setup guide.`,
  };
  return (
    <Shell active="email-review" name={user.name}>
      <EmailReview
        mailboxes={[
          {
            provider: "gmail",
            configured: gmailConfigured(),
            connection: gmail
              ? {
                  ...gmail,
                  lastSyncedAt: gmail.lastSyncedAt?.toISOString() ?? null,
                  nextSyncAt: gmail.nextSyncAt?.toISOString() ?? null,
                }
              : null,
          },
          {
            provider: "outlook",
            configured: outlookConfigured(),
            connection: connection
              ? {
                  ...connection,
                  lastSyncedAt: connection.lastSyncedAt?.toISOString() ?? null,
                  nextSyncAt: connection.nextSyncAt?.toISOString() ?? null,
                }
              : null,
          },
        ]}
        rows={queue.rows}
        total={queue.total}
        page={page}
        applications={applications.map((a) => ({
          ...a,
          appliedAt: a.appliedAt?.toISOString() ?? null,
        }))}
        notice={
          typeof query.connection === "string"
            ? notices[query.connection]
            : undefined
        }
      />
    </Shell>
  );
}
