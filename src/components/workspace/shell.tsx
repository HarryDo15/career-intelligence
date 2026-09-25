import Link from "next/link";
import {
  ArrowUpRight,
  BriefcaseBusiness,
  ChartNoAxesCombined,
  Compass,
  Layers2,
  Settings2,
  Sparkles,
  Target,
} from "lucide-react";
export function Shell({
  children,
  demo = false,
  name = "Your workspace",
  active = "dashboard",
}: {
  children: React.ReactNode;
  demo?: boolean;
  name?: string;
  active?: string;
}) {
  const base = demo ? "/demo" : "";
  return (
    <div className="min-h-screen lg:pl-60">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-60 flex-col border-r border-border bg-white lg:flex">
        <Link
          href={demo ? "/demo" : "/dashboard"}
          className="flex items-center gap-3 px-6 py-8"
        >
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-white">
            <Layers2 size={21} />
          </span>
          <span className="text-[15px] font-bold tracking-tight">
            career
            <span className="font-normal text-muted-foreground">
              {" "}
              intelligence
            </span>
          </span>
        </Link>
        <div className="mx-4 mb-8 flex items-center gap-3 rounded-lg border border-border p-3">
          <span className="flex size-8 items-center justify-center rounded-md bg-secondary font-semibold text-primary">
            {demo ? "D" : name.slice(0, 1).toUpperCase()}
          </span>
          <div>
            <div className="text-xs font-semibold">
              {demo ? "Demo workspace" : name}
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              Personal workspace
            </div>
          </div>
        </div>
        <p className="px-7 pb-3 text-[10px] font-semibold tracking-[.15em] text-muted-foreground">
          WORKSPACE
        </p>
        <nav className="space-y-1 px-4" aria-label="Main navigation">
          {[
            {
              key: "dashboard",
              label: "Overview",
              icon: ChartNoAxesCombined,
              href: demo ? base : "/dashboard",
            },
            {
              key: "applications",
              label: "Applications",
              icon: BriefcaseBusiness,
              href: demo ? "/demo?view=applications" : "/applications",
            },
            {
              key: "discovered",
              label: "Discovered jobs",
              icon: Compass,
              href: demo ? "/demo?view=discovered" : "/discovered",
            },
            {
              key: "settings",
              label: "Settings",
              icon: Settings2,
              href: demo ? "/sign-in" : "/settings",
            },
          ].map((item) => (
            <Link
              key={item.key}
              href={item.href}
              aria-current={active === item.key ? "page" : undefined}
              className={`flex items-center gap-3 rounded-lg px-3 py-3 text-[13px] ${active === item.key ? "bg-secondary font-semibold text-primary" : "text-muted-foreground hover:bg-background"}`}
            >
              <item.icon size={17} />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="mx-5 mt-auto mb-6 rounded-xl bg-[#f7f6fd] p-4">
          <Sparkles size={19} className="mb-3 text-primary" />
          <p className="text-xs font-semibold">
            Your next chapter starts here.
          </p>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            Small steps. Clear progress. A more intentional job search.
          </p>
          <div className="mt-4 flex items-center gap-2 text-[10px] text-muted-foreground">
            <span className="size-1.5 rounded-full bg-emerald-500" />
            Your search, with direction
          </div>
        </div>
      </aside>
      <header className="flex h-[72px] items-center justify-between border-b border-border bg-white px-5 sm:px-9">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Compass size={15} />
          <span>Workspace</span>
          <span className="mx-1 text-border">/</span>
          <span className="capitalize text-foreground">
            {active === "dashboard" ? "Overview" : active}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-xs text-muted-foreground sm:block">
            Built for your next move
          </span>
          <span className="size-7 rounded-full bg-secondary text-center text-xs leading-7 font-semibold text-primary">
            {demo ? "D" : name.slice(0, 1).toUpperCase()}
          </span>
        </div>
      </header>
      <nav
        className="flex flex-wrap gap-5 border-b border-border bg-white px-5 py-3 text-xs lg:hidden"
        aria-label="Mobile navigation"
      >
        <Link href={demo ? "/demo" : "/dashboard"}>Overview</Link>
        <Link href={demo ? "/demo?view=applications" : "/applications"}>
          Applications
        </Link>
        <Link href={demo ? "/demo?view=discovered" : "/discovered"}>
          Discovered jobs
        </Link>
        <Link href={demo ? "/sign-in" : "/settings"}>
          {demo ? "Sign in" : "Settings"}
        </Link>
      </nav>
      {demo && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e7e2fa] bg-[#f2effc] px-5 py-2.5 text-xs text-[#65588f] sm:px-9">
          <span className="flex items-center gap-2">
            <Target size={14} />
            Preview workspace · Synthetic data, read-only
          </span>
          <Link
            href="/sign-in"
            className="flex items-center gap-1 font-semibold"
          >
            Start your own workspace
            <ArrowUpRight size={14} />
          </Link>
        </div>
      )}
      <main id="main" className="mx-auto max-w-[1500px] p-5 sm:p-9">
        {children}
      </main>
      <footer className="px-9 pb-6 text-[11px] text-muted-foreground">
        Career Intelligence <span className="mx-2">·</span> A little clarity for
        your next big step.
      </footer>
    </div>
  );
}
