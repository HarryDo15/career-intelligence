import type { NextRequest } from "next/server";
import { serve } from "inngest/next";
import { inngest, localWorkflows } from "@/server/workflows/client";
import { functions } from "@/server/workflows/functions";
export const runtime = "nodejs";
const handlers = serve({ client: inngest, functions });
function ready() {
  return localWorkflows || Boolean(process.env.INNGEST_SIGNING_KEY);
}
const unavailable = () =>
  Response.json(
    { error: "Background scheduling is not configured." },
    { status: 503 },
  );
export async function GET(request: NextRequest, context: unknown) {
  return ready() ? handlers.GET(request, context) : unavailable();
}
export async function POST(request: NextRequest, context: unknown) {
  return ready() ? handlers.POST(request, context) : unavailable();
}
export async function PUT(request: NextRequest, context: unknown) {
  return ready() ? handlers.PUT(request, context) : unavailable();
}
