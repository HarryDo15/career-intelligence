const origin = process.env.APP_URL || "http://127.0.0.1:3100";
const end = Date.now() + 60000;
while (Date.now() < end) {
  try {
    const r = await fetch(origin + "/api/health");
    if (r.ok) {
      console.log("App ready.");
      process.exit(0);
    }
  } catch {}
  await new Promise((resolve) => setTimeout(resolve, 500));
}
console.error("App did not become ready within 60 seconds.");
process.exit(1);
