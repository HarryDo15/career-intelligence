import { existsSync, writeFileSync, readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
if (existsSync(".env")) {
  console.log(".env already exists; left unchanged.");
} else {
  const env = readFileSync(".env.example", "utf8").replace(
    'AUTH_SECRET=""',
    `AUTH_SECRET="${randomBytes(32).toString("base64")}"`,
  );
  writeFileSync(
    ".env",
    env.replace(
      'TOKEN_ENCRYPTION_KEY=""',
      `TOKEN_ENCRYPTION_KEY="${randomBytes(32).toString("hex")}"`,
    ),
    { mode: 0o600 },
  );
  console.log("Created local .env with a random auth secret.");
}
