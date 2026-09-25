import { z, ZodError } from "zod";
import { currentUser } from "@/server/auth";
import { getDb } from "@/server/db";
import { discoveryService } from "@/server/discovery-service";
import { DomainError } from "@/server/application-service";
import { publicError } from "@/server/action-error";
import { revalidatePath } from "next/cache";
const json = (data: unknown, status = 200) =>
  Response.json(data, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
export async function GET(request: Request) {
  const user = await currentUser(request.headers);
  if (!user) return json({ error: "Unauthorized" }, 401);
  const service = discoveryService(getDb());
  return json({
    profiles: await service.profiles(user.id),
    jobs: await service.listJobs(user.id),
  });
}
export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(process.env.APP_URL!).origin)
    return json({ error: "Invalid origin" }, 403);
  const user = await currentUser(request.headers);
  if (!user) return json({ error: "Unauthorized" }, 401);
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
        operation: z.enum([
          "profile.save",
          "profile.delete",
          "run",
          "save",
          "dismiss",
          "restore",
        ]),
        input: z.unknown(),
        meta: z.unknown().optional(),
      })
      .parse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    const service = discoveryService(getDb());
    let result;
    if (body.operation === "profile.save")
      result = await service.saveProfile(user.id, body.input, body.meta);
    else if (body.operation === "profile.delete")
      await service.removeProfile(user.id, body.input);
    else if (body.operation === "run")
      result = await service.runManual(user.id, body.input);
    else if (body.operation === "save")
      result = await service.saveJob(user.id, body.input);
    else
      await service.dismiss(user.id, body.input, body.operation === "dismiss");
    revalidatePath("/discovered");
    revalidatePath("/applications");
    revalidatePath("/dashboard");
    return json({ ok: true, result });
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
