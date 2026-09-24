"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/server/auth";
import { getDb } from "@/server/db";
import { discoveryService } from "@/server/discovery-service";
import { publicError } from "@/server/action-error";
export async function manageDiscovery(
  operation: unknown,
  input: unknown,
  meta?: unknown,
) {
  const user = await requireUser();
  try {
    const op = z
      .enum([
        "profile.save",
        "profile.delete",
        "run",
        "save",
        "dismiss",
        "restore",
      ])
      .parse(operation);
    const service = discoveryService(getDb());
    let count: number | undefined;
    let skipped = false;
    if (op === "profile.save") await service.saveProfile(user.id, input, meta);
    else if (op === "profile.delete")
      await service.removeProfile(user.id, input);
    else if (op === "run") {
      const result = await service.runManual(user.id, input);
      count = result.count;
      skipped = result.skipped;
    } else if (op === "save") await service.saveJob(user.id, input);
    else await service.dismiss(user.id, input, op === "dismiss");
    revalidatePath("/discovered");
    revalidatePath("/applications");
    revalidatePath("/dashboard");
    return { ok: true as const, count, skipped };
  } catch (error) {
    return { ok: false as const, error: publicError(error) };
  }
}
