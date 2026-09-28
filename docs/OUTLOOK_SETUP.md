# Connect Outlook — Week 3

The Outlook feature is implemented in review-only mode. No mailbox is connected automatically. Microsoft consent and a live-mailbox acceptance test are still required before claiming the integration is production validated.

## 1. Register the Microsoft application

In [Microsoft Entra app registrations](https://entra.microsoft.com/), create an app registration. For both personal Outlook accounts and work/school accounts, choose **Accounts in any organizational directory and personal Microsoft accounts**. Your organization may restrict consent or app registration.

Add a **Web** platform with this exact local redirect URI:

```text
http://127.0.0.1:3100/api/integrations/outlook/callback
```

The portal text box rejects HTTP IP-loopback URLs. Open **Manifest** and add this URI to `web.redirectUris` in the Microsoft Graph-format manifest, preserving existing entries. Older Azure AD-format manifests called this `replyUrlsWithType` with type `Web`. See [Microsoft’s loopback rules](https://learn.microsoft.com/en-us/entra/identity-platform/reply-url) and [manifest field mapping](https://learn.microsoft.com/en-us/entra/identity-platform/azure-active-directory-graph-app-manifest-deprecation). Keep the configured APP_URL and redirect origin identical. For deployment, use an HTTPS callback on the deployed app origin.

Under API permissions, add Microsoft Graph **delegated Mail.Read**. The authorization request also requests offline access for background sync. Do not add application-wide mail access or Mail.Send. Create a client secret, copy its **value** into the local `.env` file, and keep the expiry date for renewal. Never put the secret in chat, git, or NEXT_PUBLIC variables.

Set these values in `.env`:

```dotenv
MICROSOFT_CLIENT_ID="<application-client-id>"
MICROSOFT_CLIENT_SECRET="<secret-value>"
MICROSOFT_TENANT_ID="common"
MICROSOFT_REDIRECT_URI="http://127.0.0.1:3100/api/integrations/outlook/callback"
```

Generate a separate encryption key without printing it:

```sh
npm run setup:outlook-key
```

This fills an empty/missing TOKEN_ENCRYPTION_KEY with 32 random bytes encoded as 64 hexadecimal characters. It preserves an existing key. Securely back up the key separately from the database. Changing it makes stored token caches, email excerpts, cursors, and pending connection attempts unreadable; automatic key rotation is not implemented.

## 2. Start and connect

```sh
npm ci
npm run db:generate
npm run db:deploy
npm run dev
# In another terminal, with the local database running:
npm run workflows:dev
```

Sign in to the app and open **Email review**. Choose **Connect Outlook**, select your Microsoft account, and consent. On return, choose **Sync Inbox** for an immediate first page, or let the ten-minute scheduled job process the initial import. The scheduler needs the Inngest runner to remain running locally; hosted scheduling requires the deployment configuration described in WEEK_TWO.md.

The app starts with the last 30 days of **Inbox only**. It requests subject, sender, received time, message ID, draft state, and body preview; it does not request attachments or full bodies. Graph's delegated Mail.Read permission is broader than this deliberately limited query. Mail moved out of Inbox before discovery is outside this milestone's scope. Older imports and other folders are not configurable yet.

Each manual sync processes one bounded page. A scheduled execution processes up to 20 pages and resumes from the saved cursor on its next run. Graph documents a 5,000-message limit when filtering message delta queries; this release targets personal-volume mailboxes and does not claim complete high-volume backfills.

## 3. Review the suggestions

- Inspect the sender, source excerpt, suggested stage, company, and role. Keyword rules are fallible; no prediction is treated as confirmed history.
- Select an existing application or create one. If company and role exactly match an existing record, new creation is blocked and you must link it instead. Restore an archived application in the tracker before linking.
- Set the submission date for new records. For confirmation emails accepted on their received calendar date, the email timestamp becomes the submission timestamp; this is an approximation you can later correct in the tracker. Other manual date inputs retain the existing UTC-midnight convention.
- Approve or dismiss. Approval creates an application or applies the chosen stage, with a source-tagged stage event and audit record. Older emails add history without replacing a more recent recorded stage. Repeated approval of the same suggestion returns the original result.
- Dismissed suggestions do not reappear on sync. They remain minimal encrypted records for deduplication until disconnect; there is no automatic retention purge in this milestone.

Only the short subject, sender, excerpt (maximum 500 characters), and company/title suggestions are retained as encrypted source data. The excerpt can still contain personal information. The UI renders it as text, never email HTML. Application records approved by you remain normal application data.

## 4. Errors and disconnect

- **THROTTLED:** a durable retry time honors Microsoft's Retry-After (bounded to 24 hours). Manual requests before that time do not call Graph; background sync tries again later.
- **REAUTH_REQUIRED:** choose Reconnect Outlook. Reconnect refreshes consent/cache for the same Microsoft account and preserves the cursor and review history. Disconnect first to switch mailboxes.
- **CURSOR_EXPIRED:** the next eligible run restarts from the original import boundary. Existing suggestions deduplicate; the 5,000-message filtered-query limit still applies.
- **PROVIDER_FAILED:** check configuration and connectivity, then retry. Provider error bodies and tokens are not logged.
- **Disconnect:** removes the local token cache, cursors, pending connection attempts, and all email suggestions/excerpts. Approved applications and their stage events remain. This stops app access but does not revoke the Microsoft consent grant; remove the app grant through your Microsoft account/organization portal if desired.

Next development logging excludes the callback path because it contains a short-lived authorization code. Configure reverse proxies, hosted request logs, monitoring, and traces to redact query strings on that path too.

## Implementation and validation

OAuth uses Microsoft's MSAL Node confidential client, PKCE S256, one-time ten-minute state bound to the signed-in user and HttpOnly SameSite=Lax browser cookie. State is consumed before code exchange; a completion marker prevents disconnect or a newer connect attempt from being undone by a late callback. Stored MSAL cache/cursors/source excerpts use AES-256-GCM envelopes with purpose/user-associated data. Provider calls never accept arbitrary graph origins and do not follow redirects.

Sync uses an expiring database lease and a connection version. Refreshes are persisted before fetching mail, and page suggestions plus continuation cursor commit atomically. Disconnect/reconnect invalidates work in flight. Review approval locks the user/application and enforces expected application versions. The picker loads the user's nonarchived applications; it is intended for personal-scale usage.

Tests cover encryption/context binding, parsing, Graph continuation validation, rate limits, cursor expiry, tenant isolation, concurrent sync/review, late mail, source encryption, disconnect/reconnect races, cursor pagination, OAuth state expiry/replay, and duplicate applications. HTTP smoke checks the private page and rejects unauthenticated/cross-origin connect requests and invalid callbacks. Tests use synthetic emails and do not call Microsoft.

Still required with a real registration: successful consent, declined consent, expired/revoked consent, personal and organizational mailbox compatibility, token renewal over time, and browser/accessibility interaction checks. Networking/contact features remain a separate Week 3 slice.

References: [authorization code and PKCE](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow), [MSAL Node caching](https://learn.microsoft.com/en-us/entra/msal/javascript/node/caching), [message delta](https://learn.microsoft.com/en-us/graph/api/message-delta?view=graph-rest-1.0), [delta recovery](https://learn.microsoft.com/en-us/graph/delta-query-overview).
