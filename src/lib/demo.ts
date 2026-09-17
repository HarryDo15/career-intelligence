import type { ApplicationRow, Stage } from "./application";
// Entirely synthetic examples. No real applications or employer activity implied.
const examples: [string, string, Stage, string, number, number | null][] = [
  [
    "Linear",
    "Senior Frontend Engineer",
    "TECHNICAL",
    "San Francisco, US",
    8,
    4,
  ],
  ["Vercel", "Software Engineer, Dashboard", "SCREENING", "Remote", 4, 3],
  ["Notion", "Full-Stack Engineer", "APPLIED", "New York, US", 7, null],
  ["Stripe", "Software Engineer, Payments", "APPLIED", "Singapore", 10, null],
  ["Figma", "Product Engineer", "OFFER", "San Francisco, US", 12, 2],
  ["Supabase", "Frontend Engineer", "WISHLIST", "Remote", 1, null],
  ["Raycast", "Full-Stack Engineer", "APPLIED", "Remote", 15, null],
  ["Arc Labs", "Senior Software Engineer", "REJECTED", "Singapore", 18, 5],
  ["GitHub", "Software Engineer", "SCREENING", "Remote", 20, 4],
  ["Monzo", "Product Engineer", "APPLIED", "London, UK", 23, null],
  ["Webflow", "Frontend Engineer", "REJECTED", "Remote", 25, 3],
  ["Airtable", "Full-Stack Engineer", "TECHNICAL", "New York, US", 28, 6],
];
export function demoApplications(now = new Date()): ApplicationRow[] {
  return examples.map(
    ([company, title, stage, location, days, response], i) => {
      const date = new Date(now);
      date.setUTCDate(date.getUTCDate() - days);
      date.setUTCHours(12, 0, 0, 0);
      return {
        id: `demo-${i}`,
        company,
        title,
        stage,
        location,
        workMode: location === "Remote" ? "REMOTE" : "HYBRID",
        url: null,
        notes: "Synthetic portfolio example.",
        appliedAt: stage === "WISHLIST" ? null : date.toISOString(),
        firstResponseAt:
          response === null
            ? null
            : new Date(date.getTime() + response * 86400000).toISOString(),
        archivedAt: null,
        createdAt: date.toISOString(),
        version: 0,
      };
    },
  );
}
