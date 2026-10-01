# Connect Gmail

Use this integration for Gmail mail, including Gmail shown inside the Outlook app. Microsoft Graph only reads Microsoft-hosted mail. A Gmail plugin connected to Codex is separate from the dashboard's OAuth client.

## 1. Google Cloud setup

1. Open [Google Cloud Console](https://console.cloud.google.com/) and create/select a project for this dashboard.
2. Under **APIs & Services → Library**, enable **Gmail API**.
3. Open **Google Auth Platform** (or **OAuth consent screen**). Set the app name and your support/developer email. Choose an **External** audience, keep publishing status **Testing**, and add your Gmail address under **Test users**.
4. Under **Data Access**, add `openid`, `email`, and `https://www.googleapis.com/auth/gmail.readonly`. The app requests read-only access; it does not send, label, delete or modify mail.
5. Under **Clients**, create an OAuth client of type **Web application**. Add this exact **Authorized redirect URI**:

   ```text
   http://127.0.0.1:3100/api/integrations/gmail/callback
   ```

   Keep the browser URL, `APP_URL`, and callback origin consistent. Use an HTTPS callback on your actual domain for deployment. Do not choose a desktop client.

6. Put the client ID and secret into the project's local `.env` file. Do not share them in chat or commit them:

   ```dotenv
   GOOGLE_CLIENT_ID="<client-id>.apps.googleusercontent.com"
   GOOGLE_CLIENT_SECRET="<client-secret>"
   GOOGLE_REDIRECT_URI="http://127.0.0.1:3100/api/integrations/gmail/callback"
   ```

The existing `TOKEN_ENCRYPTION_KEY` is shared with Outlook. **Preserve it**; replacing it makes existing encrypted data unreadable. If it is missing, `npm run setup:outlook-key` creates it without printing it and preserves an existing key. Keep a secure backup separately from the database.

Google's [web-server OAuth guide](https://developers.google.com/identity/protocols/oauth2/web-server) explains consent, redirect URIs and offline access. In External/Testing mode, refresh tokens for these scopes generally expire after **seven days**, so reconnect when prompted. See [token expiration](https://developers.google.com/identity/protocols/oauth2#expiration). `gmail.readonly` is a [restricted scope](https://developers.google.com/workspace/gmail/api/auth/scopes); public distribution needs the applicable Google verification/security review. Testing a private portfolio app is not evidence of production approval.

## 2. Run and connect

With your existing local PostgreSQL running:

```sh
npm ci
npm run db:generate
npm run db:deploy
npm run dev
```

Run `npm run workflows:dev` in a second terminal for background sync. Reuse existing processes if ports 3100 or 8288 are already occupied; restarting duplicate runners causes port conflicts. Restart the app after changing `.env`.

1. Sign into the dashboard at `http://127.0.0.1:3100`.
2. Open **Email review → Connect Gmail**.
3. Select the Gmail account that received your applications and grant read-only access.
4. Confirm the **Connected mailbox** address shown on the Gmail card.
5. Choose **Sync mail**. Each click processes one bounded page; the ten-minute background job processes up to 20 pages per execution and resumes next run.

The app and Inngest runner must be running for local scheduled sync. Manual sync needs only the app and database. They do not need to run while you are not using/testing the local dashboard; a hosted deployment is needed for continuous unattended operation.

## 3. What should appear

The initial scan covers the last **30 days** of received Gmail mail, including archived messages. Sent, drafts, trash and spam are excluded. Subsequent syncs use Gmail history IDs; a pre-scan history anchor catches mail arriving during backfill. Expired history triggers a rescan with message-ID deduplication. See [Google's sync guide](https://developers.google.com/workspace/gmail/api/guides/sync).

Only candidate application/recruiting messages appear in review. The app fetches metadata and snippets, not attachments/full message bodies. It stores encrypted subject/sender and up to 500 characters of excerpt; snippets may omit important context. Subjects such as **Application Update** or **Application Status** without clear stage language appear as **Stage needs review**. Select the correct stage, company, role, and submission date after checking the source email. Rule-based detection can miss other wording.

A queued email does **not** change dashboard metrics. Approve it to create or update an application. When a message already refers to a tracked company/role, link it to that record. Dismissed emails remain deduplicated until disconnect. Both providers share this queue, with a provider label on each card. Cross-provider copies are not automatically deduplicated; link or dismiss them during review.

To check a specific message, first confirm it appears in the connected Gmail account within the import window. In Gmail, search for its exact subject and date. For the requested September 25, 2026 message, use:

```text
subject:"Bank of America Application Update" after:2026/09/24 before:2026/09/27
```

Sync until complete and inspect the review queue. This guide and automated tests do not establish that the real message exists or what decision it contains.

## 4. Recovery and disconnect

- **REAUTH_REQUIRED:** reconnect the same Google account. This preserves import history. Disconnect before switching accounts.
- **THROTTLED:** the stored retry time prevents repeated immediate calls. Let the background runner retry.
- **CURSOR_EXPIRED:** the next eligible sync starts another scan from the original import date; stored suggestions do not duplicate.
- **PROVIDER_FAILED:** check client configuration, enabled Gmail API, consent scopes and network access. Provider response bodies and tokens are not logged.
- **Disconnect:** deletes that provider's local tokens, sync state, pending OAuth attempts and email suggestions/excerpts. Imported applications and stage history remain. Remove the app separately from [Google account connections](https://myaccount.google.com/connections) to revoke the Google grant.

Next development logs exclude both OAuth callback paths. Configure hosted/proxy/access logs to redact callback query strings as well.

## Validation boundary

Automated tests cover archived mail, ambiguous subjects, pagination/history checkpoints, deleted messages, throttling, expired cursors, state binding/replay/cancellation, tenant isolation, encrypted storage, deduplication, disconnect/reconnect races and rendered review pages. They use synthetic fixtures without calling Gmail. Live consent, real-message discovery, refresh-token renewal and browser interaction checks still require a configured client and your consent.
