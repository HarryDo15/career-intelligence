import { Temporal } from "@js-temporal/polyfill";
import { z } from "zod";
import { stages, type Stage } from "./application";
const calendarDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => {
    try {
      Temporal.PlainDate.from(v);
      return true;
    } catch {
      return false;
    }
  }, "Invalid calendar date");
export const analyticsInput = z
  .object({
    start: calendarDate,
    end: calendarDate,
    group: z.enum(["week", "month"]),
    timezone: z
      .string()
      .max(100)
      .refine((v) => {
        try {
          new Intl.DateTimeFormat("en", { timeZone: v });
          return true;
        } catch {
          return false;
        }
      }, "Unknown timezone"),
  })
  .refine((v) => {
    try {
      const a = Temporal.PlainDate.from(v.start),
        b = Temporal.PlainDate.from(v.end);
      return Temporal.PlainDate.compare(a, b) <= 0 && a.until(b).days <= 730;
    } catch {
      return false;
    }
  }, "Choose a date range of no more than two years");
export type AnalyticsFilter = z.infer<typeof analyticsInput>;
export type AnalyticsRow = {
  stage: Stage;
  appliedAt: Date | null;
  firstResponseAt: Date | null;
  history: { toStage: Stage }[];
};
export function defaultFilter(
  timezone = "Asia/Singapore",
  now = new Date(),
): AnalyticsFilter {
  const today = Temporal.Instant.from(now.toISOString())
    .toZonedDateTimeISO(timezone)
    .toPlainDate();
  return {
    start: today.subtract({ days: 89 }).toString(),
    end: today.toString(),
    group: "week",
    timezone,
  };
}
export function windowFor(input: unknown) {
  const filter = analyticsInput.parse(input);
  return {
    filter,
    start: new Date(
      Temporal.PlainDate.from(filter.start).toZonedDateTime(filter.timezone)
        .epochMilliseconds,
    ),
    end: new Date(
      Temporal.PlainDate.from(filter.end)
        .add({ days: 1 })
        .toZonedDateTime(filter.timezone).epochMilliseconds,
    ),
  };
}
function bucket(date: Temporal.PlainDate, group: "week" | "month") {
  return group === "month"
    ? date.with({ day: 1 })
    : date.subtract({ days: date.dayOfWeek - 1 });
}
export function summarize(
  rows: AnalyticsRow[],
  input: unknown,
  active: number,
) {
  const { filter, start, end } = windowFor(input);
  const cohort = rows.filter(
    (a) => a.appliedAt && a.appliedAt >= start && a.appliedAt < end,
  );
  const responded = cohort.filter(
    (a) => a.firstResponseAt && a.firstResponseAt >= a.appliedAt!,
  );
  const reached = (a: AnalyticsRow, values: Stage[]) =>
    values.includes(a.stage) ||
    a.history.some((e) => values.includes(e.toStage));
  const interviewed = cohort.filter((a) =>
    reached(a, ["SCREENING", "TECHNICAL", "OFFER"]),
  ).length;
  const offered = cohort.filter((a) => reached(a, ["OFFER"])).length;
  const buckets = new Map<string, number>();
  let current = bucket(Temporal.PlainDate.from(filter.start), filter.group);
  const last = bucket(Temporal.PlainDate.from(filter.end), filter.group);
  while (Temporal.PlainDate.compare(current, last) <= 0) {
    buckets.set(current.toString(), 0);
    current = current.add(
      filter.group === "week" ? { weeks: 1 } : { months: 1 },
    );
  }
  for (const row of cohort) {
    const local = Temporal.Instant.from(row.appliedAt!.toISOString())
      .toZonedDateTimeISO(filter.timezone)
      .toPlainDate();
    const key = bucket(local, filter.group).toString();
    buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }
  const rate = (n: number) =>
    cohort.length ? Math.round((n / cohort.length) * 1000) / 10 : 0;
  return {
    filter,
    total: cohort.length,
    interviewed,
    offered,
    responded: responded.length,
    interviewRate: rate(interviewed),
    responseRate: rate(responded.length),
    active,
    averageHours: responded.length
      ? responded.reduce(
          (sum, a) =>
            sum +
            (a.firstResponseAt!.getTime() - a.appliedAt!.getTime()) / 3600000,
          0,
        ) / responded.length
      : null,
    trend: [...buckets].map(([date, count]) => ({ date, count })),
    statuses: stages.map((stage) => ({
      stage,
      count: cohort.filter((a) => a.stage === stage).length,
    })),
    funnel: [
      { label: "Applied", count: cohort.length, rate: cohort.length ? 100 : 0 },
      { label: "Interviewed", count: interviewed, rate: rate(interviewed) },
      { label: "Offered", count: offered, rate: rate(offered) },
    ],
  };
}
export type Analytics = ReturnType<typeof summarize>;
