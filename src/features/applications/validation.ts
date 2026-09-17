import { z } from "zod";
import { stages } from "@/lib/application";
const date = z
  .union([
    z.literal(""),
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
      .refine((v) => {
        const d = new Date(v + "T00:00:00.000Z");
        return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
      }, "Enter a valid calendar date"),
  ])
  .transform((v) => (v ? new Date(v + "T00:00:00.000Z") : null));
export const applicationInput = z
  .object({
    company: z.string().trim().min(1, "Company is required").max(120),
    title: z.string().trim().min(1, "Role is required").max(160),
    location: z.string().trim().max(160).default(""),
    workMode: z.enum(["REMOTE", "HYBRID", "ONSITE", "UNKNOWN"]),
    stage: z.enum(stages),
    url: z
      .string()
      .trim()
      .max(2000)
      .refine((v) => {
        if (!v) return true;
        try {
          return ["https:", "http:"].includes(new URL(v).protocol);
        } catch {
          return false;
        }
      }, "Enter an HTTP or HTTPS URL"),
    notes: z.string().max(10000).default(""),
    appliedAt: date,
    firstResponseAt: date,
  })
  .superRefine((value, ctx) => {
    if (
      (value.appliedAt !== null && !(value.appliedAt instanceof Date)) ||
      (value.firstResponseAt !== null &&
        !(value.firstResponseAt instanceof Date))
    )
      return;
    if (value.stage !== "WISHLIST" && !value.appliedAt)
      ctx.addIssue({
        code: "custom",
        path: ["appliedAt"],
        message: "Set the submission date for a submitted application",
      });
    if (
      value.firstResponseAt &&
      (!value.appliedAt || value.firstResponseAt < value.appliedAt)
    )
      ctx.addIssue({
        code: "custom",
        path: ["firstResponseAt"],
        message: "Response date must be on or after the submission date",
      });
    if (
      ["SCREENING", "TECHNICAL", "OFFER"].includes(value.stage) &&
      !value.firstResponseAt
    )
      ctx.addIssue({
        code: "custom",
        path: ["firstResponseAt"],
        message: "Set the first response date for this stage",
      });
    const today = new Date().toISOString().slice(0, 10);
    for (const key of ["appliedAt", "firstResponseAt"] as const)
      if (value[key] && value[key]!.toISOString().slice(0, 10) > today)
        ctx.addIssue({
          code: "custom",
          path: [key],
          message: "Date cannot be in the future",
        });
  });
export const mutationMeta = z.object({
  id: z.string().min(1).max(128),
  version: z.number().int().nonnegative(),
});
export const listInput = z.object({
  query: z.string().trim().max(160).default(""),
  stage: z.enum(stages).optional(),
  archived: z.boolean().default(false),
  page: z.coerce.number().int().min(1).max(10000).default(1),
});
