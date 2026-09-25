import { Inngest } from "inngest";
// Dev protocol is explicitly opt-in and only allowed for a loopback application.
export const localWorkflows =
  process.env.INNGEST_DEV === "1" &&
  ["localhost", "127.0.0.1"].includes(
    new URL(process.env.APP_URL || "http://invalid").hostname,
  );
export const inngest = new Inngest({
  id: "career-intelligence",
  isDev: localWorkflows,
});
