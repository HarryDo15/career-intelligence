"use client";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Analytics } from "@/lib/analytics";
import { stageLabels } from "@/lib/application";
export function AnalyticsCharts({ data }: { data: Analytics }) {
  const statuses = data.statuses.map((s) => ({
    name: stageLabels[s.stage],
    count: s.count,
  }));
  return (
    <div className="mb-6 grid gap-5 xl:grid-cols-[1.5fr_1fr]">
      <section className="panel p-6">
        <h2 className="font-semibold">Applications over time</h2>
        <p className="mt-1 mb-5 text-xs text-muted-foreground">
          {data.filter.group === "week"
            ? "Weeks begin Monday"
            : "Calendar months"}{" "}
          · {data.filter.timezone}
        </p>
        <div
          className="h-60 w-full"
          role="img"
          aria-label={`${data.total} submitted applications across ${data.trend.length} ${data.filter.group} buckets.`}
        >
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <AreaChart
              data={data.trend}
              margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
            >
              <defs>
                <linearGradient id="cohort-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8874df" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#8874df" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid
                vertical={false}
                stroke="#eff0f5"
                strokeDasharray="4 4"
              />
              <XAxis
                dataKey="date"
                tickFormatter={(v) => String(v).slice(5)}
                tick={{ fontSize: 10, fill: "#767b8c" }}
                minTickGap={30}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 10, fill: "#767b8c" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip />
              <Area
                type="monotone"
                dataKey="count"
                name="Applications"
                stroke="#8874df"
                strokeWidth={2.5}
                fill="url(#cohort-fill)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <details className="mt-4 text-xs text-muted-foreground">
          <summary className="cursor-pointer">View chart data</summary>
          <table className="mt-3 w-full text-left">
            <thead>
              <tr>
                <th>Bucket starting</th>
                <th>Applications</th>
              </tr>
            </thead>
            <tbody>
              {data.trend.map((t) => (
                <tr key={t.date}>
                  <td>{t.date}</td>
                  <td>{t.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </section>
      <section className="panel p-6">
        <h2 className="font-semibold">Current stage breakdown</h2>
        <p className="mt-1 mb-5 text-xs text-muted-foreground">
          Where the selected submissions stand today.
        </p>
        <div
          className="h-60"
          role="img"
          aria-label={statuses.map((s) => `${s.name}: ${s.count}`).join(", ")}
        >
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <BarChart
              data={statuses}
              layout="vertical"
              margin={{ left: 0, right: 20 }}
            >
              <CartesianGrid horizontal={false} stroke="#eff0f5" />
              <XAxis
                type="number"
                allowDecimals={false}
                tick={{ fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={78}
                tick={{ fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip />
              <Bar
                dataKey="count"
                name="Applications"
                radius={[0, 4, 4, 0]}
                barSize={15}
              >
                {statuses.map((s, i) => (
                  <Cell
                    key={s.name}
                    fill={
                      [
                        "#a6acc0",
                        "#829de8",
                        "#9c80e0",
                        "#e0b569",
                        "#65b79b",
                        "#df9caa",
                      ][i]
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}
