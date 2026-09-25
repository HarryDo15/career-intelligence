"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/server/auth";
import { getDb } from "@/server/db";
import { applicationService } from "@/server/application-service";
import { publicError } from "@/server/action-error";
function refresh() {
  revalidatePath("/applications");
  revalidatePath("/dashboard");
}
export async function saveApplication(input: unknown, meta?: unknown) {
  const user = await requireUser();
  try {
    const service = applicationService(getDb());
    if (meta) await service.update(user.id, meta, input);
    else await service.create(user.id, input);
    refresh();
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: publicError(error) };
  }
}
export async function archiveApplication(meta: unknown, archived: unknown) {
  const user = await requireUser();
  try {
    await applicationService(getDb()).archive(
      user.id,
      meta,
      z.boolean().parse(archived),
    );
    refresh();
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: publicError(error) };
  }
}

export async function moveApplication(meta: unknown, input: unknown) {
  const user = await requireUser();
  try {
    await applicationService(getDb()).move(user.id, meta, input);
    refresh();
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: publicError(error) };
  }
}
