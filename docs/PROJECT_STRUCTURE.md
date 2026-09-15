# Project structure

## Created in this foundation

```text
career-intelligence/
├── .github/workflows/schema.yml
├── docs/
│   ├── ARCHITECTURE.md
│   ├── PROJECT_STRUCTURE.md
│   ├── ROADMAP.md
│   └── SETUP.md
├── prisma/schema.prisma
├── .env.example
├── .gitignore
├── compose.yaml
├── package.json
├── package-lock.json
├── prisma.config.ts
└── README.md
```

## Target application layout (to implement)

```text
src/
├── app/
│   ├── (auth)/sign-in/page.tsx
│   ├── (workspace)/
│   │   ├── layout.tsx
│   │   ├── dashboard/page.tsx
│   │   ├── applications/page.tsx
│   │   ├── applications/[id]/page.tsx
│   │   ├── discovered/page.tsx
│   │   ├── networking/page.tsx
│   │   ├── review/page.tsx
│   │   └── settings/page.tsx
│   ├── api/auth/[...auth]/route.ts
│   ├── api/integrations/outlook/connect/route.ts
│   ├── api/integrations/outlook/callback/route.ts
│   ├── api/inngest/route.ts
│   ├── api/health/route.ts
│   ├── layout.tsx
│   ├── error.tsx
│   └── globals.css
├── components/
│   ├── ui/                         # shadcn components
│   └── shell/                      # navigation, page headers
├── features/
│   ├── applications/               # actions, validation, DTOs
│   │   └── components/             # kanban-board, job-card, table, form
│   ├── analytics/components/       # KPI cards, trend, funnel, breakdown
│   ├── discovery/components/       # profiles, job list, filters
│   ├── outlook/components/         # connection state, review queue
│   └── networking/components/      # contacts, draft editor
├── server/
│   ├── auth/                       # sessions, requireUser, identity
│   ├── db/                         # Prisma singleton + PG adapter
│   ├── services/                   # domain rules and transactions
│   ├── repositories/               # mandatory user-scoped persistence
│   ├── integrations/
│   │   ├── microsoft/              # MSAL cache, Graph client, delta
│   │   └── jobs/                   # provider interface, mock adapter
│   ├── workflows/                  # Inngest client + registered functions
│   └── security/                   # encryption, OAuth state, log redaction
├── lib/                            # shared pure formatting and types
└── generated/prisma/               # ignored; prisma generate output
prisma/
├── schema.prisma
├── migrations/                     # generated and reviewed in week 1
└── seed.ts                         # synthetic demo fixtures
tests/
├── unit/                           # metrics, parser, transition rules
├── integration/                    # PostgreSQL ownership + idempotency
└── e2e/                            # Playwright end-to-end journeys
```

Pages compose features. Client components import DTOs and actions, never repositories or provider clients. Services own transactions and validation rules; workflow functions coordinate those same services. Keep a single app until independent scale or deployment needs justify separation.
