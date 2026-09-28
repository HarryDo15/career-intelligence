"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Mail, RefreshCw, ShieldCheck, Unplug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { manageOutlook } from "@/features/outlook/actions";
import type { outlookReview } from "@/server/outlook/review";
type Row = Awaited<
  ReturnType<ReturnType<typeof outlookReview>["list"]>
>["rows"][number];
type App = {
  id: string;
  company: string;
  title: string;
  version: number;
  appliedAt: string | null;
  stage: string;
};
const stages = ["APPLIED", "SCREENING", "TECHNICAL", "OFFER", "REJECTED"];
export function EmailReview({
  configured,
  connection,
  rows,
  total,
  page,
  applications,
  notice,
}: {
  configured: boolean;
  connection: {
    lastSyncedAt: string | null;
    reauthRequired: boolean;
    lastErrorCode: string | null;
    nextSyncAt: string | null;
  } | null;
  rows: Row[];
  total: number;
  page: number;
  applications: App[];
  notice?: string;
}) {
  const [pending, start] = useTransition(),
    [message, setMessage] = useState(notice ?? "");
  const router = useRouter();
  function act(op: string, input?: unknown) {
    start(async () => {
      const result = await manageOutlook(op, input);
      setMessage(
        result.ok
          ? (result.message ?? "Saved.")
          : (result.error ?? "Try again."),
      );
      router.refresh();
    });
  }
  return (
    <>
      <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-semibold tracking-widest text-primary">
            YOUR INBOX, ORGANIZED
          </p>
          <h1 className="text-[27px] font-semibold">Email review</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Review application confirmations and recruiting updates before they
            change your tracker.
          </p>
        </div>
        <span className="rounded-full bg-secondary px-4 py-2 text-xs font-semibold text-primary">
          {total} awaiting review
        </span>
      </div>
      <section className="panel mb-6 p-6">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-2xl">
            <h2 className="flex items-center gap-2 font-semibold">
              <Mail size={19} className="text-primary" />
              Outlook{" "}
              {connection
                ? connection.reauthRequired
                  ? "· Reconnect required"
                  : "· Connected"
                : "· Not connected"}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Connect to review the last 30 days of your Inbox, then new mail as
              it arrives. We read message previews, never send email, and ask
              you to approve every tracker change.
            </p>
            <p className="mt-3 text-xs text-muted-foreground">
              {connection?.lastSyncedAt
                ? `Last completed sync: ${new Date(connection.lastSyncedAt).toLocaleString()}`
                : "No completed sync yet."}
              {connection?.lastErrorCode
                ? ` Last sync status: ${connection.lastErrorCode}.`
                : ""}
              {connection?.nextSyncAt
                ? ` Eligible to retry after ${new Date(connection.nextSyncAt).toLocaleString()}.`
                : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {configured && (!connection || connection.reauthRequired) && (
              <form action="/api/integrations/outlook/connect" method="post">
                <Button type="submit">
                  {connection ? "Reconnect Outlook" : "Connect Outlook"}
                </Button>
              </form>
            )}
            {connection && (
              <>
                <Button
                  disabled={pending || connection.reauthRequired}
                  onClick={() => act("sync")}
                >
                  <RefreshCw size={15} />
                  Sync Inbox
                </Button>
                <Button
                  variant="outline"
                  disabled={pending}
                  onClick={() => {
                    if (
                      window.confirm(
                        "Disconnect Outlook and delete its email excerpts, suggestions, and tokens? Your imported applications and stage history remain.",
                      )
                    )
                      act("disconnect");
                  }}
                >
                  <Unplug size={15} />
                  Disconnect
                </Button>
              </>
            )}
          </div>
        </div>
        {!configured && (
          <p className="mt-4 rounded-lg bg-secondary p-3 text-sm">
            Microsoft connection setup is required. Configure the app
            registration and encryption key using the Outlook setup guide before
            connecting.
          </p>
        )}
        <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck size={14} />
          Read-only mailbox access · Encrypted excerpts · No automatic tracker
          changes
        </p>
      </section>
      <p role="status" aria-live="polite" className="mb-4 text-sm text-primary">
        {pending ? "Working…" : message}
      </p>
      {!rows.length ? (
        <section className="panel p-12 text-center">
          <Mail className="mx-auto mb-4 text-primary" size={30} />
          <h2 className="font-semibold">
            {connection
              ? "Your review queue is clear"
              : "Bring your application history into view"}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {connection
              ? "Sync your Inbox to look for new application updates."
              : "Connect Outlook to find application confirmations, interviews, rejections, and offers."}
          </p>
        </section>
      ) : (
        <div className="space-y-5">
          {rows.map((row) => (
            <ReviewCard
              key={row.id}
              row={row}
              applications={applications}
              pending={pending}
              act={act}
            />
          ))}
        </div>
      )}
      {total > 20 && (
        <nav aria-label="Review pages" className="mt-5 flex gap-4 text-sm">
          {page > 1 && (
            <Link href={`/email-review?page=${page - 1}`}>Previous</Link>
          )}
          <span>Page {page}</span>
          {page * 20 < total && (
            <Link href={`/email-review?page=${page + 1}`}>Next</Link>
          )}
        </nav>
      )}
    </>
  );
}
function ReviewCard({
  row,
  applications,
  pending,
  act,
}: {
  row: Row;
  applications: App[];
  pending: boolean;
  act: (op: string, value: unknown) => void;
}) {
  const matching = applications.filter(
    (a) =>
      a.company.toLowerCase() === row.source.company.toLowerCase() &&
      a.title.toLowerCase() === row.source.title.toLowerCase(),
  );
  const [target, setTarget] = useState(
    matching.length === 1 ? matching[0].id : "",
  );
  const app = applications.find((a) => a.id === target);
  const field =
    "mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm";
  return (
    <article className="panel overflow-hidden">
      <div className="border-b border-border p-5">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <span className="rounded bg-secondary px-2 py-1 text-[11px] font-semibold text-primary">
            {row.stage?.replaceAll("_", " ")} · Suggested
          </span>
          <time
            className="text-xs text-muted-foreground"
            dateTime={row.receivedAt}
          >
            {new Date(row.receivedAt).toLocaleString()}
          </time>
        </div>
        <h2 className="font-semibold break-words">
          {row.source.subject || "(No subject)"}
        </h2>
        <p className="mt-1 text-xs text-muted-foreground break-all">
          {row.source.sender}
        </p>
        <blockquote className="mt-3 border-l-2 border-primary/30 pl-3 text-sm whitespace-pre-wrap text-muted-foreground">
          {row.source.excerpt}
        </blockquote>
        <p className="mt-2 text-xs text-muted-foreground">
          Rule: {row.reason.replaceAll("_", " ").toLowerCase()}. Verify the
          sender and context; detection may be wrong.
        </p>
      </div>
      <form
        className="p-5"
        onSubmit={(e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          act("accept", {
            id: row.id,
            applicationId: target || undefined,
            version: app?.version,
            company: app?.company ?? data.get("company"),
            title: app?.title ?? data.get("title"),
            appliedAt: app?.appliedAt?.slice(0, 10) ?? data.get("appliedAt"),
            stage: data.get("stage"),
          });
        }}
      >
        <fieldset disabled={pending} className="grid gap-4 sm:grid-cols-2">
          <label className="text-xs">
            Link to application
            <select
              className={field}
              value={target}
              onChange={(e) => setTarget(e.target.value)}
            >
              <option value="">Create a new application</option>
              {applications.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.company} · {a.title} ({a.stage})
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs">
            Reviewed stage
            <select
              name="stage"
              className={field}
              defaultValue={row.stage ?? "APPLIED"}
            >
              {stages.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          {!app && (
            <>
              <label className="text-xs">
                Company
                <input
                  className={field}
                  name="company"
                  required
                  maxLength={120}
                  defaultValue={row.source.company}
                />
              </label>
              <label className="text-xs">
                Role
                <input
                  className={field}
                  name="title"
                  required
                  maxLength={160}
                  defaultValue={row.source.title}
                />
              </label>
            </>
          )}
          {!app?.appliedAt && (
            <label className="text-xs">
              Submission date
              <input
                key={row.id + target}
                className={field}
                type="date"
                name="appliedAt"
                required
                max={row.receivedAt.slice(0, 10)}
                defaultValue={
                  row.stage === "APPLIED" ? row.receivedAt.slice(0, 10) : ""
                }
              />
            </label>
          )}
          <p className="self-center text-xs text-muted-foreground">
            Older emails add history without replacing a more recent stage. If
            the application is archived, restore it in the tracker first.
          </p>
          <div className="flex gap-2 sm:col-span-2">
            <Button type="submit">
              {app ? "Approve update" : "Approve application"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => act("dismiss", row.id)}
            >
              Dismiss
            </Button>
          </div>
        </fieldset>
      </form>
    </article>
  );
}
