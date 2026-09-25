import { z } from "zod";
import type { ProfileInput } from "@/features/discovery/validation";
export type JobListing = {
  externalId: string;
  canonicalUrl: string;
  company: string;
  title: string;
  description: string;
  location: string;
  workMode: "REMOTE" | "HYBRID" | "ONSITE";
  publishedAt: string;
};
export interface JobProvider {
  readonly name: string;
  search(profile: ProfileInput): Promise<JobListing[]>;
}
// Fixed, fictional fixtures: no scraped or real employer listings.
export const mockListings: JobListing[] = [
  {
    externalId: "mock-northstar-frontend",
    company: "Northstar Labs",
    title: "Senior Frontend Engineer",
    location: "Singapore",
    workMode: "REMOTE",
    description:
      "Build accessible product experiences with React, TypeScript, Next.js and modern testing.",
  },
  {
    externalId: "mock-orbit-fullstack",
    company: "Orbit Studio",
    title: "Full-Stack Engineer",
    location: "Singapore",
    workMode: "HYBRID",
    description:
      "Own Node.js and PostgreSQL services, React interfaces, and reliable delivery pipelines.",
  },
  {
    externalId: "mock-canvas-platform",
    company: "Canvas Cloud",
    title: "Platform Engineer",
    location: "London",
    workMode: "REMOTE",
    description:
      "Build developer platforms using Kubernetes, Terraform, Node.js and observability.",
  },
  {
    externalId: "mock-pixel-product",
    company: "Pixel Harbor",
    title: "Product Engineer",
    location: "New York",
    workMode: "REMOTE",
    description:
      "Ship full-stack TypeScript, React and PostgreSQL features with product and design.",
  },
  {
    externalId: "mock-lumen-backend",
    company: "Lumen Systems",
    title: "Backend Engineer",
    location: "Singapore",
    workMode: "ONSITE",
    description:
      "Develop resilient Node.js APIs, PostgreSQL data models and asynchronous workflows.",
  },
  {
    externalId: "mock-northstar-intern",
    company: "Northstar Labs",
    title: "Frontend Engineer Intern",
    location: "Singapore",
    workMode: "REMOTE",
    description:
      "An internship learning React and TypeScript alongside experienced engineers.",
  },
].map((j) => ({
  ...j,
  workMode: j.workMode as JobListing["workMode"],
  canonicalUrl: `https://example.com/jobs/${j.externalId}`,
  publishedAt: "2026-09-22T00:00:00.000Z",
}));
export const mockProvider: JobProvider = {
  name: "mock",
  async search() {
    return mockListings;
  },
};
export function matchJob(job: JobListing, profile: ProfileInput) {
  const title = job.title.toLowerCase();
  const text = `${title} ${job.description} ${job.company}`.toLowerCase();
  if (!profile.titles.some((t) => title.includes(t.toLowerCase()))) return null;
  if (profile.workModes.length && !profile.workModes.includes(job.workMode))
    return null;
  if (
    profile.locations.length &&
    !profile.locations.some((l) =>
      job.location.toLowerCase().includes(l.toLowerCase()),
    )
  )
    return null;
  if (profile.excludedKeywords.some((k) => text.includes(k.toLowerCase())))
    return null;
  const matched = profile.keywords.filter((k) =>
    text.includes(k.toLowerCase()),
  );
  if (profile.keywords.length && !matched.length) return null;
  const score = profile.keywords.length
    ? 0.6 + (0.4 * matched.length) / profile.keywords.length
    : 1;
  return {
    score: Math.round(score * 100) / 100,
    reasons: [
      "Title matches",
      ...(profile.workModes.length
        ? [`${job.workMode.toLowerCase()} arrangement matches`]
        : []),
      ...(profile.locations.length ? ["Location matches"] : []),
      ...matched.map((k) => `Keyword: ${k}`),
    ],
  };
}
export type ProfileRow = ProfileInput & {
  id: string;
  version: number;
  lastRunAt: string | null;
  lastStatus: string | null;
  lastResultCount: number | null;
};
export type DiscoveredRow = JobListing & {
  id: string;
  discoveredAt: string;
  dismissedAt: string | null;
  applicationId: string | null;
  matches: { name: string; score: number; reasons: string[] }[];
};

export const listingBatch = z
  .array(
    z.object({
      externalId: z.string().min(1).max(200),
      canonicalUrl: z
        .string()
        .max(2000)
        .url()
        .refine(
          (v) => ["https:", "http:"].includes(new URL(v).protocol),
          "Unsafe listing URL",
        ),
      company: z.string().min(1).max(120),
      title: z.string().min(1).max(160),
      description: z.string().max(20000),
      location: z.string().max(160),
      workMode: z.enum(["REMOTE", "HYBRID", "ONSITE"]),
      publishedAt: z.iso.datetime(),
    }),
  )
  .max(100);
