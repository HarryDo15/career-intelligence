"use client";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ApplicationRow } from "@/lib/application";
export function TrendChart({
  applications,
}: {
  applications: ApplicationRow[];
}) {
  const now = new Date();
  const data = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() - 29 + i,
      ),
    );
    const date = d.toISOString().slice(0, 10);
    return {
      date,
      label: d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      }),
      applications: applications.filter(
        (a) => a.appliedAt?.slice(0, 10) === date,
      ).length,
    };
  });
  return (
    <div
      className="h-[235px] w-full"
      role="img"
      aria-label={`Application activity: ${data.reduce((s, d) => s + d.applications, 0)} submissions in the last 30 days, grouped by UTC date.`}
    >
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <AreaChart
          data={data}
          margin={{ top: 10, right: 8, left: -28, bottom: 0 }}
        >
          <defs>
            <linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#8975e8" stopOpacity={0.25} />
              <stop offset="100%" stopColor="#8975e8" stopOpacity={0.015} />
            </linearGradient>
          </defs>
          <CartesianGrid
            vertical={false}
            stroke="#eff0f5"
            strokeDasharray="4 4"
          />
          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            minTickGap={40}
            tick={{ fontSize: 10, fill: "#9498a6" }}
            dy={9}
          />
          <YAxis
            allowDecimals={false}
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 10, fill: "#9498a6" }}
          />
          <Tooltip
            contentStyle={{
              border: "1px solid #e9eaf1",
              borderRadius: 10,
              fontSize: 12,
            }}
          />
          <Area
            type="monotone"
            dataKey="applications"
            name="Applications"
            stroke="#8874df"
            strokeWidth={2.5}
            fill="url(#trend-fill)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
