# Story 7.1: Store-Level Analytics API

Status: ready-for-dev

## Story

As a **store owner**,
I want **to view my store's analytics (generation count, credit usage, conversions)**,
so that **I can track ROI and optimize my try-on investment**.

## Acceptance Criteria

1. **Given** the `/api/v1/stores/config` endpoint (or App Bridge dashboard), **When** a store owner requests analytics, **Then** the response includes: total generations, credits used, credits remaining, success rate, and date-range filtering.

2. **Given** the B2B analytics events, **When** a generation completes or fails, **Then** an event is logged in `store_analytics_events` with `store_id`, event type, and metadata.

## Tasks / Subtasks

- [ ] Task 1: Store analytics API endpoint (AC: #1)
  - [ ] 1.1 Create route `apps/next/app/api/v1/stores/analytics/route.ts`.
  - [ ] 1.2 Use `withB2BAuth` middleware — scoped to requesting store's `store_id`.
  - [ ] 1.3 Query `store_generation_sessions` for generation stats: total count, completed count, failed count, success rate.
  - [ ] 1.4 Query `store_credits` for credit balance and `store_credit_transactions` for usage totals.
  - [ ] 1.5 Accept query params: `start_date`, `end_date` (ISO 8601 strings) for date-range filtering.
  - [ ] 1.6 Return in B2B response format with `snake_case` keys.

- [ ] Task 2: Analytics event logging (AC: #2)
  - [ ] 2.1 Create service function `logStoreAnalyticsEvent(storeId, eventType, metadata)` in `packages/api/src/services/`.
  - [ ] 2.2 Event types: `generation_queued`, `generation_completed`, `generation_failed`, `generation_moderation_blocked`, `credit_purchased`, `credit_deducted`, `credit_refunded`.
  - [ ] 2.3 Integrate event logging into generation create endpoint (Story 4.1) and webhook processing (Story 6.3).
  - [ ] 2.4 Store metadata as JSONB: `{ request_id, session_id, ... }`.

- [ ] Task 3: App Bridge analytics dashboard cards (AC: #1)
  - [ ] 3.1 In wearon-shopify `app/routes/app._index.tsx`, add dashboard cards showing store analytics.
  - [ ] 3.2 Fetch analytics from WearOn API via server-side proxy.
  - [ ] 3.3 Display: total generations (7d/30d), credit balance, success rate.
  - [ ] 3.4 Use Polaris DataTable or Card components.

- [ ] Task 4: Write tests (AC: #1-2)
  - [ ] 4.1 Test analytics endpoint returns correct stats for store.
  - [ ] 4.2 Test date-range filtering works correctly.
  - [ ] 4.3 Test analytics events are logged on generation completion/failure.
  - [ ] 4.4 Test store scoping — no cross-tenant analytics access.

## Dev Notes

### Architecture Requirements

- **FR39**: Store-level analytics (generation count, credit usage, conversion tracking).
- **FP-3**: Merchant dashboard minimal — day-to-day ops via Shopify Admin App Bridge cards. [Source: architecture.md#FP-3]
- Analytics are store-scoped — enforce `store_id` in all queries.

### Cross-Repo

- **wearon**: API endpoint + analytics event service.
- **wearon-shopify**: App Bridge dashboard cards displaying analytics.

### Dependencies

- Story 1.1: `store_analytics_events` table (migration 006).
- Story 2.1: `withB2BAuth` middleware, B2B response utilities.
- Story 4.1: Generation endpoints (where events are logged).

### References

- [Source: architecture.md#FP-3] — Merchant Dashboard Minimal
- [Source: architecture.md#FR Category → Structure Mapping] — Analytics category
- [Source: epics.md#Story 7.1] — Store-Level Analytics API

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
