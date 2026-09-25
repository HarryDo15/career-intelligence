# Week 1 implementation

> Historical milestone record. See [WEEK_TWO.md](WEEK_TWO.md) for the current board, cohort analytics, discovery, workflows, and validation.

## Delivered September 17, 2026

Next.js 16 / React 19 application; Tailwind 4 theme; locally owned shadcn-style Button and Radix Dialog primitives; Lucide icons; Recharts preview and user overview; Better Auth email/password authentication; Prisma 7 PostgreSQL persistence; applications table, filters, pagination, create/edit dialog, archive/restore, stage history and audit trail.

The synthetic `/demo` is read-only and requires no database access. `/dashboard`, `/applications`, and `/settings` authenticate on the server. The application service accepts server-derived identity, selects an explicit DTO, and never accepts ownership from editable fields. There is no browser storage persistence or hidden demo write bypass.

## Authentication decision

Better Auth owns User, Account, Session, Verification, and RateLimit records. This replaces the proposed Identity model and tokenHash session field in the initial architecture. Better Auth's standard adapter uses an opaque **token** in the Session table; it is not hashed by our code. Protect database access and backups accordingly. Password hashing, signed HttpOnly session cookies, origin checks, session expiration/revocation, and rate limiting are delegated to the library.

Mailbox integration remains separate and unimplemented. Account linking is disabled. Public registration is off unless `ALLOW_REGISTRATION=true`; the local example enables it for setup. No email verification or password recovery transport is configured. Disable registration once a private account is created; before public production onboarding, implement verified email and recovery. Do not treat an unverified email as authorization to link a mailbox.

Rate limits use a database table, including 5 sign-in attempts/minute and 3 sign-up attempts/minute per IP. Production proxy configuration must overwrite `X-Real-IP`, and the origin must not be directly reachable by clients who could spoof it. Add a deployment-specific network rate limit before public release.

## Writes and errors

Server Actions and the JSON API call the same validation/service code. Creation writes the application, initial stage event, and audit event atomically. Updates predicate on `{id, userId, version}`, increment the version, and add history only when stage changes. Stale updates return a conflict; they are not silently replayed. There is no general idempotent create key yet, so future background/import adapters must add one before enabling automatic writes. Archive/restore uses the same ownership and version rules and preserves history.

The JSON mutation route checks the exact APP_URL origin and bounds the actual request body to 32 KiB. Server Actions additionally receive Next.js origin and body-size enforcement. Validation rejects non-HTTP URLs, impossible/future dates, response dates before submission, and advanced stages missing first-response evidence. User fields render as React text, not raw HTML.

## Initial metrics versus planned analytics

The implemented overview is all-time, includes archived applications in submission/response history, and displays **current** interview-stage counts. Active pipelines exclude archived and terminal records. The activity chart groups the last 30 days by UTC date and exposes a text summary. Date-only inputs are stored at UTC midnight.

The initial overview is not the planned selected-cohort funnel. Historical interview conversion, user-timezone week/month buckets, and configurable date cohorts remain Week 2 work. At personal scale the overview loads the user's records; replace with SQL aggregate queries before claiming the 10,000-record performance target.

## Database / seed

`202609170001_initial` creates all domain/auth models and enforces salary bounds, response ordering, nonnegative versions, and confidence/score ranges. Applied on local PostgreSQL 18; CI uses PostgreSQL 17. The initial design had no migration or production data, so the auth schema changes are captured in this first migration.

`SEED_EMAIL` must identify an existing account. Stable per-user seed IDs prevent duplicate imports and upserts never overwrite edits. All seed records are synthetic. A second isolated database ending in `_test` is required for integration tests.

## Dependency remediation

The foundation's four high-severity audit entries were transitive Prisma CLI dependencies. Scoped overrides select `@prisma/config → deepmerge-ts 8.0.2` and `mysql2 3.24.4`. This intentionally crosses deepmerge-ts's major version; Prisma config loading, validation, client generation, migration application, and build are validation gates. Do not remove overrides until the upstream Prisma version contains equivalent fixes. `npm audit` reported zero findings after the overrides on September 17, 2026.

## Validation coverage

- Six unit tests: dates, required submission/response evidence, unsafe URLs, size limits, and editable-field ownership stripping.
- Eight PostgreSQL integration tests: persisted writes, ownership, concurrent updates, archive/restore, rollback, SQL constraints, filtering/pagination, and seed idempotency.
- HTTP smoke: unauthenticated API rejection and page redirect, sign-up/sign-in/sign-out, session revocation, CRUD, CSRF, cross-user denial, conflict handling, persistence in server-rendered dashboard.
- Type checking, linting, schema validation, client generation, production build, and dependency audit.

Browser rendering/interaction QA was not performed because no browser connection was available. HTTP checks do not prove client-side modal interactions or accessibility; those remain a release gate.

## Deployment boundary

This is the requested Node.js Next.js + PostgreSQL application. The Sites hosting skill was consulted, but its Cloudflare Worker artifact contract and lack of raw TCP database support do not match this repository. No fake Sites deployment or replacement SQLite application is provided. Keep the local preview and GitHub source; deploy to a Node-compatible host plus managed PostgreSQL in the release milestone.
