import { z } from "zod";
const terms = z
  .array(z.string().trim().min(1).max(100))
  .max(20)
  .transform((values) => [...new Set(values.map((v) => v.toLowerCase()))]);
export const profileInput = z.object({
  name: z.string().trim().min(1).max(100),
  titles: terms.refine((v) => v.length > 0, "Add at least one job title"),
  keywords: terms,
  excludedKeywords: terms,
  locations: terms,
  workModes: z.array(z.enum(["REMOTE", "HYBRID", "ONSITE"])).max(3),
  enabled: z.boolean(),
});
export const profileMeta = z.object({
  id: z.string().min(1).max(128),
  version: z.number().int().nonnegative(),
});
export const jobIdInput = z.string().min(1).max(128);
export const discoveryEvent = z.object({
  profileId: z.string().min(1).max(128),
  userId: z.string().min(1).max(128),
  version: z.number().int().nonnegative(),
  slot: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}$/),
});
export type ProfileInput = z.infer<typeof profileInput>;
export function hourSlot(date = new Date()) {
  return date.toISOString().slice(0, 13);
}
