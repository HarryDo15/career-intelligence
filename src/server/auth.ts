import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "./db";
function createAuth() {
  const secret = process.env.AUTH_SECRET;
  const baseURL = process.env.APP_URL;
  if (!secret || secret.length < 32 || !baseURL)
    throw new Error(
      "Configure APP_URL and a random AUTH_SECRET (at least 32 characters).",
    );
  return betterAuth({
    appName: "Career Intelligence",
    secret,
    baseURL,
    trustedOrigins: [new URL(baseURL).origin],
    database: prismaAdapter(getDb(), { provider: "postgresql" }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
      disableSignUp: process.env.ALLOW_REGISTRATION !== "true",
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
      cookieCache: { enabled: false },
    },
    account: { accountLinking: { enabled: false } },
    rateLimit: {
      enabled: true,
      storage: "database",
      window: 60,
      max: 60,
      customRules: {
        "/sign-in/email": { window: 60, max: 5 },
        "/sign-up/email": { window: 60, max: 3 },
      },
    },
    advanced: { ipAddress: { ipAddressHeaders: ["x-real-ip"] } },
  });
}
let instance: ReturnType<typeof createAuth> | undefined;
export function getAuth() {
  return (instance ??= createAuth());
}
export async function currentUser(requestHeaders?: Headers) {
  const session = await getAuth().api.getSession({
    headers: requestHeaders ?? (await headers()),
  });
  return session?.user ?? null;
}
export async function requireUser() {
  const user = await currentUser();
  if (!user) redirect("/sign-in");
  return user;
}
