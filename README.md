# Career Intelligence

A personal job-search workspace built with Next.js App Router, React Server Components, TypeScript, Tailwind CSS, shadcn-style Radix primitives, Lucide, Recharts, PostgreSQL, Prisma, and Better Auth.

**Status: Weeks 1–2 and the Week 3 mailbox review slice implemented.** Sign-in, persistent tracking, Kanban, cohort analytics, and hourly mock discovery work locally. A read-only synthetic demo is available without an account. Gmail import awaits Google OAuth setup and live consent validation; networking and production hosting remain planned. This is not yet a production release.

## What works

- Email/password sign-up (explicit opt-in), sign-in, sign-out, database sessions, and database-backed auth rate limiting.
- Create and edit applications across Wishlist, Applied, Screening, Technical, Offer, and Rejected.
- Search by company/role, filter by stage, paginate, archive, and restore.
- User-scoped queries, server-side validation, optimistic version conflicts, transactional stage history, and audit events.
- Kanban with drag/drop, keyboard-accessible stage menus, required milestone dates, and optimistic conflict feedback.
- Date-range/timezone-aware cohort analytics, weekly/monthly trends, current stage breakdown, and historical conversion funnel.
- Search profiles, explainable synthetic matches, hourly Inngest workflows, and duplicate-safe save to Wishlist.
- PostgreSQL migration with SQL CHECK constraints and idempotent opt-in synthetic seeding.

## Local quick start

Use Node.js 22.12+ and npm. The optional embedded PostgreSQL runner avoids requiring Docker.

```sh
npm ci
npm run setup:env
npm run db:local
```

Leave the database terminal open. In another terminal:

```sh
npm run db:deploy
npm run db:generate
npm run dev
```

Open **http://127.0.0.1:3100/demo** for the synthetic preview or **http://127.0.0.1:3100/sign-in** to create your own account. Use this exact origin locally so authentication cookies and origin checks agree.

To add synthetic applications to an existing account:

```sh
SEED_EMAIL=you@example.com npm run db:seed
```

The seed never overwrites existing records. No account or password is committed. Do not seed a real production account.

If your package manager blocks install scripts, review and allow the platform-specific `@embedded-postgres/*` postinstall script, which restores the packaged PostgreSQL symlinks. Alternatively use Docker as documented in [Setup](docs/SETUP.md).

## Run discovery

Add `INNGEST_DEV="1"` to an existing local `.env` (included for new setups), then start `npm run workflows:dev` alongside the app. Create a profile under Discovered jobs; manual mock searches work without the scheduler. All discovered listings are fictional. See [Week 2](docs/WEEK_TWO.md).

## Validation

```sh
npm run db:validate
npm run lint
npm run typecheck
npm test
DATABASE_URL=postgresql://career:career_local@127.0.0.1:54329/career_test npm run db:deploy
TEST_DATABASE_URL=postgresql://career:career_local@127.0.0.1:54329/career_test npm run test:integration
npm run test:http  # local app running, ALLOW_REGISTRATION=true
npm run test:workflow  # local Inngest runner and app running
npm run build
npm audit
```

Integration tests refuse databases whose name does not end in `_test`. HTTP smoke tests create and delete disposable localhost accounts. Never point these scripts at a production database.

## Documentation

- [Week 2 implementation and workflow guide](docs/WEEK_TWO.md)
- [Week 1 implementation and architectural decisions](docs/IMPLEMENTATION.md)
- [Architecture and future integration design](docs/ARCHITECTURE.md)
- [Project structure](docs/PROJECT_STRUCTURE.md)
- [One-month roadmap](docs/ROADMAP.md)
- [Setup, environment and deployment](docs/SETUP.md)

## Release boundaries

Email verification, password recovery, production hosting, browser interaction/accessibility QA, managed backups, and account export/deletion are not implemented yet. Registration should be disabled after provisioning a private account. A public demo must contain only synthetic data. No LinkedIn scraping is implemented. Mailbox synchronization only starts after explicit account connection. Automated tests use synthetic messages.

## Week 3 — Outlook review

Outlook OAuth, encrypted token storage, Inbox delta sync, and reviewed application imports are implemented. Configure your Microsoft app registration using [OUTLOOK_SETUP.md](docs/OUTLOOK_SETUP.md), then open Email review. Microsoft Graph reads the Microsoft mailbox, even when the Microsoft sign-in address ends in @gmail.com. Successful empty-mailbox access has been checked locally; populated mailbox, renewal, and browser interaction acceptance remain outstanding.

## Gmail import

Gmail has its own OAuth connection, encrypted credentials and resumable background sync. It reads the last 30 days of received mail (including archived mail), then incremental changes. Both providers share a review queue; ambiguous application updates require an explicit stage choice. No tracker changes happen without approval.

Follow [GMAIL_SETUP.md](docs/GMAIL_SETUP.md) to enable the Gmail API, configure a Google OAuth test user/client, and connect your mailbox. Connecting a Gmail plugin in Codex does not configure this app. Live Gmail consent and the requested source email are not yet verified.
