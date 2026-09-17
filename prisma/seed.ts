import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { seedApplications } from "./seed-data";
const email = process.env.SEED_EMAIL?.trim().toLowerCase();
if (!email)
  throw new Error(
    "Set SEED_EMAIL to an existing local account. Seed data is synthetic and opt-in.",
  );
const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
try {
  const user = await db.user.findUnique({ where: { email } });
  if (!user) throw new Error("Create this account in the app before seeding.");
  await seedApplications(db, user.id);
  console.log(
    "Synthetic applications seeded. Existing records were not changed.",
  );
} finally {
  await db.$disconnect();
}
