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

Week 3 adds MSAL/Graph under `server/integrations/microsoft`, confirmation-email import and status review, contact management, and draft generation. Week 4 adds browser E2E and deployment evidence.

Server Components load user-scoped services and pass explicit DTOs to client components. Actions and JSON APIs share validation/service layers. Database secrets and authentication stay server-side; injectable domain services are used by server entry points and tests.
