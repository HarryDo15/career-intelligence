import { z, ZodError } from "zod";
import { currentUser } from "@/server/auth";
import { getDb } from "@/server/db";
import { applicationService, DomainError } from "@/server/application-service";
import { publicError } from "@/server/action-error";
import { revalidatePath } from "next/cache";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}
export async function GET(request: Request) {
  const user = await currentUser(request.headers);
  if (!user) return json({ error: "Unauthorized" }, 401);
  const q = new URL(request.url).searchParams;
  try {
    return json(
      await applicationService(getDb()).list(user.id, {
        query: q.get("q") ?? "",
        stage: q.get("stage") || undefined,
        page: q.get("page") ?? 1,
        archived: q.get("archived") === "true",
      }),
    );
  } catch (error) {
    return json(
      { error: publicError(error) },
      error instanceof ZodError ? 400 : 500,
    );
  }
}
export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(process.env.APP_URL!).origin)
    return json({ error: "Invalid origin" }, 403);
  const user = await currentUser(request.headers);
  if (!user) return json({ error: "Unauthorized" }, 401);
  // Bound actual bytes, rather than trusting Content-Length.
  const reader = request.body?.getReader();
  if (!reader) return json({ error: "Missing body" }, 400);
  let size = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 32768) {
      await reader.cancel();
      return json({ error: "Request too large" }, 413);
    }
    chunks.push(value);
  }
  try {
    const body = z
      .object({
        operation: z.enum(["create", "update", "archive", "restore"]),
        input: z.unknown().optional(),
        meta: z.unknown().optional(),
      })
      .parse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    const service = applicationService(getDb());
    let result;
    if (body.operation === "create")
      result = await service.create(user.id, body.input);
    else if (body.operation === "update")
      result = await service.update(user.id, body.meta, body.input);
    else
      await service.archive(user.id, body.meta, body.operation === "archive");
    revalidatePath("/dashboard");
    revalidatePath("/applications");
    return json(
      { ok: true, application: result },
      body.operation === "create" ? 201 : 200,
    );
  } catch (error) {
    return json(
      { error: publicError(error) },
      error instanceof ZodError || error instanceof SyntaxError
        ? 400
        : error instanceof DomainError
          ? error.code === "NOT_FOUND"
            ? 404
            : 409
          : 500,
    );
  }
}
