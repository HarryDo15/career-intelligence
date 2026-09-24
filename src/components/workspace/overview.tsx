import Link from "next/link";
import {
  ArrowRight,
  BriefcaseBusiness,
  Clock3,
  MessageSquare,
  Target,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  stageLabels,
  stageStyles,
  type ApplicationRow,
} from "@/lib/application";
import type { Analytics } from "@/lib/analytics";
import { AnalyticsCharts } from "./analytics-charts";
export function Overview({
  applications,
  data,
  demo = false,
}: {
  applications: ApplicationRow[];
  data: Analytics;
  demo?: boolean;
}) {
  const metrics = [
    {
      label: "Applications sent",
      value: data.total,
      note: "Submitted in the selected range",
      icon: BriefcaseBusiness,
    },
    {
      label: "Interview conversion",
      value: `${data.interviewRate}%`,
      note: `${data.interviewed} applications reached interviews`,
      icon: MessageSquare,
    },
    {
      label: "Response rate",
      value: `${data.responseRate}%`,
      note: `${data.responded} of ${data.total} received a response`,
      icon: Target,
    },
    {
      label: "Average response",
      value:
        data.averageHours === null
          ? "—"
          : `${(data.averageHours / 24).toFixed(1)} days`,
      note: "Among applications with a response",
      icon: Clock3,
    },
    {
      label: "Active pipelines",
      value: data.active,
      note: "All dates · excludes archived cards",
      icon: TrendingUp,
    },
  ];
  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="mb-2 text-[11px] font-semibold tracking-[.13em] text-primary">
            YOUR CAREER, IN FOCUS
          </p>
          <h1 className="text-[27px] font-semibold tracking-tight">
            A clearer view of your next move.
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Understand your progress, from the first application to the offer.
          </p>
        </div>
        <Button asChild>
          <Link href={demo ? "/sign-in" : "/applications?new=1"}>
            + Add application
          </Link>
        </Button>
      </div>
      <form
        action={demo ? "/demo" : "/dashboard"}
        className="panel mb-6 flex flex-wrap items-end gap-3 p-4"
      >
        <label>
          <span className="label">Submitted from</span>
          <input
            className="field text-xs"
            type="date"
            name="start"
            defaultValue={data.filter.start}
            required
          />
        </label>
        <label>
          <span className="label">Through</span>
          <input
            className="field text-xs"
            type="date"
            name="end"
            defaultValue={data.filter.end}
            required
          />
        </label>
        <label>
          <span className="label">Group by</span>
          <select
            className="field text-xs"
            name="group"
            defaultValue={data.filter.group}
          >
            <option value="week">Week</option>
            <option value="month">Month</option>
          </select>
        </label>
        <label className="min-w-40 flex-1">
          <span className="label">Timezone</span>
          <input
            className="field text-xs"
            name="timezone"
            defaultValue={data.filter.timezone}
            list="timezones"
            required
            maxLength={100}
          />
          <datalist id="timezones">
            {[
              "Asia/Singapore",
              "UTC",
              "America/New_York",
              "America/Los_Angeles",
              "Europe/London",
              "Asia/Tokyo",
            ].map((t) => (
              <option key={t}>{t}</option>
            ))}
          </datalist>
        </label>
        <Button type="submit" variant="outline">
          Update view
        </Button>
      </form>
      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {metrics.map((m, i) => (
          <section className="panel p-5" key={m.label}>
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-[11px] font-medium text-muted-foreground">
                {m.label}
              </h2>
              <span
                className={`rounded-lg p-2 ${["bg-secondary text-primary", "bg-blue-50 text-blue-600", "bg-emerald-50 text-emerald-600", "bg-amber-50 text-amber-600", "bg-secondary text-primary"][i]}`}
              >
                <m.icon size={15} />
              </span>
            </div>
            <p className="tabular mt-3 text-[28px] font-semibold tracking-tight">
              {m.value}
            </p>
            <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground">
              {m.note}
            </p>
          </section>
        ))}
      </div>
      <AnalyticsCharts data={data} />
      <section className="panel mb-6 p-6">
        <h2 className="font-semibold">Application conversion funnel</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Ever reached each milestone, including applications later rejected or
          archived.
        </p>
        <div className="mt-5 grid gap-6 sm:grid-cols-3">
          {data.funnel.map((step, i) => (
            <div key={step.label}>
              <div className="mb-2 flex items-center justify-between text-xs">
                <span>{step.label}</span>
                <span className="tabular font-semibold">
                  {step.count}{" "}
                  <span className="font-normal text-muted-foreground">
                    · {step.rate}%
                  </span>
                </span>
              </div>
              <div className="h-3 rounded-full bg-background">
                <div
                  className={`h-3 rounded-full ${i === 2 ? "bg-emerald-400" : "bg-primary/70"}`}
                  style={{ width: `${step.rate}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>
      <section className="panel overflow-hidden">
        <header className="flex items-center justify-between p-6">
          <div>
            <h2 className="font-semibold">Recent applications</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Your latest nonarchived records, across all dates.
            </p>
          </div>
          <Link
            className="flex items-center gap-1 text-xs text-primary"
            href={demo ? "/demo?view=applications" : "/applications"}
          >
            View all
            <ArrowRight size={14} />
          </Link>
        </header>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="border-y border-border bg-background text-[10px] uppercase tracking-wide text-muted-foreground">
              <tr>
                {["Company & role", "Location", "Stage", "Applied"].map((h) => (
                  <th className="px-6 py-3 font-medium" key={h}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {applications.slice(0, 5).map((a) => (
                <tr key={a.id} className="border-b border-border last:border-0">
                  <td className="px-6 py-4">
                    <p className="text-xs font-semibold">{a.company}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {a.title}
                    </p>
                  </td>
                  <td className="px-6 py-4 text-xs text-muted-foreground">
                    {a.location || "Not specified"}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`whitespace-nowrap rounded-full px-2 py-1 text-[10px] ${stageStyles[a.stage]}`}
                    >
                      {stageLabels[a.stage]}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-xs text-muted-foreground">
                    {a.appliedAt?.slice(0, 10) ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!applications.length && (
            <p className="p-10 text-center text-sm text-muted-foreground">
              Add your first application to start seeing your progress.
            </p>
          )}
        </div>
      </section>
      <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
        Conversion metrics share the same {data.total}-application submission
        cohort. Responses and milestones reflect all recorded history.
        Weekly/monthly buckets include zero counts; edge buckets contain only
        the selected dates.
      </p>
    </>
  );
}
