import { consumeMailState } from "@/server/mail/oauth-state";
import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/server/auth";
import { getDb } from "@/server/db";
import { completeGmail, gmailCookie } from "@/server/gmail/oauth";
export async function GET(request: NextRequest) {
  let status = "failed";
  try {
    const user = await currentUser(request.headers);
    if (!user) throw new Error("Session expired");
    const state = request.nextUrl.searchParams.get("state") ?? "";
    const verifier = await consumeMailState(
      getDb(),
      user.id,
      state,
      request.cookies.get(gmailCookie)?.value ?? "",
      "gmail",
    );
    if (request.nextUrl.searchParams.has("error")) status = "denied";
    else {
      const code = request.nextUrl.searchParams.get("code");
      if (!code || code.length > 10000) throw new Error("Missing code");
      await completeGmail(getDb(), user.id, code, verifier);
      status = "connected";
    }
  } catch {
    /* Never log codes, provider responses, or mailbox data. */
  }
  const response = NextResponse.redirect(
    new URL(
      `/email-review?provider=gmail&connection=${status}`,
      process.env.APP_URL!,
    ),
    303,
  );
  response.cookies.set(gmailCookie, "", {
    path: "/api/integrations/gmail",
    maxAge: 0,
  });
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
