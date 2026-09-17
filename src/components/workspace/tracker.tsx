"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Archive,
  ArchiveRestore,
  ArrowDownUp,
  BriefcaseBusiness,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Pencil,
  Plus,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  stageLabels,
  stageStyles,
  stages,
  type ApplicationRow,
} from "@/lib/application";
import { ApplicationEditor } from "./application-editor";
import { archiveApplication } from "@/features/applications/actions";
export function Tracker({
  rows,
  total,
  page = 1,
  query = "",
  stage = "",
  archived = false,
  demo = false,
  initialNew = false,
}: {
  rows: ApplicationRow[];
  total: number;
  page?: number;
  query?: string;
  stage?: string;
  archived?: boolean;
  demo?: boolean;
  initialNew?: boolean;
}) {
  const [editing, setEditing] = useState<ApplicationRow | undefined>();
  const [open, setOpen] = useState(initialNew && !demo);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const base = demo ? "/demo" : "/applications";
  function href(newPage: number, newArchive = archived) {
    const q = new URLSearchParams({
      q: query,
      stage,
      page: String(newPage),
      ...(newArchive ? { archived: "true" } : {}),
      ...(demo ? { view: "applications" } : {}),
    });
    return `${base}?${q}`;
  }
  function toggleArchive(a: ApplicationRow) {
    setError("");
    setNotice("");
    startTransition(async () => {
      try {
        const result = await archiveApplication(
          { id: a.id, version: a.version },
          !archived,
        );
        if (result.ok) {
          setNotice(
            archived
              ? "Application restored."
              : "Application archived. You can restore it from Archived.",
          );
          router.refresh();
        } else setError(result.error);
      } catch {
        setError("Couldn’t save the change. Please try again.");
      }
    });
  }
  return (
    <>
      <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="mb-2 text-[11px] font-semibold tracking-[.13em] text-primary">
            MAKE YOUR NEXT MOVE
          </p>
          <h1 className="text-[27px] font-semibold tracking-tight">
            Your applications
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Every opportunity, every conversation. All in one place.
          </p>
        </div>
        {demo ? (
          <Button asChild>
            <Link href="/sign-in">
              <Plus />
              Add application
            </Link>
          </Button>
        ) : (
          <Button
            onClick={() => {
              setEditing(undefined);
              setOpen(true);
            }}
          >
            <Plus />
            Add application
          </Button>
        )}
      </div>
      <section className="panel overflow-hidden">
        <div className="flex gap-6 border-b border-border px-6">
          <Link
            aria-current={!archived ? "page" : undefined}
            className={`border-b-2 py-4 text-xs font-medium ${!archived ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}
            href={href(1, false)}
          >
            All applications
          </Link>
          <Link
            aria-current={archived ? "page" : undefined}
            className={`border-b-2 py-4 text-xs font-medium ${archived ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}
            href={href(1, true)}
          >
            Archived
          </Link>
        </div>
        <form action={base} className="flex flex-wrap items-center gap-3 p-5">
          {demo && <input type="hidden" name="view" value="applications" />}
          {archived && <input type="hidden" name="archived" value="true" />}
          <label className="relative min-w-48 flex-1">
            <span className="sr-only">Search applications</span>
            <Search
              size={15}
              className="absolute top-3 left-3 text-muted-foreground"
            />
            <input
              className="field pl-9 text-xs"
              name="q"
              placeholder="Search company or role…"
              defaultValue={query}
              maxLength={160}
            />
          </label>
          <label>
            <span className="sr-only">Filter by stage</span>
            <select className="field text-xs" name="stage" defaultValue={stage}>
              <option value="">All stages</option>
              {stages.map((s) => (
                <option key={s} value={s}>
                  {stageLabels[s]}
                </option>
              ))}
            </select>
          </label>
          <Button type="submit" variant="outline">
            Apply filters
          </Button>
          {(query || stage) && (
            <Link
              href={demo ? "/demo?view=applications" : "/applications"}
              className="text-xs text-primary"
            >
              Clear
            </Link>
          )}
        </form>
        {error && (
          <div
            role="alert"
            className="mx-5 mb-4 rounded-lg bg-rose-50 p-3 text-xs text-rose-700"
          >
            {error}
          </div>
        )}
        {notice && (
          <div
            role="status"
            className="mx-5 mb-4 rounded-lg bg-emerald-50 p-3 text-xs text-emerald-700"
          >
            {notice}
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[740px] text-left">
            <thead className="border-y border-border bg-[#fcfcfe] text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-6 py-3 font-medium">Company & role</th>
                <th className="px-4 py-3 font-medium">Location</th>
                <th className="px-4 py-3 font-medium">Stage</th>
                <th className="px-4 py-3 font-medium">Applied</th>
                <th className="px-4 py-3 font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a, i) => (
                <tr
                  key={a.id}
                  className="border-b border-border last:border-0 hover:bg-background/50"
                >
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-3">
                      <span
                        className={`flex size-10 shrink-0 items-center justify-center rounded-xl font-bold ${["bg-secondary text-primary", "bg-slate-100 text-slate-600", "bg-amber-50 text-amber-700", "bg-blue-50 text-blue-600"][i % 4]}`}
                      >
                        {a.company.slice(0, 1)}
                      </span>
                      <div>
                        <div className="text-xs font-semibold">{a.company}</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {a.title}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-5">
                    <div className="text-xs">
                      {a.location || "Not specified"}
                    </div>
                    <div className="mt-1 text-[10px] capitalize text-muted-foreground">
                      {a.workMode === "UNKNOWN" ? "" : a.workMode.toLowerCase()}
                    </div>
                  </td>
                  <td className="px-4 py-5">
                    <span
                      className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-medium ${stageStyles[a.stage]}`}
                    >
                      • {stageLabels[a.stage]}
                    </span>
                  </td>
                  <td className="px-4 py-5 text-xs text-muted-foreground">
                    {a.appliedAt
                      ? new Date(a.appliedAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          timeZone: "UTC",
                        })
                      : "—"}
                  </td>
                  <td className="px-4 py-5">
                    <div className="flex justify-end gap-1">
                      {a.url && (
                        <Button variant="ghost" size="icon" asChild>
                          <a
                            href={a.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`Open job listing for ${a.company}`}
                          >
                            <ExternalLink />
                          </a>
                        </Button>
                      )}
                      {!demo && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={pending}
                            aria-label={`Edit ${a.company} application`}
                            onClick={() => {
                              setEditing(a);
                              setOpen(true);
                            }}
                          >
                            <Pencil />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={pending}
                            aria-label={`${archived ? "Restore" : "Archive"} ${a.company} application`}
                            onClick={() => toggleArchive(a)}
                          >
                            {archived ? <ArchiveRestore /> : <Archive />}
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!rows.length && (
          <div className="px-6 py-16 text-center">
            <BriefcaseBusiness
              size={30}
              className="mx-auto mb-4 text-primary"
            />
            <h2 className="font-semibold">
              {query || stage
                ? "No matching applications"
                : archived
                  ? "Nothing archived yet"
                  : "Your next chapter starts with one application"}
            </h2>
            <p className="mt-2 text-xs text-muted-foreground">
              {query || stage
                ? "Try a different company, role, or stage."
                : archived
                  ? "Archived applications remain in your history."
                  : "Add an opportunity you’re excited about to get started."}
            </p>
          </div>
        )}
        <div className="flex items-center justify-between border-t border-border px-6 py-4 text-[11px] text-muted-foreground">
          <span>
            {total === 0
              ? "0 applications"
              : `${(page - 1) * 20 + 1}–${Math.min(page * 20, total)} of ${total} applications`}
          </span>
          <div className="flex items-center gap-3">
            <span className="hidden items-center gap-1 sm:flex">
              <ArrowDownUp size={12} />
              Newest first
            </span>
            {page > 1 && (
              <Link
                aria-label="Previous page"
                className="rounded border border-border p-1"
                href={href(page - 1)}
              >
                <ChevronLeft size={16} />
              </Link>
            )}
            {page * 20 < total && (
              <Link
                aria-label="Next page"
                className="rounded border border-border p-1"
                href={href(page + 1)}
              >
                <ChevronRight size={16} />
              </Link>
            )}
          </div>
        </div>
      </section>
      {demo && (
        <p className="mt-4 text-xs text-muted-foreground">
          This preview is read-only. Sign in to save your own applications.
        </p>
      )}
      {!demo && open && (
        <ApplicationEditor
          key={editing?.id ?? "new"}
          application={editing}
          open={open}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
