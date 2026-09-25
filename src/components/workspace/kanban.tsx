"use client";
import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  GripVertical,
  Pencil,
  Search,
  LayoutList,
  Columns3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  stageLabels,
  stageStyles,
  stages,
  type ApplicationRow,
  type Stage,
} from "@/lib/application";
import { moveApplication } from "@/features/applications/actions";
import { ApplicationEditor } from "./application-editor";
export type BoardColumn = {
  stage: Stage;
  total: number;
  rows: ApplicationRow[];
};
export function Kanban({
  columns,
  query = "",
  demo = false,
  initialNew = false,
}: {
  columns: BoardColumn[];
  query?: string;
  demo?: boolean;
  initialNew?: boolean;
}) {
  const rows = columns.flatMap((c) => c.rows);
  const [optimistic, moveOptimistic] = useOptimistic(
    rows,
    (current: ApplicationRow[], move: { id: string; stage: Stage }) =>
      current.map((a) => (a.id === move.id ? { ...a, stage: move.stage } : a)),
  );
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [dragged, setDragged] = useState<string | null>(null);
  const [dates, setDates] = useState<{
    row: ApplicationRow;
    stage: Stage;
  } | null>(null);
  const [editor, setEditor] = useState<{ row?: ApplicationRow } | null>(
    initialNew && !demo ? {} : null,
  );
  const router = useRouter();
  const base = demo ? "/demo?view=applications" : "/applications";
  function commit(
    row: ApplicationRow,
    stage: Stage,
    extra?: { appliedAt?: string; firstResponseAt?: string },
  ) {
    setError("");
    setMessage("");
    setDates(null);
    startTransition(async () => {
      moveOptimistic({ id: row.id, stage });
      try {
        const result = await moveApplication(
          { id: row.id, version: row.version },
          { stage, ...extra },
        );
        if (result.ok)
          setMessage(`${row.company} moved to ${stageLabels[stage]}.`);
        else setError(result.error);
      } catch {
        setError("Couldn’t move this application. Refresh and try again.");
      }
      router.refresh();
    });
  }
  function move(row: ApplicationRow, stage: Stage) {
    if (demo || pending || stage === row.stage) return;
    if (
      (stage !== "WISHLIST" && !row.appliedAt) ||
      (["SCREENING", "TECHNICAL", "OFFER"].includes(stage) &&
        !row.firstResponseAt)
    ) {
      setDates({ row, stage });
    } else commit(row, stage);
  }
  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="mb-2 text-[11px] font-semibold tracking-[.13em] text-primary">
            EVERY OPPORTUNITY, IN MOTION
          </p>
          <h1 className="text-[27px] font-semibold tracking-tight">
            Your application pipeline
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Drag a card or use its stage menu to keep your progress up to date.
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
          <Button onClick={() => setEditor({})}>
            <Plus />
            Add application
          </Button>
        )}
      </div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <form
          action={demo ? "/demo" : "/applications"}
          className="flex flex-1 gap-2"
        >
          {demo && <input type="hidden" name="view" value="applications" />}
          <input type="hidden" name="layout" value="board" />
          <label className="relative w-full max-w-sm">
            <span className="sr-only">Search board</span>
            <Search
              size={15}
              className="absolute left-3 top-3 text-muted-foreground"
            />
            <input
              className="field pl-9"
              name="q"
              defaultValue={query}
              placeholder="Search company or role…"
              maxLength={160}
            />
          </label>
          <Button variant="outline">Search</Button>
        </form>
        <div className="flex rounded-lg border border-border bg-white p-1">
          <Button variant="ghost" size="sm" asChild>
            <Link
              href={`${base}${demo ? "&" : "?"}q=${encodeURIComponent(query)}`}
            >
              <LayoutList />
              Table
            </Link>
          </Button>
          <span className="flex items-center gap-2 rounded-md bg-secondary px-3 text-xs font-medium text-primary">
            <Columns3 size={14} />
            Board
          </span>
        </div>
      </div>
      {error && (
        <p
          role="alert"
          className="mb-4 rounded-lg bg-rose-50 p-3 text-xs text-rose-700"
        >
          {error}{" "}
          <button className="underline" onClick={() => router.refresh()}>
            Refresh board
          </button>
        </p>
      )}
      <p
        role="status"
        aria-live="polite"
        className="mb-3 text-xs text-muted-foreground"
      >
        {pending
          ? "Saving move…"
          : message ||
            `${columns.reduce((s, c) => s + c.total, 0)} active and terminal applications · Archived cards are in the table view.`}
      </p>
      <div
        className="grid auto-cols-[minmax(235px,1fr)] grid-flow-col gap-4 overflow-x-auto pb-5"
        aria-label="Application Kanban board"
      >
        {columns.map((column) => {
          const cards = optimistic.filter((a) => a.stage === column.stage);
          const total =
            column.total +
            cards.length -
            rows.filter((a) => a.stage === column.stage).length;
          return (
            <section
              key={column.stage}
              className={`min-h-[390px] rounded-xl border border-border bg-[#f0f1f7] p-3 ${dragged ? "outline-dashed outline-1 outline-primary/30" : ""}`}
              aria-label={`${stageLabels[column.stage]} column`}
              onDragOver={(e) => {
                if (dragged && !pending) e.preventDefault();
              }}
              onDrop={(e) => {
                e.preventDefault();
                const row = rows.find((a) => a.id === dragged);
                setDragged(null);
                if (row) move(row, column.stage);
              }}
            >
              <header className="mb-4 flex items-center justify-between px-1">
                <h2 className="text-xs font-semibold">
                  {stageLabels[column.stage]}
                </h2>
                <span className="rounded bg-white px-2 py-1 text-[10px] text-muted-foreground">
                  {total}
                </span>
              </header>
              <div className="space-y-3">
                {cards.map((row) => (
                  <article
                    key={row.id}
                    draggable={!demo && !pending}
                    onDragStart={(e) => {
                      setDragged(row.id);
                      e.dataTransfer.setData("text/plain", row.id);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onDragEnd={() => setDragged(null)}
                    className="rounded-lg border border-border bg-white p-4 shadow-xs"
                    aria-label={`${row.company}, ${row.title}`}
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <span className="flex size-8 items-center justify-center rounded-lg bg-secondary text-xs font-semibold text-primary">
                        {row.company.slice(0, 1)}
                      </span>
                      <GripVertical
                        size={14}
                        className="text-muted-foreground"
                        aria-hidden="true"
                      />
                    </div>
                    <h3 className="text-xs font-semibold">{row.company}</h3>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      {row.title}
                    </p>
                    <p className="mt-3 text-[10px] text-muted-foreground">
                      {row.location || "Location not specified"}
                    </p>
                    <div className="mt-4 flex items-center gap-2">
                      {demo ? (
                        <span
                          className={`rounded-full px-2 py-1 text-[10px] ${stageStyles[row.stage]}`}
                        >
                          {stageLabels[row.stage]}
                        </span>
                      ) : (
                        <>
                          <label className="min-w-0 flex-1">
                            <span className="sr-only">
                              Stage for {row.company} {row.title}
                            </span>
                            <select
                              disabled={pending}
                              value={row.stage}
                              onChange={(e) =>
                                move(row, e.target.value as Stage)
                              }
                              className="field py-1.5 text-[11px]"
                            >
                              {stages.map((s) => (
                                <option key={s} value={s}>
                                  {stageLabels[s]}
                                </option>
                              ))}
                            </select>
                          </label>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={pending}
                            aria-label={`Edit ${row.company}`}
                            onClick={() => setEditor({ row })}
                          >
                            <Pencil />
                          </Button>
                        </>
                      )}
                    </div>
                  </article>
                ))}
                {!cards.length && (
                  <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-xs text-muted-foreground">
                    {demo
                      ? "No applications here yet"
                      : "Drop a card here, or choose this stage from a card’s menu."}
                  </p>
                )}
              </div>
              {column.total > column.rows.length && (
                <Link
                  className="mt-4 block text-xs text-primary"
                  href={`/applications?stage=${column.stage}&q=${encodeURIComponent(query)}`}
                >
                  Showing latest 40 · View all {column.total}
                </Link>
              )}
            </section>
          );
        })}
      </div>
      {editor && (
        <ApplicationEditor
          open
          application={editor.row}
          onClose={() => setEditor(null)}
        />
      )}
      <Dialog
        open={Boolean(dates)}
        onOpenChange={(v) => {
          if (!v) setDates(null);
        }}
      >
        <DialogContent>
          <DialogTitle className="text-lg font-semibold">
            Move to {dates ? stageLabels[dates.stage] : "stage"}
          </DialogTitle>
          <DialogDescription className="mt-2 text-xs text-muted-foreground">
            Add the dates for this milestone so your response metrics stay
            accurate. Existing dates are preserved.
          </DialogDescription>
          {dates && (
            <form
              className="mt-5 space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                const form = new FormData(e.currentTarget);
                commit(dates.row, dates.stage, {
                  appliedAt: dates.row.appliedAt
                    ? undefined
                    : String(form.get("appliedAt") || ""),
                  firstResponseAt: dates.row.firstResponseAt
                    ? undefined
                    : String(form.get("firstResponseAt") || ""),
                });
              }}
            >
              <label className="block">
                <span className="label">Applied on</span>
                <input
                  className="field"
                  name="appliedAt"
                  type="date"
                  required={dates.stage !== "WISHLIST"}
                  readOnly={Boolean(dates.row.appliedAt)}
                  defaultValue={dates.row.appliedAt?.slice(0, 10) ?? ""}
                  max={new Date().toISOString().slice(0, 10)}
                />
              </label>
              <label className="block">
                <span className="label">First meaningful response</span>
                <input
                  className="field"
                  name="firstResponseAt"
                  type="date"
                  required={["SCREENING", "TECHNICAL", "OFFER"].includes(
                    dates.stage,
                  )}
                  readOnly={Boolean(dates.row.firstResponseAt)}
                  defaultValue={dates.row.firstResponseAt?.slice(0, 10) ?? ""}
                  max={new Date().toISOString().slice(0, 10)}
                />
              </label>
              <Button type="submit">Confirm move</Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
