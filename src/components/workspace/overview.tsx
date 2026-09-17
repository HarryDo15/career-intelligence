import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  BriefcaseBusiness,
  CalendarDays,
  Clock3,
  MessageSquare,
  Target,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  stageLabels,
  stageStyles,
  type ApplicationRow,
} from "@/lib/application";
import { TrendChart } from "./trend-chart";
export function Overview({
  applications,
  demo = false,
}: {
  applications: ApplicationRow[];
  demo?: boolean;
}) {
  const submitted = applications.filter((a) => a.appliedAt);
  const responded = submitted.filter((a) => a.firstResponseAt);
  const interviews = submitted.filter((a) =>
    ["SCREENING", "TECHNICAL", "OFFER"].includes(a.stage),
  );
  const active = applications.filter(
    (a) =>
      !a.archivedAt && ["APPLIED", "SCREENING", "TECHNICAL"].includes(a.stage),
  );
  const average = responded.length
    ? responded.reduce(
        (n, a) =>
          n +
          (new Date(a.firstResponseAt!).getTime() -
            new Date(a.appliedAt!).getTime()) /
            86400000,
        0,
      ) / responded.length
    : 0;
  const cards = [
    {
      label: "Applications sent",
      value: submitted.length,
      sub: "Your search, in motion",
      icon: BriefcaseBusiness,
      color: "text-primary bg-secondary",
    },
    {
      label: "In interviews",
      value: interviews.length,
      sub: "Screening, technical & offers",
      icon: MessageSquare,
      color: "text-blue-600 bg-blue-50",
    },
    {
      label: "Response rate",
      value: `${submitted.length ? Math.round((responded.length / submitted.length) * 100) : 0}%`,
      sub: `${responded.length} of ${submitted.length} applications`,
      icon: Target,
      color: "text-emerald-600 bg-emerald-50",
    },
    {
      label: "Avg. response time",
      value: responded.length ? `${average.toFixed(1)} days` : "—",
      sub: "Among applications with a response",
      icon: Clock3,
      color: "text-amber-600 bg-amber-50",
    },
  ];
  return (
    <>
      <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="mb-2 text-[11px] font-semibold tracking-[.13em] text-primary">
            YOUR CAREER, IN FOCUS
          </p>
          <h1 className="text-[27px] font-semibold tracking-tight">
            A clearer view of your next move.
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Every application is a step forward. Here’s where you stand.
          </p>
        </div>
        <Button asChild>
          <Link href={demo ? "/sign-in" : "/applications?new=1"}>
            <span className="text-lg font-normal">+</span>Add application
          </Link>
        </Button>
      </div>
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => (
          <section key={c.label} className="panel p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-medium text-muted-foreground">
                {c.label}
              </h2>
              <span className={`rounded-lg p-2 ${c.color}`}>
                <c.icon size={17} />
              </span>
            </div>
            <p className="tabular mt-3 text-3xl font-semibold tracking-tight">
              {c.value}
            </p>
            <p className="mt-3 text-[11px] text-muted-foreground">{c.sub}</p>
          </section>
        ))}
      </div>
      <div className="mb-6 grid gap-5 xl:grid-cols-[1.65fr_1fr]">
        <section className="panel p-6">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="font-semibold">Application activity</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Consistency is your competitive edge.
              </p>
            </div>
            <span className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-[11px] text-muted-foreground">
              <CalendarDays size={13} />
              Last 30 days
            </span>
          </div>
          <TrendChart applications={applications} />
        </section>
        <section className="panel p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Your pipeline</h2>
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-700">
              {active.length} active
            </span>
          </div>
          <p className="mt-1 mb-6 text-xs text-muted-foreground">
            A snapshot of where things stand.
          </p>
          <div className="space-y-4">
            {Object.entries(stageLabels).map(([key, label]) => {
              const count = applications.filter(
                (a) => !a.archivedAt && a.stage === key,
              ).length;
              return (
                <div
                  key={key}
                  className="grid grid-cols-[85px_1fr_20px] items-center gap-3 text-xs"
                >
                  <span className="text-muted-foreground">{label}</span>
                  <div className="h-2 rounded-full bg-background">
                    <div
                      className={`h-2 rounded-full ${key === "OFFER" ? "bg-emerald-400" : key === "REJECTED" ? "bg-rose-300" : "bg-primary/70"}`}
                      style={{
                        width: `${applications.length ? (count / applications.length) * 100 : 0}%`,
                      }}
                    />
                  </div>
                  <span className="tabular text-right font-semibold">
                    {count}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="mt-6 border-t border-border pt-4 text-[11px] text-muted-foreground">
            One good conversation can change everything.
          </div>
        </section>
      </div>
      <section className="panel overflow-hidden">
        <div className="flex items-center justify-between p-6">
          <div>
            <h2 className="font-semibold">Recent applications</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Keep the opportunities that matter in sight.
            </p>
          </div>
          <Link
            className="flex items-center gap-1 text-xs font-medium text-primary"
            href={demo ? "/demo?view=applications" : "/applications"}
          >
            View all
            <ArrowRight size={14} />
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="border-y border-border bg-[#fcfcfe] text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr>
                {["Company & role", "Location", "Stage", "Applied"].map((h) => (
                  <th key={h} className="px-6 py-3 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {applications
                .filter((a) => !a.archivedAt)
                .slice(0, 5)
                .map((a, i) => (
                  <tr
                    key={a.id}
                    className="border-b border-border last:border-0"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <span
                          className={`flex size-9 shrink-0 items-center justify-center rounded-lg font-bold ${["bg-[#f0edff] text-primary", "bg-[#242630] text-white", "bg-[#f6f4ef] text-[#6d6255]", "bg-[#e9f3ff] text-blue-600"][i % 4]}`}
                        >
                          {a.company.slice(0, 1)}
                        </span>
                        <div>
                          <div className="text-xs font-semibold">
                            {a.company}
                          </div>
                          <div className="mt-1 text-[11px] text-muted-foreground">
                            {a.title}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs text-muted-foreground">
                      {a.location || "Not specified"}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-medium ${stageStyles[a.stage]}`}
                      >
                        • {stageLabels[a.stage]}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-muted-foreground">
                      {a.appliedAt
                        ? new Date(a.appliedAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            timeZone: "UTC",
                          })
                        : "—"}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
          {!applications.length && (
            <div className="p-12 text-center">
              <BriefcaseBusiness className="mx-auto mb-3 text-primary" />
              <p className="font-medium">Your next chapter is a blank page.</p>
              <p className="mt-2 text-xs text-muted-foreground">
                Add your first application to start seeing your progress.
              </p>
            </div>
          )}
        </div>
      </section>
      <div className="mt-5 flex items-center gap-2 text-[11px] text-muted-foreground">
        <ArrowUpRight size={14} />
        Metrics cover all tracked applications. Activity chart covers the last
        30 days.
      </div>
    </>
  );
}
