# Story 7.4: Churn Detection & B2C Admin Analytics

Status: ready-for-dev

## Story

As a **platform admin**,
I want **automatic churn risk flagging for stores and aggregated B2C analytics**,
so that **I can proactively retain stores and monitor the consumer app**.

## Acceptance Criteria

1. **Given** the churn detection system, **When** a store's generation count drops significantly (e.g., >50% decrease week-over-week), **Then** the store is flagged as "churn risk" in the admin dashboard.

2. **Given** the admin dashboard, **When** the admin views B2C analytics, **Then** they see: user growth, credit purchases, generation stats, and active user counts.

3. **Given** existing B2C personal history (FR40), **When** a B2C user views their generation history, **Then** it continues to work unchanged through existing tRPC endpoints.

## Tasks / Subtasks

- [ ] Task 1: Churn detection logic (AC: #1)
  - [ ] 1.1 Create service function `detectChurnRisk(storeId)` in `packages/api/src/services/`.
  - [ ] 1.2 Query `store_generation_sessions` for current week vs previous week generation count.
  - [ ] 1.3 Flag as churn risk if week-over-week decrease > 50%.
  - [ ] 1.4 Store churn risk flag in `stores` table (`is_churn_risk` boolean, `churn_flagged_at` timestamptz).
  - [ ] 1.5 Create cron job or scheduled task to run churn detection weekly for all active stores.

- [ ] Task 2: Churn detection cron endpoint (AC: #1)
  - [ ] 2.1 Create `apps/next/app/api/cron/churn-detection/route.ts`.
  - [ ] 2.2 Protect with `CRON_SECRET` (same pattern as existing cleanup cron).
  - [ ] 2.3 Iterate all active stores, run churn detection, update flags.
  - [ ] 2.4 Log results with count of newly flagged stores.

- [ ] Task 3: Churn risk in admin dashboard (AC: #1)
  - [ ] 3.1 Add churn risk column/badge to store breakdown table (Story 7.2).
  - [ ] 3.2 Add filter option to show only churn-risk stores.
  - [ ] 3.3 Display churn risk count in B2B overview cards.

- [ ] Task 4: B2C admin analytics tRPC endpoints (AC: #2)
  - [ ] 4.1 Add `getB2COverview` (adminProcedure) to analytics router.
  - [ ] 4.2 Query: total users, new users (7d/30d), active users (users with generation in last 30d).
  - [ ] 4.3 Query: total B2C generations, B2C credit purchases, B2C credits consumed.
  - [ ] 4.4 Support date-range filtering.

- [ ] Task 5: B2C analytics dashboard UI (AC: #2)
  - [ ] 5.1 Create `packages/app/features/admin/admin-b2c-analytics.tsx` component.
  - [ ] 5.2 Display: user growth chart/cards, credit purchase stats, generation stats, active user counts.
  - [ ] 5.3 Create `apps/next/app/admin/b2c-analytics/page.tsx` admin route.
  - [ ] 5.4 Add navigation link in admin sidebar.

- [ ] Task 6: Write tests (AC: #1-3)
  - [ ] 6.1 Test churn detection flags stores with >50% week-over-week drop.
  - [ ] 6.2 Test stores with stable usage are not flagged.
  - [ ] 6.3 Test B2C overview returns correct aggregate stats.
  - [ ] 6.4 Test cron endpoint processes all active stores.
  - [ ] 6.5 Verify existing B2C generation history endpoint unchanged.

## Dev Notes

### Architecture Requirements

- **FR45**: System flags stores with sudden usage drops as churn risk.
- **FR42**: Platform admin views aggregated B2C analytics.
- **FR40**: B2C personal history continues working unchanged.

### Churn Detection Logic

- Simple week-over-week comparison for MVP.
- Threshold: 50% decrease (configurable via constant).
- Runs weekly via Vercel Cron (same pattern as cleanup cron).
- Future enhancement: ML-based churn prediction.

### Database Changes

- Add to `stores` table (may need migration): `is_churn_risk` (boolean, default false), `churn_flagged_at` (timestamptz, nullable).
- Verify if these columns exist from migration 005 or need a new migration.

### Dependencies

- Story 7.2: B2B admin dashboard (churn risk integrates into store breakdown).
- Story 7.3: Revenue dashboard (sibling analytics page).
- Existing B2C tables: `users`, `generation_sessions`, `credit_transactions`.
- Existing cron pattern: `apps/next/app/api/cron/cleanup/route.ts`.

### References

- [Source: epics.md#Story 7.4] — Churn Detection & B2C Admin Analytics
- [Source: architecture.md#Analytics Segmentation] — Three analytics views

### Database Types

- Use generated Supabase types from `packages/api/src/types/database.ts` for all database operations where applicable.
- Regenerate types after any migration: `npx supabase gen types typescript --project-id ljilupbgmrizblkzokfa > packages/api/src/types/database.ts`

### Workflow

- **Commit code after story completion.** Each completed story should be committed as a standalone commit before moving to the next story.

## Dev Agent Record

### Agent Model Used

(to be filled by dev agent)

### Debug Log References

### Completion Notes List

### File List
