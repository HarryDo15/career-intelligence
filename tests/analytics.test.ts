import { test } from "node:test";
import assert from "node:assert/strict";
import { summarize, windowFor, type AnalyticsRow } from "../src/lib/analytics";
const filter = {
  start: "2026-03-01",
  end: "2026-03-31",
  group: "week",
  timezone: "UTC",
};
const row = (
  stage: AnalyticsRow["stage"],
  date: string | null,
  response: string | null = null,
  history: AnalyticsRow["history"] = [],
): AnalyticsRow => ({
  stage,
  appliedAt: date ? new Date(date) : null,
  firstResponseAt: response ? new Date(response) : null,
  history,
});
test("cohort counts historical interviews after rejection, implied interviews for offers, and excludes Wishlist with no submission", () => {
  const data = summarize(
    [
      row("REJECTED", "2026-03-03", "2026-03-05", [{ toStage: "TECHNICAL" }]),
      row("OFFER", "2026-03-05", "2026-03-09"),
      row("APPLIED", "2026-03-15"),
      row("WISHLIST", null),
      row("SCREENING", "2026-02-28", "2026-03-02"),
    ],
    filter,
    7,
  );
  assert.equal(data.total, 3);
  assert.equal(data.interviewed, 2);
  assert.equal(data.offered, 1);
  assert.equal(data.interviewRate, 66.7);
  assert.equal(data.responseRate, 66.7);
  assert.equal(data.averageHours, 72);
  assert.equal(data.active, 7);
  assert.equal(
    data.trend.reduce((s, b) => s + b.count, 0),
    3,
  );
  assert.ok(data.trend.some((b) => b.count === 0));
});
test("spring and autumn DST boundaries produce 23 and 25 hour days", () => {
  const spring = windowFor({
    ...filter,
    start: "2026-03-08",
    end: "2026-03-08",
    timezone: "America/New_York",
  });
  const fall = windowFor({
    ...filter,
    start: "2026-11-01",
    end: "2026-11-01",
    timezone: "America/New_York",
  });
  assert.equal((spring.end.getTime() - spring.start.getTime()) / 3600000, 23);
  assert.equal((fall.end.getTime() - fall.start.getTime()) / 3600000, 25);
});
test("range is half-open at local midnight and weeks start Monday", () => {
  const input = {
    ...filter,
    start: "2026-03-01",
    end: "2026-03-01",
    timezone: "Asia/Singapore",
  };
  const data = summarize(
    [
      row("APPLIED", "2026-02-28T15:59:59Z"),
      row("APPLIED", "2026-02-28T16:00:00Z"),
      row("APPLIED", "2026-03-01T15:59:59Z"),
      row("APPLIED", "2026-03-01T16:00:00Z"),
    ],
    input,
    0,
  );
  assert.equal(data.total, 2);
  assert.deepEqual(data.trend, [{ date: "2026-02-23", count: 2 }]);
});
test("monthly buckets across a year boundary include zero months", () => {
  const data = summarize(
    [row("APPLIED", "2025-12-25"), row("APPLIED", "2026-02-02")],
    { ...filter, start: "2025-12-20", end: "2026-02-10", group: "month" },
    0,
  );
  assert.deepEqual(data.trend, [
    { date: "2025-12-01", count: 1 },
    { date: "2026-01-01", count: 0 },
    { date: "2026-02-01", count: 1 },
  ]);
});
test("empty cohort has no fabricated response duration or percentages", () => {
  const data = summarize([], filter, 0);
  assert.equal(data.averageHours, null);
  assert.equal(data.interviewRate, 0);
  assert.equal(data.responseRate, 0);
  assert.ok(data.funnel.every((s) => s.rate === 0));
});
test("rejects invalid dates, timezones, reversed and oversized ranges", () => {
  for (const input of [
    { ...filter, start: "2026-02-30" },
    { ...filter, timezone: "Mars/Base" },
    { ...filter, start: "2026-04-01" },
    { ...filter, start: "2020-01-01" },
  ])
    assert.throws(() => windowFor(input));
});
