# Story 7.3: Revenue & Quality Dashboard

Status: ready-for-dev

## Story

As a **platform admin**,
I want **to view revenue and quality metrics across B2B and B2C**,
so that **I can track business health, margins, and generation quality**.

## Acceptance Criteria

1. **Given** the admin dashboard, **When** the admin views the revenue section, **Then** they see: B2B wholesale revenue, B2C credit pack revenue, total OpenAI costs, and margin percentage.

2. **Given** the admin dashboard, **When** the admin views quality metrics, **Then** they see: generation success rate, moderation block count, refund count, and average generation time.

## Tasks / Subtasks

- [ ] Task 1: Revenue analytics tRPC endpoints (AC: #1)
  - [ ] 1.1 Add `getRevenueOverview` (adminProcedure) to analytics router.
  - [ ] 1.2 Query `store_credit_transactions` for B2B wholesale revenue (credit purchases).
  - [ ] 1.3 Query `credit_transactions` for B2C credit pack revenue.
  - [ ] 1.4 Estimate OpenAI costs from generation count (configurable cost-per-generation).
  - [ ] 1.5 Calculate margin: (total revenue - total costs) / total revenue.
  - [ ] 1.6 Support date-range filtering.

- [ ] Task 2: Quality metrics tRPC endpoints (AC: #2)
  - [ ] 2.1 Add `getQualityMetrics` (adminProcedure) to analytics router.
  - [ ] 2.2 Query both `store_generation_sessions` (B2B) and `generation_sessions` (B2C) for combined stats.
  - [ ] 2.3 Calculate: success rate (completed / total), moderation block count (from analytics events), refund count, average generation time (completed_at - created_at).
  - [ ] 2.4 Support date-range filtering and B2B/B2C channel breakdown.

- [ ] Task 3: Revenue & quality dashboard UI (AC: #1-2)
  - [ ] 3.1 Create `packages/app/features/admin/admin-revenue-dashboard.tsx` component.
  - [ ] 3.2 Revenue section: cards for B2B revenue, B2C revenue, costs, margin.
  - [ ] 3.3 Quality section: cards for success rate, moderation blocks, refunds, avg generation time.
  - [ ] 3.4 Add date-range picker for filtering.
  - [ ] 3.5 Create `apps/next/app/admin/revenue/page.tsx` admin route.
  - [ ] 3.6 Add navigation link in admin sidebar.

- [ ] Task 4: Write tests (AC: #1-2)
  - [ ] 4.1 Test revenue overview calculates correct totals.
  - [ ] 4.2 Test quality metrics combines B2B and B2C data correctly.
  - [ ] 4.3 Test date-range filtering works for both endpoints.
  - [ ] 4.4 Test admin-only access.

## Dev Notes

### Architecture Requirements

- **FR43**: Revenue dashboard (B2B wholesale + B2C credit packs, costs, margin).
- **FR44**: Quality metrics (success rate, moderation blocks, refunds).
- Admin-only access via `adminProcedure`.

### Revenue Calculation

- B2B revenue: sum of `store_credit_transactions` WHERE `type = 'purchase'`.
- B2C revenue: sum of `credit_transactions` WHERE `type = 'purchase'`.
- OpenAI costs: generation count * configurable rate (stored in admin settings or env var).
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

(to be filled by dev agent)

### Debug Log References

### Completion Notes List

### File List
