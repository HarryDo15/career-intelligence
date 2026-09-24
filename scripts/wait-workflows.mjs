const origin = process.env.APP_URL || "http://127.0.0.1:3100";
const deadline = Date.now() + 60000;
while (Date.now() < deadline) {
  try {
    const response = await fetch("http://127.0.0.1:8288/health");
    if (response.ok) {
      // Explicitly synchronize functions before sending a test event.
      const sync = await fetch(origin + "/api/inngest", { method: "PUT" });
      if (sync.ok) {
        console.log("Local workflow runner and app registration ready.");
        process.exit(0);
      }
    }
  } catch {}
  await new Promise((resolve) => setTimeout(resolve, 500));
}
console.error("Local workflow runner did not become ready.");
process.exit(1);
