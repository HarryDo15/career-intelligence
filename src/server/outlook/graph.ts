import { z } from "zod";
import { mailMessage } from "./classifier";
export class MailError extends Error {
  constructor(
    public code:
      "THROTTLED" | "REAUTH_REQUIRED" | "CURSOR_EXPIRED" | "PROVIDER_FAILED",
    public retryAfter = 60,
  ) {
    super(code);
  }
}
export function safeGraphUrl(raw: string) {
  const u = new URL(raw);
  if (
    u.origin !== "https://graph.microsoft.com" ||
    !/^\/v1\.0\/me\/mailfolders(?:\/[^/]+|\('[^']+'\))\/messages\/delta$/i.test(
      decodeURIComponent(u.pathname),
    ) ||
    u.username ||
    u.password ||
    u.hash
  )
    throw new MailError("PROVIDER_FAILED");
  return u.href;
}
export function initialUrl(since: Date) {
  const u = new URL(
    "https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages/delta",
  );
  u.searchParams.set(
    "$select",
    "id,subject,from,receivedDateTime,bodyPreview,isDraft",
  );
  u.searchParams.set("$filter", `receivedDateTime ge ${since.toISOString()}`);
  return u.href;
}
const pageSchema = z.object({
  value: z
    .array(
      z.union([
        z.object({ id: z.string(), "@removed": z.object({}).passthrough() }),
        mailMessage,
      ]),
    )
    .max(1000),
  "@odata.nextLink": z.string().optional(),
  "@odata.deltaLink": z.string().optional(),
});
export type MailPage = {
  messages: z.infer<typeof mailMessage>[];
  next?: string;
  delta?: string;
};
export async function fetchMailPage(
  token: string,
  url: string,
  fetcher: typeof fetch = fetch,
): Promise<MailPage> {
  const response = await fetcher(safeGraphUrl(url), {
    headers: {
      Authorization: `Bearer ${token}`,
      Prefer: 'IdType="ImmutableId", odata.maxpagesize=50',
    },
    redirect: "error",
    signal: AbortSignal.timeout(20000),
    cache: "no-store",
  });
  if (response.status === 429 || response.status === 503) {
    const raw = response.headers.get("retry-after") ?? "60";
    const delay = /^\d+$/.test(raw)
      ? Number(raw)
      : Math.ceil((Date.parse(raw) - Date.now()) / 1000);
    throw new MailError(
      "THROTTLED",
      Number.isFinite(delay) ? Math.min(86400, Math.max(1, delay)) : 60,
    );
  }
  if ([401, 403].includes(response.status))
    throw new MailError("REAUTH_REQUIRED");
  if (response.status === 410) throw new MailError("CURSOR_EXPIRED");
  if (!response.ok) throw new MailError("PROVIDER_FAILED");
  const data = pageSchema.parse(await response.json());
  const next = data["@odata.nextLink"],
    delta = data["@odata.deltaLink"];
  if ((!next && !delta) || (next && delta))
    throw new MailError("PROVIDER_FAILED");
  if (next) safeGraphUrl(next);
  if (delta) safeGraphUrl(delta);
  return {
    messages: data.value.filter(
      (m): m is z.infer<typeof mailMessage> => !("@removed" in m),
    ),
    next,
    delta,
  };
}
