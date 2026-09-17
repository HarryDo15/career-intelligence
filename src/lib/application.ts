export const stages = [
  "WISHLIST",
  "APPLIED",
  "SCREENING",
  "TECHNICAL",
  "OFFER",
  "REJECTED",
] as const;
export type Stage = (typeof stages)[number];
export const stageLabels: Record<Stage, string> = {
  WISHLIST: "Wishlist",
  APPLIED: "Applied",
  SCREENING: "Screening",
  TECHNICAL: "Technical",
  OFFER: "Offer",
  REJECTED: "Rejected",
};
export const stageStyles: Record<Stage, string> = {
  WISHLIST: "bg-slate-100 text-slate-600",
  APPLIED: "bg-blue-50 text-blue-600",
  SCREENING: "bg-violet-50 text-violet-600",
  TECHNICAL: "bg-amber-50 text-amber-700",
  OFFER: "bg-emerald-50 text-emerald-700",
  REJECTED: "bg-rose-50 text-rose-600",
};
export type ApplicationRow = {
  id: string;
  company: string;
  title: string;
  location: string | null;
  workMode: "REMOTE" | "HYBRID" | "ONSITE" | "UNKNOWN";
  stage: Stage;
  url: string | null;
  notes: string | null;
  appliedAt: string | null;
  firstResponseAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  version: number;
};
