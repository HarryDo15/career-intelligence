# One-month delivery plan

## Progress — September 24, 2026

Weeks 1–2 are implemented. Week 2 adds the keyboard-accessible Kanban board, timezone-aware cohort charts/funnel, profile CRUD, matching explanations, hourly Inngest mock discovery, and duplicate-safe save to Wishlist. Real background event delivery has been verified locally. Both milestones remain reviewable in GitHub pull requests; public hosting and browser interaction testing are still outstanding.

Week 3 now explicitly includes reviewed creation of applications from confirmation emails, in addition to updates to existing applications. No personal mailbox has been accessed.

Assumption: one developer, approximately 20–25 focused hours per week. Dates assume a September 15, 2026 start. The first month targets a deployed portfolio MVP with measured release gates; broader production hardening continues afterward. Each week ends with a reviewable GitHub PR and short demo.

| Milestone                   | Dates        | Deliverables                                                                                                                                                                                 | Acceptance criteria                                                                                                                                                                       |
| --------------------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 — Foundation and tracker  | Sep 15–21    | Next.js/TS/Tailwind/shadcn shell; Prisma migration + CHECK constraints; app login/session layer; synthetic seed; application CRUD/table; CI                                                  | Fresh clone boots; migration applies to empty PG; users cannot access each other's applications; create/edit/archive persists; CI lint/typecheck/tests/build passes                       |
| 2 — Dashboard and discovery | Sep 22–28    | Keyboard-accessible Kanban with optimistic conflicts; Recharts weekly/monthly trends, status and funnel; search profiles; mock provider; hourly Inngest workflow; discovered-job save action | Metrics match fixed cohort fixtures; timezone edges pass; concurrent moves yield visible conflict; repeated discovery produces no duplicate cards; saved jobs appear once                 |
| 3 — Outlook and networking  | Sep 29–Oct 5 | Entra OAuth consent and encrypted cache; folder delta sync; confirmation-email import; review queue; disconnect; contact CRUD/provenance; resume-context outreach templates                  | Consent/denial/reconnect exercised; duplicate and late mail safe; 429 and expired cursor recover; no raw mail/token in logs; ambiguous mail waits for review; drafts editable and factual |
| 4 — Release and portfolio   | Oct 6–12     | E2E flows; accessibility; performance measurement; observability; secret/dependency checks; deployment; backup/restore drill; export/delete; README screenshots + architecture demo          | Main CI green; tracker→email review→analytics E2E passes; tenant isolation verified; restore proven; deployment smoke test passes; public demo contains only synthetic data               |
| Buffer and presentation     | Oct 13–14    | Fix release blockers, record 3-minute demo, finalize portfolio case study                                                                                                                    | Known limitations documented; tagged v0.1.0 and reproducible setup                                                                                                                        |

## Ordered backlog

1. Choose a maintained app-auth library during implementation; map its storage adapter to Identity/Session (the schema is not advertised as an out-of-box Auth.js adapter).
2. Create initial migration and SQL constraints; add Prisma PG runtime adapter and seed.
3. Establish user-scoped service conventions and security integration tests before adding data routes.
4. Ship the tracker vertical slice, then analytics derived from real stored events.
5. Register Inngest jobs with deterministic fixtures before connecting external accounts.
6. Register Entra application and validate personal + work-account behavior; organizational consent policy can restrict access.
7. Start email classification in review-only mode. Enable narrowly scoped auto-updates only after fixture validation.
8. Finish networking drafts, settings, data lifecycle, and release evidence.

## Scope control

Required: tracker, analytics, simulated hourly alerts, real opt-in Outlook connection, review queue, manually sourced contact records, tailored drafts, deployed synthetic demo. Real LinkedIn people/job search depends on authorized provider availability and is not a release dependency. LLM drafting, auto-sending, calendar scheduling, browser extensions, salary enrichment, and multi-user collaboration are later milestones.

If behind: retain review-only email updates and deterministic templates; defer advanced chart filters and real feed adapters. Preserve authentication, ownership tests, and reliable persistence.

## Definition of done for each PR

Document visible behavior and setup changes; validate appropriate unit/integration tests; include accessible loading/error/empty states; demonstrate no credentials or personal data in fixtures. Schema PRs include migration review. Feature PRs include screenshots or a short demo. Production readiness claims require measured evidence rather than this roadmap alone.
