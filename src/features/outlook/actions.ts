"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/server/auth";
import { getDb } from "@/server/db";
import { outlookReview } from "@/server/outlook/review";
import { gmailSync } from "@/server/gmail/sync";
import { outlookSync } from "@/server/outlook/sync";
import { publicError } from "@/server/action-error";
import { z } from "zod";
export async function manageOutlook(
  operation: unknown,
  input?: unknown,
  mailbox: unknown = "outlook",
) {
  const user = await requireUser();
  try {
    const provider = z.enum(["outlook", "gmail"]).parse(mailbox);
    const label = provider === "gmail" ? "Gmail" : "Outlook";
    const op = z
      .enum(["accept", "dismiss", "disconnect", "sync"])
      .parse(operation);
    const db = getDb(),
      service = outlookReview(db);
    let message = "Saved.";
    if (op === "accept") {
      const result = await service.accept(user.id, input);
      message = result.historical
        ? "Added to history. The current stage was preserved because this email is older."
        : "Application updated.";
    } else if (op === "dismiss") await service.dismiss(user.id, input);
    else if (op === "disconnect") {
      await service.disconnect(user.id, provider);
      message = "Disconnected. Imported applications are preserved.";
    } else {
      const connection = await (provider === "gmail"
        ? db.gmailConnection.findUnique({
            where: { userId: user.id },
            select: { id: true },
          })
        : db.outlookConnection.findUnique({
            where: { userId: user.id },
            select: { id: true },
          }));
      if (!connection) return { ok: false, error: `Connect ${label} first.` };
      const result = await (
        provider === "gmail" ? gmailSync(db) : outlookSync(db)
      )(user.id, connection.id);
      message =
        result.status === "synced"
          ? `${result.count} new suggestions. ${result.more ? "More mail remains; sync again or let background sync continue." : "Mailbox is up to date."}`
          : result.status === "REAUTH_REQUIRED"
            ? `Reconnect ${label} to continue.`
            : result.status === "THROTTLED"
              ? "The provider asked us to wait. Background sync will retry later."
              : result.status === "CURSOR_EXPIRED"
                ? "The provider's cursor expired. The next sync rebuilds it without duplicating suggestions."
                : "Sync is busy or unavailable. Try again later; check connection status below.";
    }
    for (const path of [
      "/email-review",
      "/settings",
      "/applications",
      "/dashboard",
    ])
      revalidatePath(path);
    return { ok: true, message };
  } catch (error) {
    return { ok: false, error: publicError(error) };
  }
}
