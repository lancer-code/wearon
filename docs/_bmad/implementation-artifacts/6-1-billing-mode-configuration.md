# Story 6.1: Billing Mode Configuration

Status: ready-for-dev

## Story

As a **store owner**,
I want **to choose between absorb mode and resell mode**,
so that **I can either offer free try-ons or sell credits to shoppers for profit**.

## Acceptance Criteria

1. **Given** the merchant dashboard or App Bridge settings, **When** a store owner toggles billing mode to "resell", **Then** the `stores.billing_mode` is updated to `resell_mode` **And** the store owner is prompted to set a retail credit price.

2. **Given** the store is in resell mode, **When** the store owner sets a retail price (e.g., $0.50/credit), **Then** the price is stored in `stores.retail_credit_price` **And** the plugin displays credit pricing to shoppers.

3. **Given** the store switches from resell back to absorb mode, **When** the toggle is saved, **Then** `stores.billing_mode` is updated to `absorb_mode` **And** any remaining shopper credits are still usable (not revoked).

## Tasks / Subtasks

- [ ] Task 1: Billing mode API endpoint (AC: #1, #2, #3)
  - [ ] 1.1 Create or extend `apps/next/app/api/v1/stores/config/route.ts` to support `PATCH` for billing mode updates.
  - [ ] 1.2 Use `withB2BAuth` middleware — only store owner can update.
  - [ ] 1.3 Validate input: `billing_mode` must be `absorb_mode` or `resell_mode`.
  - [ ] 1.4 When switching to `resell_mode`, require `retail_credit_price` (numeric, > 0).
  - [ ] 1.5 Update `stores` table: `billing_mode` and `retail_credit_price` columns.
  - [ ] 1.6 Return updated config in B2B response format.

- [ ] Task 2: Billing mode UI — App Bridge settings (AC: #1, #2)
  - [ ] 2.1 In wearon-shopify `app/routes/app.settings.tsx`, add billing mode toggle (absorb/resell).
  - [ ] 2.2 When resell selected, show retail price input field.
  - [ ] 2.3 Call WearOn API `PATCH /api/v1/stores/config` via server-side proxy to save settings.
  - [ ] 2.4 Use Polaris components for native Shopify Admin look.

- [ ] Task 3: Config endpoint for plugin (AC: #2)
  - [ ] 3.1 Ensure `GET /api/v1/stores/config` returns `billing_mode` and `retail_credit_price` fields.
  - [ ] 3.2 Plugin reads config to determine flow (absorb vs resell).

- [ ] Task 4: Write tests (AC: #1-3)
  - [ ] 4.1 Test billing mode toggle updates stores table correctly.
  - [ ] 4.2 Test resell mode requires retail_credit_price.
  - [ ] 4.3 Test switching back to absorb mode preserves shopper credits.
  - [ ] 4.4 Test GET config returns current billing mode.

## Dev Notes

### Architecture Requirements

- **ADR-5**: Free Connector App Pattern — billing via Stripe on WearOn platform. [Source: architecture.md#ADR-5]
- **FR3**: Store owner can configure billing mode (absorb/resell).
- **FR4**: Store owner can set retail credit price in resell mode.
- Billing mode stored as enum in `stores.billing_mode` column: `absorb_mode` (default) or `resell_mode`.

### Database Columns

- `stores.billing_mode` — TEXT with CHECK constraint (`absorb_mode`, `resell_mode`), default `absorb_mode`.
- `stores.retail_credit_price` — NUMERIC, nullable (only set in resell mode).
- These columns should already exist from migration 005 (Story 1.1). Verify before creating additional migration.

### Dependencies

- Story 1.1: `stores` table with `billing_mode` and `retail_credit_price` columns.
- Story 2.1: `withB2BAuth` middleware, B2B response utilities.
- Story 2.3: Merchant dashboard (provides the UI context).

### Cross-Repo

- **wearon**: API endpoint for config updates.
- **wearon-shopify**: App Bridge settings page for billing mode toggle.

### References

- [Source: architecture.md#ADR-5] — Free Connector App Pattern
- [Source: architecture.md#Resell Mode Architecture] — Credit flow details
- [Source: architecture.md#Absorb Mode Architecture] — Absorb mode flow
- [Source: epics.md#Story 6.1] — Billing Mode Configuration

## Dev Agent Record

### Agent Model Used

(to be filled by dev agent)

### Debug Log References

### Completion Notes List

### File List
