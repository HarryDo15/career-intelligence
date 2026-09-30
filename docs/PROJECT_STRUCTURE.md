# Project structure

```text
career-intelligence/
├── .github/workflows/schema.yml   # full app CI including PostgreSQL + HTTP checks
├── docs/                         # architecture, implementation, roadmap, setup
├── prisma/
│   ├── schema.prisma
│   ├── migrations/202609170001_initial/migration.sql
│   ├── seed.ts                   # opt-in seed entry point
│   └── seed-data.ts              # idempotent synthetic fixtures
├── public/og.png
├── scripts/
│   ├── setup-env.ts
│   ├── local-db.ts
│   ├── wait-server.mjs
│   └── http-smoke.ts
├── src/
│   ├── app/
│   │   ├── api/auth/[...all]/route.ts
│   │   ├── api/applications/route.ts
│   │   ├── api/health/route.ts
│   │   ├── applications/page.tsx
│   │   ├── dashboard/page.tsx
│   │   ├── demo/page.tsx
│   │   ├── settings/page.tsx
│   │   ├── sign-in/page.tsx
│   │   ├── page.tsx              # entry to demo
│   │   ├── layout.tsx
│   │   ├── error.tsx
│   │   ├── loading.tsx
│   │   └── globals.css
│   ├── components/
│   │   ├── ui/                  # Button, Dialog (Radix / shadcn conventions)
│   │   └── workspace/           # shell, overview, chart, tracker, editor, auth forms
│   ├── features/applications/   # validation + Server Actions
│   ├── server/                  # auth, DB singleton, application service, safe errors
│   ├── lib/                     # shared types, demo data, browser auth client, cn
│   └── generated/prisma/        # ignored generated client
├── tests/
│   ├── validation.test.ts
│   └── integration/applications.test.ts
├── .env.example
├── compose.yaml
├── components.json
├── next.config.ts
├── prisma.config.ts
└── package.json
```

## Week 2 additions

- `src/components/workspace/kanban.tsx` — board and stage moves.
- `src/components/workspace/analytics-charts.tsx`, `src/lib/analytics.ts`, `src/server/analytics-service.ts` — cohort metrics and charts.
- `src/app/discovered`, `src/components/workspace/discovery.tsx`, `src/features/discovery`, `src/server/discovery-service.ts`, `src/lib/jobs.ts` — profiles and discovery.
- `src/server/workflows`, `src/app/api/inngest` — hourly dispatch and per-profile background processing.
- `src/app/api/discovery` — authenticated discovery API sharing the domain service with Server Actions.
- `prisma/migrations/202609240001_discovery` — additive profile version and workflow log fields.
- `tests/analytics.test.ts`, `tests/discovery.test.ts`, `tests/integration/week-two.test.ts`, `scripts/workflow-smoke.ts` — Week 2 checks.

## Planned additions

Remaining Week 3 work adds contact management and draft generation. Week 4 adds browser E2E and deployment evidence.

Server Components load user-scoped services and pass explicit DTOs to client components. Actions and JSON APIs share validation/service layers. Database secrets and authentication stay server-side; injectable domain services are used by server entry points and tests.

Week 3 Outlook implementation: `src/server/outlook/` contains crypto, MSAL, OAuth state, Graph transport, sync and review services; `src/features/outlook/actions.ts` is the authenticated mutation boundary; `/email-review` is the review UI and `/api/integrations/outlook/{connect,callback}` handles consent. See [OUTLOOK_SETUP.md](OUTLOOK_SETUP.md).

Gmail additions: `src/server/gmail/` contains Google OAuth, bounded Gmail API transport and resumable sync; `src/server/mail/oauth-state.ts` binds Google consent to the signed-in session. `/api/integrations/gmail/{connect,callback}` handles consent. `GmailConnection` and a mutually exclusive provider relation on `EmailSignal` preserve existing Outlook records. Shared review/actions live in the existing `outlook/review.ts` and `features/outlook/actions.ts` modules. Gmail unit/integration tests and HTTP smoke fixtures exercise the shared queue. See [GMAIL_SETUP.md](GMAIL_SETUP.md).
