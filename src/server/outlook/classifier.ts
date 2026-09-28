import { z } from "zod";
export const mailMessage = z.object({
  id: z.string().min(1).max(2048),
  receivedDateTime: z.string().datetime({ offset: true }),
  subject: z.string().max(2000).default(""),
  bodyPreview: z.string().max(10000).default(""),
  from: z
    .object({
      emailAddress: z.object({
        name: z.string().optional(),
        address: z.string().max(320).optional(),
      }),
    })
    .optional(),
  isDraft: z.boolean().optional(),
});
export type MailMessage = z.infer<typeof mailMessage>;
export function classify(message: MailMessage) {
  if (message.isDraft) return null;
  // Only inspect the newest excerpt; quoted replies should not outweigh the subject.
  const excerpt = message.bodyPreview.split(
    /\n(?:From:|On .+wrote:|_{3,})/i,
  )[0];
  const text = `${message.subject}\n${excerpt}`;
  const jobContext =
    /\b(application|position|role|candidate|interview|employment|hiring)\b/i.test(
      text,
    );
  if (!jobContext) return null;
  const rejection =
    /\b(regret|unfortunately|not (?:be )?moving forward|will not (?:be )?(?:proceed|move)|other candidates|unsuccessful)\b/i.test(
      text,
    );
  const offer =
    /\b(offer of employment|job offer|pleased to offer|offer letter)\b/i.test(
      text,
    );
  const technical =
    /\b(technical interview|coding (?:interview|assessment)|take.home (?:test|assignment))\b/i.test(
      text,
    );
  const interview = /\b(interview|phone screen|screening call)\b/i.test(text);
  const applied =
    /\b(application (?:received|submitted)|received your application|thank you for (?:applying|your application)|thanks for applying)\b/i.test(
      text,
    );
  const stage:
    "REJECTED" | "OFFER" | "TECHNICAL" | "SCREENING" | "APPLIED" | null =
    rejection
      ? "REJECTED"
      : offer
        ? "OFFER"
        : technical
          ? "TECHNICAL"
          : interview
            ? "SCREENING"
            : applied
              ? "APPLIED"
              : null;
  if (!stage) return null;
  // Suggestions only: no invented employer from email domains or recruiter names.
  const match = text.match(
    /(?:application for|applying for|position of|role of)\s+(?:the\s+)?(.{2,160}?)\s+at\s+([^\n.!?]{2,120})/i,
  );
  return {
    stage,
    confidence: match ? 0.8 : 0.55,
    reasonCode: rejection
      ? "REJECTION_LANGUAGE"
      : offer
        ? "OFFER_LANGUAGE"
        : applied
          ? "CONFIRMATION_LANGUAGE"
          : "INTERVIEW_LANGUAGE",
    payload: {
      subject: message.subject.slice(0, 300),
      sender: message.from?.emailAddress.address ?? "Unknown sender",
      excerpt: excerpt.slice(0, 500),
      company: match?.[2]?.trim() ?? "",
      title: match?.[1]?.trim() ?? "",
    },
  };
}
export const sourcePayload = z.object({
  subject: z.string(),
  sender: z.string(),
  excerpt: z.string(),
  company: z.string(),
  title: z.string(),
});
