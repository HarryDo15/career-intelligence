import {
  ConfidentialClientApplication,
  InteractionRequiredAuthError,
  LogLevel,
} from "@azure/msal-node";
import { MailError } from "./graph";
export const mailScopes = ["https://graph.microsoft.com/Mail.Read"];
export function microsoftConfig() {
  const {
    MICROSOFT_CLIENT_ID: clientId,
    MICROSOFT_CLIENT_SECRET: clientSecret,
    MICROSOFT_REDIRECT_URI: redirectUri,
    APP_URL: appUrl,
  } = process.env;
  const tenant = process.env.MICROSOFT_TENANT_ID || "common";
  if (
    !clientId ||
    !clientSecret ||
    !redirectUri ||
    !appUrl ||
    !/^(common|organizations|consumers|[a-fA-F0-9-]{36})$/.test(tenant) ||
    !/^[a-fA-F0-9]{64}$/.test(process.env.TOKEN_ENCRYPTION_KEY ?? "")
  )
    throw new Error("Outlook is not configured.");
  const redirect = new URL(redirectUri);
  if (
    redirect.origin !== new URL(appUrl).origin ||
    redirect.pathname !== "/api/integrations/outlook/callback" ||
    redirect.search ||
    redirect.hash ||
    redirect.username ||
    redirect.password ||
    !(
      redirect.protocol === "https:" ||
      (redirect.protocol === "http:" &&
        ["127.0.0.1", "localhost"].includes(redirect.hostname))
    )
  )
    throw new Error("Invalid Outlook redirect configuration.");
  return {
    clientId,
    clientSecret,
    redirectUri,
    authority: `https://login.microsoftonline.com/${tenant}`,
  };
}
export function outlookConfigured() {
  try {
    microsoftConfig();
    return true;
  } catch {
    return false;
  }
}
export function microsoftClient(cache?: string) {
  const c = microsoftConfig();
  const app = new ConfidentialClientApplication({
    auth: {
      clientId: c.clientId,
      clientSecret: c.clientSecret,
      authority: c.authority,
    },
    system: {
      loggerOptions: {
        loggerCallback: () => {},
        piiLoggingEnabled: false,
        logLevel: LogLevel.Error,
      },
    },
  });
  if (cache) app.getTokenCache().deserialize(cache);
  return app;
}
export async function refreshAccess(cache: string, accountId: string) {
  const app = microsoftClient(cache);
  const account = await app.getTokenCache().getAccountByHomeId(accountId);
  if (!account) throw new MailError("REAUTH_REQUIRED");
  try {
    const result = await app.acquireTokenSilent({
      account,
      scopes: mailScopes,
    });
    return {
      token: result.accessToken,
      cache: app.getTokenCache().serialize(),
    };
  } catch (error) {
    if (
      error instanceof InteractionRequiredAuthError ||
      (error &&
        typeof error === "object" &&
        "errorCode" in error &&
        error.errorCode === "invalid_grant")
    )
      throw new MailError("REAUTH_REQUIRED");
    throw new MailError("PROVIDER_FAILED");
  }
}
