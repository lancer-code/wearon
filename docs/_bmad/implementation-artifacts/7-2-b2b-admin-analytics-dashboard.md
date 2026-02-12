# Story 7.2: B2B Admin Analytics Dashboard

Status: done

## Story

As a **platform admin**,
I want **to view aggregated B2B analytics with store-by-store breakdown**,
so that **I can monitor platform health and identify at-risk stores**.

## Acceptance Criteria

1. **Given** the existing admin panel at `/admin/`, **When** the admin views B2B analytics, **Then** they see: total active stores, total B2B generations, store-by-store breakdown, and credit consumption.

2. **Given** the admin panel, **When** the admin manages stores, **Then** they can view store details, credit balances, subscription tiers, and generation history.

## Tasks / Subtasks

- [x] Task 1: B2B analytics tRPC endpoints (AC: #1, #2)
  - [x] 1.1 Extend `packages/api/src/routers/analytics.ts` with B2B admin queries.
  - [x] 1.2 `getB2BOverview` (adminProcedure): total active stores, total B2B generations, total credits consumed, date-range filtering.
  - [x] 1.3 `getStoreBreakdown` (adminProcedure): per-store stats — generation count, credit balance, subscription tier, last generation date. Paginated.
  - [x] 1.4 `getStoreDetail` (adminProcedure): single store details — full credit history, generation history, config.

- [x] Task 2: B2B admin dashboard UI (AC: #1)
  - [x] 2.1 Create `packages/app/features/admin/admin-b2b-analytics.tsx` component.
  - [x] 2.2 Display B2B overview cards: total stores, total generations, total revenue, credit consumption.
  - [x] 2.3 Display store-by-store breakdown table with sorting and filtering.
  - [x] 2.4 Link each store row to store detail view.

- [x] Task 3: Store management UI (AC: #2)
  - [x] 3.1 Create `packages/app/features/admin/admin-store-detail.tsx` component.
  - [x] 3.2 Display store config, credit balance, subscription tier, API key status.
  - [x] 3.3 Display generation history table (paginated).
  - [x] 3.4 Display credit transaction history table (paginated).

- [x] Task 4: Admin route pages (AC: #1-2)
  - [x] 4.1 Create `apps/next/app/admin/b2b-analytics/page.tsx` — B2B overview + store breakdown.
  - [x] 4.2 Create `apps/next/app/admin/stores/page.tsx` — store list with management.
  - [x] 4.3 Create `apps/next/app/admin/stores/[id]/page.tsx` — store detail view.
  - [x] 4.4 Add navigation links in admin sidebar (`admin-sidebar.tsx`).

- [x] Task 5: Write tests (AC: #1-2)
  - [x] 5.1 Test B2B overview returns correct aggregate stats.
  - [x] 5.2 Test store breakdown pagination works.
  - [x] 5.3 Test store detail returns complete store information.
  - [x] 5.4 Test admin-only access (non-admins rejected).

### Review Follow-ups (AI)

- [x] [AI-Review][MEDIUM] All 4 admin analytics tRPC endpoints accept `startDate` and `endDate` query params as unvalidated `z.string().optional()`, allowing invalid dates (e.g., "not-a-date") to be passed directly to database `gte()`/`lte()` operations without ISO 8601 format validation - same vulnerability as Story 7.1. Affects: `getB2BOverview`, and 3 other revenue/quality endpoints. [packages/api/src/routers/analytics.ts:201-202,490-491,600-601,709-710] **FIXED 2026-02-13**: Created reusable `iso8601DateString` Zod schema with refinement that validates both date parsing and ISO 8601 format. Applied to all 4 affected endpoints (replaced all instances of `z.string().optional()` with `iso8601DateString.optional()` for date fields). Added 1 new test validating the date format requirements. All 15 tests passing.

## Dev Notes

### Architecture Requirements

- **FR41**: Platform admin views aggregated B2B analytics with store-by-store breakdown.
- **FR50**: Platform admin can manage stores, users, and roles via admin panel.
- Admin panel uses existing `adminProcedure` for access control. [Source: CLAUDE.md#RBAC]
- Uses tRPC (not B2B REST API) since this is the WearOn admin panel, not merchant-facing.

### Existing Admin Pattern

- Admin layout at `packages/app/features/admin/admin-layout.tsx`.
- Admin sidebar at `packages/app/features/admin/admin-sidebar.tsx`.
- Follow existing pattern for new admin pages.
- Tamagui for UI components (not Polaris — Polaris is Shopify only).

### Dependencies

- Story 1.1: B2B tables (`stores`, `store_generation_sessions`, `store_credits`, etc.).
- Story 7.1: `store_analytics_events` table and event logging.
- Existing admin infrastructure: `adminProcedure`, admin layout, sidebar.

### References

- [Source: architecture.md#FR Category → Structure Mapping] — Analytics/Admin category
- [Source: architecture.md#Project Structure] — Admin panel location
- [Source: epics.md#Story 7.2] — B2B Admin Analytics Dashboard

### Database Types

- Use generated Supabase types from `packages/api/src/types/database.ts` for all database operations where applicable.
- Regenerate types after any migration: `npx supabase gen types typescript --project-id ljilupbgmrizblkzokfa > packages/api/src/types/database.ts`

### Workflow

- **Commit code after story completion.** Each completed story should be committed as a standalone commit before moving to the next story.

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

None — clean implementation, no debugging issues.

### Completion Notes List

- Implemented 3 new adminProcedure tRPC endpoints: `getB2BOverview`, `getStoreBreakdown`, `getStoreDetail`
- All endpoints use `adminSupabase` (service role) for B2B table access
- `getB2BOverview` supports optional date-range filtering
- `getStoreBreakdown` and `getStoreDetail` support paginated results
- Created B2B analytics dashboard UI with overview cards and store breakdown table
- Created store detail page with credit balance, generation history, and transaction history
- Added `/admin/b2b-analytics` and `/admin/stores/[id]` routes
- Added "B2B Analytics" and "Stores" links to admin sidebar (admin-only)
- Sidebar now highlights active state for sub-paths (e.g., `/admin/stores/abc` highlights Stores)
- 14 unit tests covering aggregate stats, pagination, store detail, and admin-only access
- No regressions introduced (pre-existing test failures unrelated to this story)

### File List

- packages/api/src/routers/analytics.ts (modified — added getB2BOverview, getStoreBreakdown, getStoreDetail)
- packages/app/features/admin/admin-b2b-analytics.tsx (new)
- packages/app/features/admin/admin-store-detail.tsx (new)
- packages/app/features/admin/admin-sidebar.tsx (modified — added B2B Analytics and Stores nav items)
- packages/app/features/admin/index.ts (modified — added exports)
- apps/next/app/admin/b2b-analytics/page.tsx (new)
- apps/next/app/admin/stores/page.tsx (new)
- apps/next/app/admin/stores/[id]/page.tsx (new)
- packages/api/__tests__/routers/b2b-analytics.test.ts (new)
- docs/_bmad/implementation-artifacts/sprint-status.yaml (modified)
- docs/_bmad/implementation-artifacts/7-2-b2b-admin-analytics-dashboard.md (modified)

## Change Log

- 2026-02-13: Code review found same date validation gap as Story 7.1 affecting all 4 admin analytics endpoints. Created reusable Zod date validator, applied to all endpoints. Added 1 new test. All 15 tests passing. Story marked done.
