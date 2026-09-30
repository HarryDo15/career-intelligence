import { NextResponse } from "next/server";
import { currentUser } from "@/server/auth";
import { getDb } from "@/server/db";
import { beginGmail, gmailCookie } from "@/server/gmail/oauth";
import { gmailConfigured } from "@/server/gmail/google";
export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(process.env.APP_URL!).origin)
    return new Response("Invalid origin", { status: 403 });
  const user = await currentUser(request.headers);
  if (!user) return new Response("Unauthorized", { status: 401 });
  const back = (result: string) =>
    NextResponse.redirect(
      new URL(
        `/email-review?provider=gmail&connection=${result}`,
        process.env.APP_URL!,
      ),
      303,
    );
  if (!gmailConfigured()) return back("not-configured");
  try {
    const { url, state } = await beginGmail(getDb(), user.id);
    const response = NextResponse.redirect(url, 303);
    response.headers.set("Cache-Control", "no-store");
    response.cookies.set(gmailCookie, state, {
      httpOnly: true,
      sameSite: "lax",
      secure: new URL(process.env.APP_URL!).protocol === "https:",
      path: "/api/integrations/gmail",
      maxAge: 600,
    });
    return response;
  } catch {
    return back("failed");
  }
}
