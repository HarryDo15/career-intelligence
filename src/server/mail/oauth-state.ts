import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { PrismaClient } from "@/generated/prisma/client";
import { seal, unseal } from "../outlook/crypto";
export const digest = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export async function beginMailState(
  db: PrismaClient,
  userId: string,
  provider: "gmail",
) {
  const state = randomBytes(32).toString("base64url"),
    verifier = randomBytes(48).toString("base64url");
  const identifier = `${provider}:${userId}`,
    expiresAt = new Date(Date.now() + 600_000);
  await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
    await tx.verification.deleteMany({
      where: {
        identifier: { in: [identifier, `${provider}-completing:${userId}`] },
      },
    });
    await tx.verification.create({
      data: {
        id: randomBytes(24).toString("hex"),
        identifier,
        expiresAt,
        value: seal(
          JSON.stringify({ hash: digest(state), verifier }),
          identifier,
        ),
      },
    });
  });
  return {
    state,
    verifier,
    challenge: createHash("sha256").update(verifier).digest("base64url"),
  };
}
export async function consumeMailState(
  db: PrismaClient,
  userId: string,
  state: string,
  cookie: string,
  provider: "gmail",
) {
  if (
    !/^[A-Za-z0-9_-]{43}$/.test(state) ||
    state.length !== cookie.length ||
    !timingSafeEqual(Buffer.from(state), Buffer.from(cookie))
  )
    throw new Error("Invalid state.");
  const identifier = `${provider}:${userId}`;
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
    const stored = await tx.verification.findFirst({
      where: { identifier, expiresAt: { gt: new Date() } },
    });
    if (!stored) throw new Error("Expired state.");
    const value = z
      .object({ hash: z.string(), verifier: z.string() })
      .parse(JSON.parse(unseal(stored.value, identifier)));
    if (value.hash !== digest(state)) throw new Error("Invalid state.");
    await tx.verification.delete({ where: { id: stored.id } });
    await tx.verification.create({
      data: {
        id: randomBytes(24).toString("hex"),
        identifier: `${provider}-completing:${userId}`,
        value: digest(value.verifier),
        expiresAt: stored.expiresAt,
      },
    });
    return value.verifier;
  });
}
