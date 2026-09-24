# Week 2 — pipeline, analytics, and discovery

Implemented September 24, 2026. This milestone builds on the Week 1 tracker. Personal email/application import remains Week 3 work; all discovered listings in this milestone are fictional.

## Product flows

1. **Applications → Switch to board:** six stage columns, native drag/drop, keyboard/touch-accessible stage menus, edit dialogs, optimistic moves, and conflict feedback. Missing submission/response dates are requested before a move; existing precise timestamps are preserved. Archive/restore remains in Table view. Each column shows the most recently updated 40 matching cards and links to the complete paginated table when there are more.
2. **Overview:** inclusive submitted-from/through dates, IANA timezone, and weekly/monthly groups. All conversion cards and funnel steps share a submission cohort. Interview conversion uses recorded stage history, so later rejection/archiving does not erase an interview. An offer implies an interview. Active pipelines are current nonarchived Applied/Screening/Technical records across all dates and are labeled separately.
3. **Discovered jobs:** up to ten owned search profiles, enable/pause through the profile editor, manual mock search, matching explanations, New/Saved/Dismissed views, save to Wishlist, and dismiss/restore. Saving never marks a listing as applied, and repeated/concurrent saves return the same application.
4. **Read-only demo:** overview, table/board, and a discovery example all use synthetic fixtures. Real records require an authenticated account; there is no public write bypass.

## Analytics rules

Dates represent local calendar boundaries in the selected timezone, converted to a half-open UTC interval [start, day-after-end). Temporal handles daylight-saving changes. Weekly buckets start Monday; monthly buckets start on the first day. Zero-count buckets are emitted, and partial edge buckets contain only selected dates. Ranges are bounded to 730 days between endpoints.

A record with appliedAt in the range belongs to the submitted cohort, including archived records or cards later moved backward to Wishlist. Unsubmitted Wishlist records do not count. Milestones and responses reflect all recorded history, not a point-in-time reconstruction at the cohort end date. First response excludes no-response records from the average; empty denominators are 0%, and absent response durations render as a dash. The activity chart has an expandable data table.

Prisma loads only the cohort fields and interview/offer history needed for aggregation, in a repeatable-read transaction with the all-time active count. This is an indexed, personal-scale implementation; a SQL aggregate/materialized-view migration and performance benchmarking remain necessary before claiming large-scale performance.

Manual date-only inputs continue to mean UTC midnight as in Week 1. Analytics interprets stored timestamps in the selected timezone. Thus a manually entered date can bucket to the previous local date in western timezones. Precise imported timestamps will be preserved; a future local-date entry policy must explicitly migrate or distinguish the existing date-only data.

## Match rules

The mock provider contains six fixed fictional listings under example.com URLs. Titles use case-insensitive substring OR matching. If keywords are supplied, at least one must match the title/description/company. Any excluded keyword rejects the listing. Location and work-arrangement filters are additional AND conditions; empty optional filters mean any value. “Remote” does not override a supplied location constraint.

Scores are rule coverage, not predicted hiring likelihood: 60% for the required constraints plus up to 40% for matched keyword coverage (100% when no keywords were requested). Reasons show actual matching rules. Provider results are bounded to 100 per run and validated before persistence, including HTTP/HTTPS URL validation.

Changing a profile increments its version and removes matches for its old definition, without deleting previously discovered listings or applications. Existing listings may therefore have no current matching profile until another run. Deleting a profile stops future runs but preserves discovered/saved records and detaches historical run logs.

## Background workflow

- `hourly-job-discovery`: cron `0 * * * *` (UTC); reads enabled profiles in cursor-paginated batches of 100 and sends durable per-profile events.
- `discover-profile`: validates the event, rechecks ownership/profile version/enabled state, applies per-profile concurrency one, and retries failed steps up to three times.
- A run key includes provider, profile ID, profile version, and UTC hour. Database run records prevent duplicate successful work beyond Inngest's event dedupe window. Manual runs use the same key and service as background runs.
- Row locks serialize profile changes/commits and discovered-job saves. A late failed provider request cannot overwrite a completed run. A profile paused, edited, or deleted during fetching cannot persist stale results.
- Listing uniqueness is per user/provider/external ID; multiple profiles share listings through JobMatch. Applications are unique per discovered listing. Stage events and audit events are written transactionally.
- Only identifiers, version, and hour are sent to Inngest; no email, resume, or mailbox content is sent. Provider failure logs contain a stable error code, not raw exception details.

This milestone uses a single bounded mock batch, not provider pagination. A real authorized provider will need pagination, backoff/rate limits, and its own ingestion/retention contract.

## Local scheduling

The app, PostgreSQL, and Inngest runner must all be running. Existing .env files are not overwritten by setup; add `INNGEST_DEV="1"` explicitly for local development. The application origin must be loopback for this dev flag to take effect.

```sh
npm ci
npm run setup:env
npm run db:local
# Another terminal:
npm run db:deploy
npm run db:generate
npm run dev
# Another terminal:
npm run workflows:dev
```

The Inngest dashboard is at http://127.0.0.1:8288. Create an enabled search profile in the app; “Run mock search” works immediately and subsequent hourly runs use the same matching service. Scheduled execution stops when the local runner is stopped or the machine is asleep. The UI reports configuration, not a heartbeat guarantee; last successful run is shown per profile.

For a hosted deployment, disable INNGEST_DEV, set INNGEST_SIGNING_KEY and INNGEST_EVENT_KEY from the selected Inngest environment, and synchronize the deployed `/api/inngest` endpoint. The route fails closed with 503 when neither loopback dev mode nor a signing key is configured; the SDK verifies signed production requests. Hosting and cloud credentials are not provisioned in this milestone.

The Inngest CLI installer downloads its platform binary. If your npm version blocks install scripts, review and permit `inngest-cli`'s postinstall script. A scoped override updates its vulnerable adm-zip dependency to 0.6.1; Prisma's existing overrides remain in place. CLI startup and event delivery were exercised with the override.

## Validation

16 unit tests and 19 PostgreSQL integration tests cover cohort/history semantics, DST (23/25-hour days), midnight edges, weekly/monthly buckets, matching rules, owner isolation, paused/edited profiles, duplicate deliveries, concurrent saves, failed/retried requests, invalid provider URLs, and board moves. HTTP smoke checks exercise authenticated board/discovery flows. A separate smoke script delivers duplicate events through a real local Inngest runner and verifies one persisted listing/match/run.

```sh
npm test
TEST_DATABASE_URL=postgresql://career:career_local@127.0.0.1:54329/career_test npm run test:integration
npm run test:http
node scripts/wait-workflows.mjs
npm run test:workflow
npm run lint
npm run typecheck
npm run build
npm audit
```

CI provisions PostgreSQL, builds the application, starts the production server and local Inngest runner, and runs both HTTP and workflow checks. Browser interaction/visual QA was not available in this session; HTTP and service tests do not substitute for drag/drop, touch, focus, or screen-reader testing.

## Week 3 handoff

Next: opt-in Outlook connection, incremental mailbox synchronization, and a review queue. Include creation of application records from confirmation emails as well as matching updates to existing applications. Start with a 30-day import; older historical import is explicit. Ambiguous records require review, and no mailbox has been accessed by the current app.
