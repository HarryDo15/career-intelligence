# Career Intelligence

A personal job-search workspace built with Next.js App Router, React Server Components, TypeScript, Tailwind CSS, shadcn-style Radix primitives, Lucide, Recharts, PostgreSQL, Prisma, and Better Auth.

**Status: Week 1 implemented.** Sign-in, persistent application tracking, and a starter overview work locally. A clearly labeled, read-only synthetic demo is available without an account. Inngest discovery, Outlook sync, Kanban, and networking remain on the roadmap. This is not yet a production release.

## What works

- Email/password sign-up (explicit opt-in), sign-in, sign-out, database sessions, and database-backed auth rate limiting.
- Create and edit applications across Wishlist, Applied, Screening, Technical, Offer, and Rejected.
- Search by company/role, filter by stage, paginate, archive, and restore.
- User-scoped queries, server-side validation, optimistic version conflicts, transactional stage history, and audit events.
- Overview with response metrics, current pipeline, recent applications, and a 30-day Recharts activity chart.
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

## Validation

```sh
npm run db:validate
npm run lint
npm run typecheck
npm test
DATABASE_URL=postgresql://career:career_local@127.0.0.1:54329/career_test npm run db:deploy
TEST_DATABASE_URL=postgresql://career:career_local@127.0.0.1:54329/career_test npm run test:integration
npm run test:http  # local app running, ALLOW_REGISTRATION=true
npm run build
npm audit
```

Integration tests refuse databases whose name does not end in `_test`. HTTP smoke tests create and delete disposable localhost accounts. Never point these scripts at a production database.

## Documentation

- [Current implementation and architectural decisions](docs/IMPLEMENTATION.md)
- [Architecture and future integration design](docs/ARCHITECTURE.md)
- [Project structure](docs/PROJECT_STRUCTURE.md)
- [One-month roadmap](docs/ROADMAP.md)
- [Setup, environment and deployment](docs/SETUP.md)

## Release boundaries

Email verification, password recovery, production hosting, browser interaction/accessibility QA, managed backups, and account export/deletion are not implemented yet. Registration should be disabled after provisioning a private account. A public demo must contain only synthetic data. No LinkedIn scraping or real Outlook synchronization occurs in this milestone.
