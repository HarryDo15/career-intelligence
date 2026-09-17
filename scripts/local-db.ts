import EmbeddedPostgres from "embedded-postgres";
import { existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
const directory = resolve(".local/postgres");
mkdirSync(resolve(".local"), { recursive: true });
const postgres = new EmbeddedPostgres({
  databaseDir: directory,
  user: "career",
  password: "career_local",
  port: 54329,
  persistent: true,
  authMethod: "scram-sha-256",
  postgresFlags: ["-h", "127.0.0.1", "-k", resolve(".local")],
  onLog: () => {},
  onError: () => {},
});
if (!existsSync(resolve(directory, "PG_VERSION"))) await postgres.initialise();
await postgres.start();
const client = postgres.getPgClient();
await client.connect();
for (const name of ["career", "career_test"]) {
  const result = await client.query(
    "SELECT 1 FROM pg_database WHERE datname=$1",
    [name],
  );
  if (!result.rowCount) await client.query(`CREATE DATABASE "${name}"`);
}
await client.end();
console.log(
  "Local PostgreSQL ready at 127.0.0.1:54329. Data persists in .local/postgres. Ctrl+C to stop.",
);
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  await postgres.stop();
  process.exit(0);
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
await new Promise(() => {});
