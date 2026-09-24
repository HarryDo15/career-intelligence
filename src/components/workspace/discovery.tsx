"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Bookmark,
  Check,
  Compass,
  MapPin,
  Pencil,
  Play,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { manageDiscovery } from "@/features/discovery/actions";
import type { ProfileRow, DiscoveredRow } from "@/lib/jobs";
export function Discovery({
  profiles,
  rows,
  total,
  page = 1,
  view = "new",
  demo = false,
  scheduling = false,
}: {
  profiles: ProfileRow[];
  rows: DiscoveredRow[];
  total: number;
  page?: number;
  view?: string;
  demo?: boolean;
  scheduling?: boolean;
}) {
  const [editing, setEditing] = useState<{ profile?: ProfileRow } | null>(null);
  const [deleting, setDeleting] = useState<ProfileRow | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const href = (tab: string, n = 1) =>
    demo
      ? `/demo?view=discovered&tab=${tab}&page=${n}`
      : `/discovered?view=${tab}&page=${n}`;
  function action(operation: string, input: unknown, meta?: unknown) {
    setError("");
    setNotice("");
    startTransition(async () => {
      try {
        const result = await manageDiscovery(operation, input, meta);
        if (result.ok) {
          setEditing(null);
          setDeleting(null);
          setNotice(
            operation === "run"
              ? result.skipped
                ? "Profile paused or changed. Refresh before running again."
                : `${result.count} matching synthetic listings. Repeated runs in the same hour reuse the result.`
              : operation === "save"
                ? "Saved to Wishlist. Find it in Applications."
                : operation === "profile.save"
                  ? "Profile saved. Run a mock search to see matches."
                  : "Changes saved.",
          );
          router.refresh();
        } else setError(result.error);
      } catch {
        setError("Couldn’t complete the request. Please try again.");
      }
    });
  }
  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="mb-2 text-[11px] font-semibold tracking-[.13em] text-primary">
            MAKE ROOM FOR POSSIBILITY
          </p>
          <h1 className="text-[27px] font-semibold tracking-tight">
            Discovered jobs
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Find opportunities that fit the way you want to work.
          </p>
        </div>
        {demo ? (
          <Button asChild>
            <Link href="/sign-in">
              <Plus />
              Create search profile
            </Link>
          </Button>
        ) : (
          <Button
            onClick={() => {
              setError("");
              setEditing({});
            }}
          >
            <Plus />
            Create search profile
          </Button>
        )}
      </div>
      <div className="mb-6 rounded-xl border border-[#e7e2fa] bg-secondary p-4 text-xs leading-relaxed text-[#65588f]">
        <strong>Mock discovery is active.</strong> These are fictional listings
        for portfolio testing, not live LinkedIn jobs.{" "}
        {scheduling
          ? "Hourly scheduling runs while the configured Inngest runner is online."
          : "Automatic scheduling is not configured. You can run a mock search manually."}
      </div>
      {notice && (
        <p
          role="status"
          className="mb-4 rounded-lg bg-emerald-50 p-3 text-xs text-emerald-700"
        >
          {notice}
        </p>
      )}
      {error && !editing && (
        <p
          role="alert"
          className="mb-4 rounded-lg bg-rose-50 p-3 text-xs text-rose-700"
        >
          {error}
        </p>
      )}
      <section className="mb-7">
        <div className="mb-3 flex items-center gap-2">
          <Search size={16} className="text-primary" />
          <h2 className="text-sm font-semibold">Your search profiles</h2>
          <span className="text-xs text-muted-foreground">
            {profiles.length}/10
          </span>
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          {profiles.map((profile) => (
            <article key={profile.id} className="panel p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold">{profile.name}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {profile.titles.join(", ")}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2 py-1 text-[10px] ${profile.enabled ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}
                >
                  {profile.enabled ? "Enabled" : "Paused"}
                </span>
              </div>
              <p className="mt-3 text-[11px] text-muted-foreground">
                {profile.workModes.length
                  ? profile.workModes.map((m) => m.toLowerCase()).join(" / ")
                  : "Any arrangement"}{" "}
                · {profile.locations.join(", ") || "Any location"}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Keywords: {profile.keywords.join(", ") || "any"}
                {profile.excludedKeywords.length
                  ? ` · Exclude: ${profile.excludedKeywords.join(", ")}`
                  : ""}
              </p>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
                <span className="text-[10px] text-muted-foreground">
                  {profile.lastStatus === "FAILED"
                    ? "Last run failed · try again"
                    : profile.lastRunAt
                      ? `Last success: ${new Date(profile.lastRunAt).toISOString().slice(0, 16).replace("T", " ")} UTC · ${profile.lastResultCount ?? 0} matches`
                      : "Not run yet"}
                </span>
                {!demo && (
                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pending || !profile.enabled}
                      onClick={() =>
                        action("run", {
                          id: profile.id,
                          version: profile.version,
                        })
                      }
                    >
                      <Play />
                      Run mock search
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={pending}
                      aria-label={`Edit ${profile.name}`}
                      onClick={() => {
                        setError("");
                        setEditing({ profile });
                      }}
                    >
                      <Pencil />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={pending}
                      aria-label={`Delete ${profile.name}`}
                      onClick={() => setDeleting(profile)}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                )}
              </div>
            </article>
          ))}
          {!profiles.length && (
            <div className="panel p-8 text-center lg:col-span-2">
              <Compass className="mx-auto mb-3 text-primary" />
              <h3 className="text-sm font-medium">
                Give your search a direction.
              </h3>
              <p className="mt-2 text-xs text-muted-foreground">
                Create a profile with titles, keywords, locations, and work
                arrangements.
              </p>
            </div>
          )}
        </div>
      </section>
      <section>
        <nav
          className="mb-4 flex gap-5 border-b border-border"
          aria-label="Discovered job filters"
        >
          {["new", "saved", "dismissed"].map((tab) => (
            <Link
              aria-current={view === tab ? "page" : undefined}
              key={tab}
              href={href(tab)}
              className={`border-b-2 py-3 text-xs capitalize ${view === tab ? "border-primary font-semibold text-primary" : "border-transparent text-muted-foreground"}`}
            >
              {tab === "new" ? "New matches" : tab}
            </Link>
          ))}
        </nav>
        <div className="grid gap-4 xl:grid-cols-2">
          {rows.map((job) => (
            <article key={job.id} className="panel flex flex-col p-6">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-primary">
                  Synthetic listing
                </span>
                {job.matches[0] && (
                  <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] text-emerald-700">
                    {Math.round(job.matches[0].score * 100)}% rule match
                  </span>
                )}
              </div>
              <h3 className="text-base font-semibold">{job.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {job.company}
              </p>
              <p className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin size={13} />
                {job.location} · {job.workMode.toLowerCase()}
              </p>
              <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
                {job.description}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {job.matches.map((m, index) => (
                  <details
                    key={`${m.name}-${index}`}
                    className="rounded-lg bg-background px-3 py-2 text-[10px] text-muted-foreground"
                  >
                    <summary className="cursor-pointer">
                      Why this matched: {m.name}
                    </summary>
                    <ul className="mt-2 list-inside list-disc space-y-1">
                      {m.reasons.map((r) => (
                        <li key={r}>{r}</li>
                      ))}
                    </ul>
                  </details>
                ))}
              </div>
              <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                {demo ? (
                  <Button variant="outline" size="sm" asChild>
                    <Link href="/sign-in">Sign in to save</Link>
                  </Button>
                ) : job.applicationId ? (
                  <Link
                    href="/applications"
                    className="flex items-center gap-1 text-xs text-emerald-700"
                  >
                    <Check size={14} />
                    In your tracker
                  </Link>
                ) : (
                  <Button
                    size="sm"
                    disabled={pending}
                    onClick={() => action("save", job.id)}
                  >
                    <Bookmark />
                    Save to Wishlist
                  </Button>
                )}
                {!demo && (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={pending}
                    onClick={() =>
                      action(
                        view === "dismissed" ? "restore" : "dismiss",
                        job.id,
                      )
                    }
                  >
                    {view === "dismissed" ? (
                      "Restore"
                    ) : (
                      <>
                        <X />
                        Dismiss
                      </>
                    )}
                  </Button>
                )}
              </div>
            </article>
          ))}
        </div>
        {!rows.length && (
          <div className="panel p-12 text-center">
            <Search className="mx-auto mb-3 text-primary" />
            <h3 className="text-sm font-medium">
              {view === "new" ? "No new matches yet" : `No ${view} listings`}
            </h3>
            <p className="mt-2 text-xs text-muted-foreground">
              {view === "new"
                ? "Create a profile and run a mock search. Try “engineer” for a broad first search."
                : "Your saved or dismissed opportunities will appear here."}
            </p>
          </div>
        )}
        <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
          <span>{total} listings</span>
          <div className="flex gap-4">
            {page > 1 && <Link href={href(view, page - 1)}>← Previous</Link>}
            {page * 20 < total && (
              <Link href={href(view, page + 1)}>Next →</Link>
            )}
          </div>
        </div>
      </section>
      <Dialog
        open={Boolean(editing)}
        onOpenChange={(v) => {
          if (!v && !pending) setEditing(null);
        }}
      >
        <DialogContent>
          <DialogTitle className="text-lg font-semibold">
            {editing?.profile
              ? "Edit search profile"
              : "Find your next opportunity"}
          </DialogTitle>
          <DialogDescription className="mt-2 text-xs leading-relaxed text-muted-foreground">
            Separate terms with commas. Any title and any keyword may match;
            excluded terms always win. Location and work arrangement are both
            required when set.
          </DialogDescription>
          {editing && (
            <form
              className="mt-5 space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                const form = new FormData(e.currentTarget);
                const terms = (key: string) =>
                  String(form.get(key) || "")
                    .split(",")
                    .map((v) => v.trim())
                    .filter(Boolean);
                action(
                  "profile.save",
                  {
                    name: String(form.get("name")),
                    titles: terms("titles"),
                    keywords: terms("keywords"),
                    excludedKeywords: terms("excludedKeywords"),
                    locations: terms("locations"),
                    workModes: form.getAll("workModes"),
                    enabled: form.get("enabled") === "on",
                  },
                  editing.profile
                    ? {
                        id: editing.profile.id,
                        version: editing.profile.version,
                      }
                    : undefined,
                );
              }}
            >
              <fieldset disabled={pending} className="space-y-4">
                <label className="block">
                  <span className="label">Profile name</span>
                  <input
                    className="field"
                    name="name"
                    required
                    maxLength={100}
                    defaultValue={editing.profile?.name ?? ""}
                    placeholder="My next engineering role"
                  />
                </label>
                {[
                  {
                    name: "titles",
                    label: "Job titles *",
                    placeholder: "frontend engineer, full-stack engineer",
                  },
                  {
                    name: "keywords",
                    label: "Include keywords",
                    placeholder: "react, typescript",
                  },
                  {
                    name: "excludedKeywords",
                    label: "Exclude keywords",
                    placeholder: "intern, internship",
                  },
                  {
                    name: "locations",
                    label: "Locations",
                    placeholder: "Singapore, London",
                  },
                ].map((field) => (
                  <label key={field.name} className="block">
                    <span className="label">{field.label}</span>
                    <input
                      className="field"
                      name={field.name}
                      required={field.name === "titles"}
                      maxLength={2000}
                      defaultValue={
                        editing.profile?.[
                          field.name as
                            | "titles"
                            | "keywords"
                            | "excludedKeywords"
                            | "locations"
                        ].join(", ") ?? ""
                      }
                      placeholder={field.placeholder}
                    />
                  </label>
                ))}
                <fieldset>
                  <legend className="label">
                    Work arrangement · leave empty for any
                  </legend>
                  <div className="flex gap-5">
                    {["REMOTE", "HYBRID", "ONSITE"].map((mode) => (
                      <label
                        key={mode}
                        className="flex items-center gap-2 text-xs"
                      >
                        <input
                          type="checkbox"
                          name="workModes"
                          value={mode}
                          defaultChecked={editing.profile?.workModes.includes(
                            mode as "REMOTE",
                          )}
                        />
                        {mode.toLowerCase()}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    name="enabled"
                    defaultChecked={editing.profile?.enabled ?? true}
                  />
                  Enable hourly discovery
                </label>
              </fieldset>
              {error && (
                <p
                  role="alert"
                  className="rounded-lg bg-rose-50 p-3 text-xs text-rose-700"
                >
                  {error}
                </p>
              )}
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : "Save profile"}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(deleting)}
        onOpenChange={(v) => {
          if (!v && !pending) setDeleting(null);
        }}
      >
        <DialogContent>
          <DialogTitle className="text-lg font-semibold">
            Delete this search profile?
          </DialogTitle>
          <DialogDescription className="mt-3 text-sm text-muted-foreground">
            {deleting?.name} will stop running. Previously discovered listings
            and saved applications will remain.
          </DialogDescription>
          <div className="mt-5 flex justify-end gap-2">
            <Button
              variant="outline"
              disabled={pending}
              onClick={() => setDeleting(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() =>
                deleting &&
                action("profile.delete", {
                  id: deleting.id,
                  version: deleting.version,
                })
              }
            >
              Delete profile
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
