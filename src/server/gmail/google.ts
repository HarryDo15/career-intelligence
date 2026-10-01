import { OAuth2Client } from "google-auth-library";
import { z } from "zod";
import { MailError } from "../outlook/graph";
export const gmailScope = "https://www.googleapis.com/auth/gmail.readonly";
export const googleScopes = ["openid", "email", gmailScope];
export function googleConfig() {
  const {
    GOOGLE_CLIENT_ID: clientId,
    GOOGLE_CLIENT_SECRET: clientSecret,
    GOOGLE_REDIRECT_URI: redirectUri,
    APP_URL: appUrl,
  } = process.env;
  if (
    !clientId ||
    !clientSecret ||
    !redirectUri ||
    !appUrl ||
    !/^[a-fA-F0-9]{64}$/.test(process.env.TOKEN_ENCRYPTION_KEY ?? "")
  )
    throw new Error("Gmail is not configured.");
  const u = new URL(redirectUri);
  if (
    u.origin !== new URL(appUrl).origin ||
    u.pathname !== "/api/integrations/gmail/callback" ||
    u.search ||
    u.hash ||
    u.username ||
    u.password ||
    !(
      u.protocol === "https:" ||
      (u.protocol === "http:" &&
        ["127.0.0.1", "localhost"].includes(u.hostname))
    )
  )
    throw new Error("Invalid Google callback configuration.");
  return { clientId, clientSecret, redirectUri };
}
export function gmailConfigured() {
  try {
    googleConfig();
    return true;
  } catch {
    return false;
  }
}
export function googleClient() {
  return new OAuth2Client(googleConfig());
}
export const storedTokens = z.object({
  access_token: z.string().optional(),
  refresh_token: z.string().min(1),
  expiry_date: z.number().optional(),
  token_type: z.string().optional(),
  scope: z.string().optional(),
});
export async function refreshGmail(cache: string) {
  const saved = storedTokens.parse(JSON.parse(cache));
  const client = googleClient();
  client.setCredentials(saved);
  try {
    const { token } = await client.getAccessToken();
    if (!token) throw new MailError("REAUTH_REQUIRED");
    // Google often omits refresh_token on renewal; preserve the current value.
    const credentials = storedTokens.parse({
      ...saved,
      ...client.credentials,
      refresh_token: client.credentials.refresh_token || saved.refresh_token,
    });
    return { token, cache: JSON.stringify(credentials) };
  } catch (error) {
    if (error instanceof MailError) throw error;
    const details = error as {
      response?: { status?: number; data?: { error?: string } };
    };
    if (
      details.response?.data?.error === "invalid_grant" ||
      details.response?.status === 401
    )
      throw new MailError("REAUTH_REQUIRED");
    throw new MailError("PROVIDER_FAILED");
  }
}
