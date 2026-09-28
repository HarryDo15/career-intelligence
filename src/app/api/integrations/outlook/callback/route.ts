import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/server/auth";
import { getDb } from "@/server/db";
import {
  consumeOutlookState,
  completeOutlook,
  oauthCookie,
} from "@/server/outlook/oauth";
export async function GET(request: NextRequest) {
  let status = "failed";
  try {
    const user = await currentUser(request.headers);
    if (!user) throw new Error("Session expired");
    const state = request.nextUrl.searchParams.get("state") ?? "";
    const verifier = await consumeOutlookState(
      getDb(),
      user.id,
      state,
      request.cookies.get(oauthCookie)?.value ?? "",
    );
    if (request.nextUrl.searchParams.has("error")) status = "denied";
    else {
      const code = request.nextUrl.searchParams.get("code");
      if (!code || code.length > 10000) throw new Error("Missing code");
      await completeOutlook(getDb(), user.id, code, verifier);
      status = "connected";
    }
  } catch {
    /* Never log codes, provider responses, or mailbox data. */
  }
  const response = NextResponse.redirect(
    new URL(`/email-review?connection=${status}`, process.env.APP_URL!),
    303,
  );
  response.cookies.set(oauthCookie, "", {
    path: "/api/integrations/outlook",
    maxAge: 0,
  });
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
