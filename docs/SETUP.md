# Setup and environment

## What runs today

This foundation supports schema validation, client generation, and local database migrations. Frontend and workers are scheduled in the roadmap and are not executable yet.

```sh
npm ci
cp .env.example .env
docker compose up -d --wait
npm run db:validate
npm run db:generate
npm run db:migrate -- --name init
```

Use Node 22 LTS ≥22.12 and Docker Compose. The local database is bound to loopback with development-only credentials. `docker compose stop` preserves its volume. Review and commit migration SQL; add the documented CHECK constraints before implementing writes. CI currently validates/generates the schema; week 1 adds real PostgreSQL migration and integration checks. Client construction in the app will require `@prisma/client`, `@prisma/adapter-pg`, and `pg` pinned to compatible versions.

## Variables

| Variable | Purpose / setup |
| --- | --- |
| DATABASE_URL | Prisma database URL; local example supplied. Production uses managed PostgreSQL with TLS. |
| APP_URL | App origin for trusted redirects and origin checks. |
| AUTH_SECRET | Generate a random secret (`openssl rand -base64 32`) for the chosen auth implementation. |
| MICROSOFT_CLIENT_ID | Entra application client ID. |
| MICROSOFT_CLIENT_SECRET | Server-side Entra client secret; store in secret manager and rotate. |
| MICROSOFT_TENANT_ID | `common` for supported personal/work accounts or a tenant ID for a restricted app. |
| MICROSOFT_REDIRECT_URI | Exact registered Web callback URI, localhost example supplied. |
| TOKEN_ENCRYPTION_KEY | Base64 32 random bytes; separate from AUTH_SECRET. Add key versioning and rotation before production. |
| INNGEST_EVENT_KEY | Inngest environment event credential; server-only. |
| INNGEST_SIGNING_KEY | Validates Inngest requests in deployed environments; server-only. |
| JOB_DISCOVERY_PROVIDER | `mock` initially; real adapters require explicit provider configuration. |

Only DATABASE_URL is consumed by the current toolchain. All other variables reserve the configuration contract for future features. Never prefix credentials with NEXT_PUBLIC_. `.env` files are ignored; `.env.example` contains no real credentials.

## Outlook preparation (week 3)

1. Register an application in Microsoft Entra, selecting supported account types deliberately.
2. Add a **Web** redirect URI matching MICROSOFT_REDIRECT_URI, plus the production callback when deployed.
3. Configure delegated Graph Mail.Read and OIDC/offline scopes; consent availability depends on organizational policy.
4. Create a server-side client credential and populate local secrets.
5. Implement MSAL authorization-code + PKCE and session-bound state before enabling Connect. Account linking requires an already authenticated app session.
6. Verify consent denial, expired refresh access, encrypted cache persistence, and disconnect. Do not test with a public demo account containing personal mail.

## Application commands to add in milestones 1–2

`npm run dev`, `npm run build`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:e2e`, and `npm run db:seed` are planned, not available today. Add the Inngest local dev server against `/api/inngest` after that route exists; keep production signature verification enabled.

## Publishing and deployment

GitHub holds the source; publishing this repository does not host the application. Initial repository visibility is private so source can be reviewed before public portfolio release. No real secrets, resume context, contacts, or messages should enter Git history.

Target deployment: managed Next.js hosting, managed PostgreSQL, and an Inngest environment. Configure secrets on the hosting platform, apply reviewed migrations using `npm run db:deploy` from CI with a migration-capable connection, deploy the application, register the Inngest endpoint, and run authenticated smoke tests. Use a separate synthetic-data demo environment. Production hosting is a week-4 deliverable, not part of this foundation.

## Foundation validation record

Validated on September 15, 2026 with Prisma 7.10.0: `db:validate` and `db:generate` passed. No database migration was executed and no application runtime exists yet.

`npm audit` reports four high-severity dependency entries in the development toolchain, originating from deepmerge-ts and mysql2 and propagated through Prisma/config. The tool recommends a major Prisma downgrade; this foundation does not apply that automatically. Re-evaluate patched compatible versions before release and rerun schema/generation/migration checks. Track this as a release blocker. These packages are currently devDependencies, but that does not remove build-system exposure.
