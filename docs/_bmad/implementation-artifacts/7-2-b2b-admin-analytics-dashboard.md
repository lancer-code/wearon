# Story 7.2: B2B Admin Analytics Dashboard

Status: ready-for-dev

## Story

As a **platform admin**,
I want **to view aggregated B2B analytics with store-by-store breakdown**,
so that **I can monitor platform health and identify at-risk stores**.

## Acceptance Criteria

1. **Given** the existing admin panel at `/admin/`, **When** the admin views B2B analytics, **Then** they see: total active stores, total B2B generations, store-by-store breakdown, and credit consumption.

2. **Given** the admin panel, **When** the admin manages stores, **Then** they can view store details, credit balances, subscription tiers, and generation history.

## Tasks / Subtasks

- [ ] Task 1: B2B analytics tRPC endpoints (AC: #1, #2)
  - [ ] 1.1 Extend `packages/api/src/routers/analytics.ts` with B2B admin queries.
  - [ ] 1.2 `getB2BOverview` (adminProcedure): total active stores, total B2B generations, total credits consumed, date-range filtering.
  - [ ] 1.3 `getStoreBreakdown` (adminProcedure): per-store stats — generation count, credit balance, subscription tier, last generation date. Paginated.
  - [ ] 1.4 `getStoreDetail` (adminProcedure): single store details — full credit history, generation history, config.

- [ ] Task 2: B2B admin dashboard UI (AC: #1)
  - [ ] 2.1 Create `packages/app/features/admin/admin-b2b-analytics.tsx` component.
  - [ ] 2.2 Display B2B overview cards: total stores, total generations, total revenue, credit consumption.
  - [ ] 2.3 Display store-by-store breakdown table with sorting and filtering.
  - [ ] 2.4 Link each store row to store detail view.

- [ ] Task 3: Store management UI (AC: #2)
  - [ ] 3.1 Create `packages/app/features/admin/admin-store-detail.tsx` component.
  - [ ] 3.2 Display store config, credit balance, subscription tier, API key status.
  - [ ] 3.3 Display generation history table (paginated).
  - [ ] 3.4 Display credit transaction history table (paginated).

- [ ] Task 4: Admin route pages (AC: #1-2)
  - [ ] 4.1 Create `apps/next/app/admin/b2b-analytics/page.tsx` — B2B overview + store breakdown.
  - [ ] 4.2 Create `apps/next/app/admin/stores/page.tsx` — store list with management.
  - [ ] 4.3 Create `apps/next/app/admin/stores/[id]/page.tsx` — store detail view.
  - [ ] 4.4 Add navigation links in admin sidebar (`admin-sidebar.tsx`).

- [ ] Task 5: Write tests (AC: #1-2)
  - [ ] 5.1 Test B2B overview returns correct aggregate stats.
  - [ ] 5.2 Test store breakdown pagination works.
  - [ ] 5.3 Test store detail returns complete store information.
  - [ ] 5.4 Test admin-only access (non-admins rejected).

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

(to be filled by dev agent)

### Debug Log References

### Completion Notes List

### File List
