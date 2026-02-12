# Story 7.3: Revenue & Quality Dashboard

Status: review

## Story

As a **platform admin**,
I want **to view revenue and quality metrics across B2B and B2C**,
so that **I can track business health, margins, and generation quality**.

## Acceptance Criteria

1. **Given** the admin dashboard, **When** the admin views the revenue section, **Then** they see: B2B wholesale revenue, B2C credit pack revenue, total OpenAI costs, and margin percentage.

2. **Given** the admin dashboard, **When** the admin views quality metrics, **Then** they see: generation success rate, moderation block count, refund count, and average generation time.

## Tasks / Subtasks

- [x] Task 1: Revenue analytics tRPC endpoints (AC: #1)
  - [x] 1.1 Add `getRevenueOverview` (adminProcedure) to analytics router.
  - [x] 1.2 Query `store_credit_transactions` for B2B wholesale revenue (credit purchases).
  - [x] 1.3 Query `credit_transactions` for B2C credit pack revenue.
  - [x] 1.4 Estimate OpenAI costs from generation count (configurable cost-per-generation).
  - [x] 1.5 Calculate margin: (total revenue - total costs) / total revenue.
  - [x] 1.6 Support date-range filtering.

- [x] Task 2: Quality metrics tRPC endpoints (AC: #2)
  - [x] 2.1 Add `getQualityMetrics` (adminProcedure) to analytics router.
  - [x] 2.2 Query both `store_generation_sessions` (B2B) and `generation_sessions` (B2C) for combined stats.
  - [x] 2.3 Calculate: success rate (completed / total), moderation block count (from analytics events), refund count, average generation time (completed_at - created_at).
  - [x] 2.4 Support date-range filtering and B2B/B2C channel breakdown.

- [x] Task 3: Revenue & quality dashboard UI (AC: #1-2)
  - [x] 3.1 Create `packages/app/features/admin/admin-revenue-dashboard.tsx` component.
  - [x] 3.2 Revenue section: cards for B2B revenue, B2C revenue, costs, margin.
  - [x] 3.3 Quality section: cards for success rate, moderation blocks, refunds, avg generation time.
  - [x] 3.4 Add date-range picker for filtering.
  - [x] 3.5 Create `apps/next/app/admin/revenue/page.tsx` admin route.
  - [x] 3.6 Add navigation link in admin sidebar.

- [x] Task 4: Write tests (AC: #1-2)
  - [x] 4.1 Test revenue overview calculates correct totals.
  - [x] 4.2 Test quality metrics combines B2B and B2C data correctly.
  - [x] 4.3 Test date-range filtering works for both endpoints.
  - [x] 4.4 Test admin-only access.

## Dev Notes

### Architecture Requirements

- **FR43**: Revenue dashboard (B2B wholesale + B2C credit packs, costs, margin).
- **FR44**: Quality metrics (success rate, moderation blocks, refunds).
- Admin-only access via `adminProcedure`.

### Revenue Calculation

- B2B revenue: sum of `store_credit_transactions` WHERE `type IN ('purchase', 'subscription')`.
- B2C revenue: sum of `credit_transactions` WHERE `type = 'purchase'` (future-proof — no B2C purchase type exists yet).
- OpenAI costs: generation count * configurable rate (`OPENAI_COST_PER_GENERATION` env var, default $0.05).
- This is an estimate — exact revenue tracking depends on Paddle webhook-backed transaction data.

### Dependencies

- Story 7.1: `store_analytics_events` for event-based metrics.
- Story 7.2: Admin panel infrastructure (sidebar, layout).
- Story 3.2: Payment integration — Paddle billing/webhook flow (credit purchases recorded in transaction tables).
- Existing B2C tables: `generation_sessions`, `credit_transactions`.

### References

- [Source: architecture.md#Analytics Segmentation] — Three views (merchant, B2C user, platform admin)
- [Source: epics.md#Story 7.3] — Revenue & Quality Dashboard

### Database Types

- Use generated Supabase types from `packages/api/src/types/database.ts` for all database operations where applicable.
- Regenerate types after any migration: `npx supabase gen types typescript --project-id ljilupbgmrizblkzokfa > packages/api/src/types/database.ts`

### Workflow

- **Commit code after story completion.** Each completed story should be committed as a standalone commit before moving to the next story.

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- No debug issues encountered during implementation.

### Completion Notes List

- Added `getRevenueOverview` adminProcedure endpoint to `packages/api/src/routers/analytics.ts` — queries B2B `store_credit_transactions` (purchase + subscription types) and B2C `credit_transactions` (purchase type) for revenue, estimates OpenAI costs via configurable `OPENAI_COST_PER_GENERATION` env var (default $0.05), calculates margin percentage.
- Added `getQualityMetrics` adminProcedure endpoint — combines B2B `store_generation_sessions` and B2C `generation_sessions` for success rate, queries `store_analytics_events` and `analytics_events` for moderation block counts, counts refunds from both transaction tables, calculates average generation time from completed sessions, includes B2B/B2C channel breakdown.
- Both endpoints support optional `startDate`/`endDate` date-range filtering.
- Created `admin-revenue-dashboard.tsx` UI component with revenue cards (B2B, B2C, costs, margin), quality cards (success rate, moderation blocks, refunds, avg gen time), channel breakdown table, and date-range picker.
- Created `/admin/revenue` page route and added "Revenue" navigation link with DollarSign icon in admin sidebar (admin-only).
- B2C revenue currently returns 0 — no `purchase` type exists in B2C `credit_transactions` yet (only signup_bonus/generation/refund). This is future-proof for when B2C credit purchases are implemented.
- 14 tests covering revenue calculations, quality metrics, date filtering, channel breakdown, and admin access requirements.

### File List

- `packages/api/src/routers/analytics.ts` — MODIFIED: Added `getRevenueOverview` and `getQualityMetrics` adminProcedure endpoints
- `packages/app/features/admin/admin-revenue-dashboard.tsx` — NEW: Revenue & quality dashboard UI component
- `apps/next/app/admin/revenue/page.tsx` — NEW: Admin revenue page route
- `packages/app/features/admin/admin-sidebar.tsx` — MODIFIED: Added DollarSign import and Revenue nav item
- `packages/api/__tests__/routers/revenue-quality.test.ts` — NEW: 14 tests for revenue and quality analytics

## Change Log

- 2026-02-12: Implemented all 4 tasks (revenue endpoints, quality endpoints, dashboard UI, tests).
