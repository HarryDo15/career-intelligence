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

## Planned additions

Week 2 adds Kanban, richer cohort analytics, search profiles, a job-provider interface, and Inngest workflow registration. Week 3 adds MSAL/Graph under `server/integrations/microsoft`, email signal matching and review, contact management, and draft generation. Week 4 adds browser E2E and deployment evidence.

Server Components load user-scoped services and pass explicit DTOs to client components. Actions and the JSON API share one validation/service layer. Database secrets and authentication stay in modules marked `server-only`; the injectable domain service is imported only by server entry points and tests.
