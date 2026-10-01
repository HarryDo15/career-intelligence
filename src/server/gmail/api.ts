import { z } from "zod";
import { MailError } from "../outlook/graph";
import { mailMessage, type MailMessage } from "../outlook/classifier";
const id = z
  .string()
  .min(1)
  .max(256)
  .regex(/^[a-zA-Z0-9_-]+$/);
const position = {
  phase: z.enum(["full", "history"]),
  historyId: z.string().regex(/^\d+$/),
  pageToken: z.string().max(4096).optional(),
};
export const gmailCursor = z.object({
  ...position,
  pendingIds: z.array(id).max(10000).optional(),
});
export type GmailCursor = z.infer<typeof gmailCursor>;
export type GmailPage = {
  messages: MailMessage[];
  cursor: GmailCursor;
  more: boolean;
};
const ref = z.object({ id });
const listed = z.object({
  messages: z.array(ref).max(1000).default([]),
  nextPageToken: z.string().optional(),
});
const history = z.object({
  historyId: z.string().regex(/^\d+$/),
  nextPageToken: z.string().optional(),
  history: z
    .array(
      z.object({
        messagesAdded: z.array(z.object({ message: ref })).optional(),
        labelsAdded: z.array(z.object({ message: ref })).optional(),
      }),
    )
    .max(1000)
    .default([]),
});
const message = z.object({
  id,
  internalDate: z.string().regex(/^\d+$/),
  snippet: z.string().max(10000).default(""),
  labelIds: z.array(z.string()).default([]),
  payload: z
    .object({
      headers: z
        .array(z.object({ name: z.string(), value: z.string() }))
        .default([]),
    })
    .default({ headers: [] }),
});
export function decodeSnippet(value: string) {
  const entities: Record<string, string> = {
    amp: "&",
    lt: "<",
    gt: ">",
    quot: '"',
    apos: "'",
    nbsp: " ",
  };
  return value.replace(
    /&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi,
    (whole, entity: string) => {
      if (!entity.startsWith("#"))
        return entities[entity.toLowerCase()] ?? whole;
      const n =
        entity[1].toLowerCase() === "x"
          ? parseInt(entity.slice(2), 16)
          : Number(entity.slice(1));
      return n > 0 && n <= 0x10ffff && !(n >= 0xd800 && n <= 0xdfff)
        ? String.fromCodePoint(n)
        : whole;
    },
  );
}
export function normalizeGmail(raw: unknown): MailMessage | null {
  const m = message.parse(raw);
  if (m.labelIds.some((l) => ["SPAM", "TRASH", "DRAFT", "SENT"].includes(l)))
    return null;
  const header = (name: string) =>
    m.payload.headers.find((h) => h.name.toLowerCase() === name)?.value ?? "";
  const from = header("from"),
    address = from.match(/<([^<>]+)>/)?.[1] ?? from;
  return mailMessage.parse({
    id: m.id,
    receivedDateTime: new Date(Number(m.internalDate)).toISOString(),
    subject: header("subject"),
    bodyPreview: decodeSnippet(m.snippet),
    from: { emailAddress: { address: address.slice(0, 320) } },
  });
}
export function gmailApi(fetcher: typeof fetch = fetch) {
  async function get(
    token: string,
    path: string,
    params: URLSearchParams = new URLSearchParams(),
    missing: "message" | "history" | "error" = "error",
  ) {
    // Paths are constructed internally. Never accept provider-supplied absolute URLs.
    const url = new URL(
      `https://gmail.googleapis.com/gmail/v1/users/me/${path}`,
    );
    url.search = params.toString();
    const response = await fetcher(url, {
      headers: { Authorization: `Bearer ${token}` },
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });
    if (response.status === 404 && missing === "message") return null;
    if (response.status === 404 && missing === "history")
      throw new MailError("CURSOR_EXPIRED");
    if (response.status === 401) throw new MailError("REAUTH_REQUIRED");
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      const reasons =
        body?.error?.errors?.map((e: { reason?: string }) => e.reason) ?? [];
      if (
        [429, 503].includes(response.status) ||
        reasons.some((r: string) =>
          [
            "rateLimitExceeded",
            "userRateLimitExceeded",
            "dailyLimitExceeded",
          ].includes(r),
        )
      ) {
        const retry = response.headers.get("retry-after") ?? "60";
        const delay = /^\d+$/.test(retry)
          ? Number(retry)
          : Math.ceil((Date.parse(retry) - Date.now()) / 1000);
        throw new MailError(
          "THROTTLED",
          Number.isFinite(delay) ? Math.min(86400, Math.max(1, delay)) : 60,
        );
      }
      if (
        response.status === 403 &&
        reasons.includes("insufficientPermissions")
      )
        throw new MailError("REAUTH_REQUIRED");
      throw new MailError("PROVIDER_FAILED");
    }
    return response.json();
  }
  async function profile(token: string) {
    return z
      .object({
        emailAddress: z.string().email(),
        historyId: z.string().regex(/^\d+$/),
      })
      .parse(await get(token, "profile"));
  }
  async function page(
    token: string,
    since: Date,
    saved: GmailCursor | null,
  ): Promise<GmailPage> {
    const cursor = saved
      ? gmailCursor.parse(saved)
      : { phase: "full" as const, historyId: (await profile(token)).historyId };
    let ids: string[], next: GmailCursor, more: boolean;
    if (cursor.pendingIds?.length) {
      ids = cursor.pendingIds;
      next = {
        phase: cursor.phase,
        historyId: cursor.historyId,
        pageToken: cursor.pageToken,
      };
      more = !!next.pageToken || next.phase === "full";
    } else if (cursor.phase === "full") {
      const params = new URLSearchParams({
        q: `after:${Math.floor(since.getTime() / 1000)} -in:spam -in:trash -in:sent -in:drafts`,
        maxResults: "25",
        includeSpamTrash: "false",
      });
      if (cursor.pageToken) params.set("pageToken", cursor.pageToken);
      const data = listed.parse(await get(token, "messages", params));
      ids = data.messages.map((m) => m.id);
      next = {
        phase: data.nextPageToken ? "full" : "history",
        historyId: cursor.historyId,
        pageToken: data.nextPageToken,
      };
      // Always catch up from the pre-backfill history anchor before marking complete.
      more = true;
    } else {
      const params = new URLSearchParams({
        startHistoryId: cursor.historyId,
        maxResults: "25",
      });
      params.append("historyTypes", "messageAdded");
      params.append("historyTypes", "labelAdded");
      if (cursor.pageToken) params.set("pageToken", cursor.pageToken);
      const data = history.parse(
        await get(token, "history", params, "history"),
      );
      ids = [
        ...new Set(
          data.history.flatMap((h) =>
            [...(h.messagesAdded ?? []), ...(h.labelsAdded ?? [])].map(
              (m) => m.message.id,
            ),
          ),
        ),
      ];
      next = {
        phase: "history",
        historyId: data.nextPageToken ? cursor.historyId : data.historyId,
        pageToken: data.nextPageToken,
      };
      more = !!data.nextPageToken;
    }
    if (ids.length > 10000) throw new MailError("PROVIDER_FAILED");
    const messages: MailMessage[] = [];
    // Bound each step to 25 messages, with at most five concurrent GET requests.
    for (let offset = 0; offset < Math.min(ids.length, 25); offset += 5) {
      const batch = await Promise.all(
        ids.slice(offset, Math.min(offset + 5, 25)).map(async (value) => {
          const params = new URLSearchParams({
            format: "metadata",
            fields: "id,internalDate,snippet,labelIds,payload/headers",
          });
          params.append("metadataHeaders", "Subject");
          params.append("metadataHeaders", "From");
          const data = await get(
            token,
            `messages/${encodeURIComponent(id.parse(value))}`,
            params,
            "message",
          );
          return data ? normalizeGmail(data) : null;
        }),
      );
      messages.push(...batch.filter((m): m is MailMessage => !!m));
    }
    if (ids.length > 25) {
      next.pendingIds = ids.slice(25);
      more = true;
    }
    return { messages, cursor: gmailCursor.parse(next), more };
  }
  return { profile, page };
}
