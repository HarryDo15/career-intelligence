import { existsSync, readFileSync, writeFileSync, chmodSync } from "node:fs";
import { randomBytes } from "node:crypto";
if (!existsSync(".env")) throw new Error("Run npm run setup:env first.");
const env = readFileSync(".env", "utf8");
const entry = env.match(/^TOKEN_ENCRYPTION_KEY=(.*)$/m);
if (entry && entry[1].replace(/["']/g, "").trim()) {
  console.log("Existing Outlook encryption key left unchanged.");
} else {
  const line = `TOKEN_ENCRYPTION_KEY="${randomBytes(32).toString("hex")}"`;
  writeFileSync(
    ".env",
    entry
      ? env.replace(/^TOKEN_ENCRYPTION_KEY=.*$/m, line)
      : env + "\n" + line + "\n",
    { mode: 0o600 },
  );
  chmodSync(".env", 0o600);
  console.log(
    "Generated a local Outlook encryption key. Its value was not printed.",
  );
}
