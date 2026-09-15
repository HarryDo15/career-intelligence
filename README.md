# Career Intelligence

A personal job-search workspace designed to demonstrate full-stack engineering, durable workflows, secure integrations, and explainable analytics.

**Status: architecture and database foundation.** The Next.js UI, authentication, Graph integration, and workers are planned, not implemented. This repository currently provides a runnable Prisma toolchain and a local PostgreSQL configuration. It is not a production-ready application yet.

## Proposed stack

Next.js App Router + React Server Components, TypeScript, Tailwind CSS, shadcn/ui, Lucide, Recharts; PostgreSQL + Prisma; Inngest for durable background jobs; Microsoft Graph + MSAL for Outlook. No separate Express service or Redis is needed for the initial release.

## Start here

- [Architecture, flows, metrics, and security boundaries](docs/ARCHITECTURE.md)
- [Complete Prisma schema](prisma/schema.prisma)
- [Current and planned file structure](docs/PROJECT_STRUCTURE.md)
- [Four-week milestones and acceptance criteria](docs/ROADMAP.md)
- [Local setup, environment, and deployment plan](docs/SETUP.md)

## Foundation quick start

Requires Node.js 22.12+ (Node 22 LTS recommended), npm, and Docker Compose.

```sh
npm ci
cp .env.example .env
docker compose up -d --wait
npm run db:validate
npm run db:generate
npm run db:migrate -- --name init
```

Commit the generated migration before implementing application features. There is no `npm run dev` command until the Next.js milestone. Only synthetic data belongs in the public portfolio demo.
