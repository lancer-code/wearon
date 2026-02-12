# Story 6.4: Shopper Credit Balance & Plugin Flow (wearon-shopify)

Status: done

## Story

As a **shopper on a resell-mode store**,
I want **to create an account, buy credits, and use them for try-ons**,
so that **I can pay for the try-on experience through the store's checkout**.

## Acceptance Criteria

1. **Given** a store is in resell mode, **When** a shopper taps "Try On", **Then** they are prompted to log into their store account (email resolved server-side via Shopify customer context).

2. **Given** a logged-in shopper with 0 credits, **When** they want a try-on, **Then** credit purchase options are shown with the store's retail pricing **And** checkout opens in a new tab via Shopify cart link.

3. **Given** a shopper has purchased credits, **When** the plugin checks balance via WearOn API, **Then** the updated credit balance is displayed and try-on is enabled.

## Tasks / Subtasks

- [x] Task 1: Shopper credit balance API endpoint (AC: #3)
  - [x] 1.1 Create route `apps/next/app/api/v1/credits/shopper/route.ts`.
  - [x] 1.2 Use `withB2BAuth` middleware. Shopper email passed from server-side proxy (Shopify customer context).
  - [x] 1.3 Query `store_shopper_credits` WHERE `store_id = context.storeId AND shopper_email = email`.
  - [x] 1.4 Return `{ data: { balance, total_purchased, total_spent }, error: null }`.
  - [x] 1.5 Return balance of 0 if no record exists (new shopper).

- [x] Task 2: Resell mode plugin flow — wearon-shopify (AC: #1, #2)
  - [x] 2.1 In theme app extension, check store config for `billing_mode === 'resell_mode'`.
  - [x] 2.2 If resell mode: require Shopify customer login before try-on (server-side proxy resolves email).
  - [x] 2.3 Check shopper credit balance via server-side proxy → WearOn API.
  - [x] 2.4 If balance === 0: show credit purchase UI with retail pricing and Shopify cart link.
  - [x] 2.5 If balance > 0: enable try-on button, show remaining credits.
  - [x] 2.6 After checkout (new tab), poll balance endpoint until credits appear (5s interval, 60s timeout).

- [x] Task 3: Shopper credit deduction for resell mode generation (AC: #3)
  - [x] 3.1 Extend `POST /api/v1/generation/create` to check `billing_mode`.
  - [x] 3.2 If `resell_mode`: deduct from `store_shopper_credits` (not `store_credits`).
  - [x] 3.3 If `absorb_mode`: deduct from `store_credits` (existing behavior from Story 4.1).
  - [x] 3.4 Create corresponding transaction records.

- [x] Task 4: Write tests (AC: #1-3)
  - [x] 4.1 Test shopper balance endpoint returns correct balance.
  - [x] 4.2 Test new shopper returns 0 balance.
  - [x] 4.3 Test resell mode generation deducts from shopper credits.
  - [x] 4.4 Test absorb mode generation deducts from store credits.
  - [x] 4.5 Test insufficient shopper credits returns 402.

### Review Follow-ups (AI)

- [x] [AI-Review][HIGH] All 5 overage flow tests missing required `age_verified: true` field in request body, causing 100% test failure rate (all returning 403 age verification error instead of testing overage billing logic). [apps/next/__tests__/b2b-generation-overage.route.test.ts:121,174,200,235,277] **FIXED 2026-02-13**: Added `age_verified: true` to all 5 test request bodies. All 8 Story 6.4 tests now passing (3 shopper balance + 5 overage flow).

## Dev Notes

- **This story spans wearon (API) and wearon-shopify (plugin UI).**
- **FP-4**: Shopper login required for try-on (both modes). In resell mode, email needed for credit tracking. In absorb mode, email needed for rate limiting. [Source: architecture.md#FP-4]
- **FR36**: Widget collects shopper account creation when store uses resell mode.
- **BR8**: Lead-first funnel for resell mode — signup required before free try-on.

### Shopper Identification

- Shopper email auto-fetched from Shopify customer context by the server-side proxy.
- Never trusted from client-side payload.
- Credits are store-scoped: credits on Store A don't exist on Store B.

### Credit Deduction Logic (Resell vs Absorb)

- **Absorb mode**: `store_credits` balance decremented by 1 per generation.
- **Resell mode**: `store_shopper_credits` balance decremented by 1 per generation. Store pool was already deducted at purchase time (Story 6.3).

### Dependencies

- Story 4.1: `POST /api/v1/generation/create` endpoint (extend for resell mode).
- Story 6.1: Billing mode configuration (determines flow).
- Story 6.2: Hidden product + cart link (for purchase flow).
- Story 6.3: Webhook processing (credits arrive after purchase).
- Story 1.1: `store_shopper_credits` table.

### References

- [Source: architecture.md#FP-4] — Shopper Login Required
- [Source: architecture.md#Resell Mode Architecture] — Credit Flow, Shopper Identification
- [Source: architecture.md#ADR-3] — Plugin Architecture (server-side proxy pattern)
- [Source: epics.md#Story 6.4] — Shopper Credit Balance & Plugin Flow

### Database Types

- Use generated Supabase types from `packages/api/src/types/database.ts` for all database operations where applicable.
- Regenerate types after any migration: `npx supabase gen types typescript --project-id ljilupbgmrizblkzokfa > packages/api/src/types/database.ts`

### Workflow

- **Commit code after story completion.** Each completed story should be committed as a standalone commit before moving to the next story.

## Dev Agent Record

### Agent Model Used

Codex GPT-5

### Debug Log References

- `yarn vitest run apps/next/__tests__/shopper-balance.route.test.ts apps/next/__tests__/b2b-generation.route.test.ts packages/api/__tests__/services/b2b-credits.test.ts`
- `node node_modules/vitest/vitest.mjs run wearon-shopify/__tests__/tryon-widget.test.js wearon-shopify/__tests__/tryon-privacy-flow.test.js`

### Completion Notes List

- Added shopper credit balance endpoint at `GET /api/v1/credits/shopper` with `x-shopper-email` validation and zero-balance fallback.
- Extended generation create flow to branch by `stores.billing_mode`:
  - `absorb_mode` uses store-level credit deduction (existing behavior)
  - `resell_mode` uses shopper-level credit deduction and refund handling.
- Added shopper-level credit RPC migration `013_store_shopper_credit_rpc.sql`:
  - `deduct_store_shopper_credits`
  - `refund_store_shopper_credits`
- Added storefront utility flow for shopper credits in `wearon-shopify`:
  - read shopper balance
  - poll for post-checkout balance updates
  - construct/open Shopify cart links.
- Updated try-on widget flow for resell mode: credit-aware CTA, purchase button, balance text, and checkout polling behavior.

### File List

- `apps/next/app/api/v1/credits/shopper/route.ts`
- `apps/next/app/api/v1/generation/create/route.ts`
- `apps/next/__tests__/shopper-balance.route.test.ts`
- `apps/next/__tests__/b2b-generation.route.test.ts`
- `packages/api/src/services/b2b-credits.ts`
- `packages/api/__tests__/services/b2b-credits.test.ts`
- `supabase/migrations/013_store_shopper_credit_rpc.sql`
- `wearon-shopify/extensions/wearon-tryon/assets/tryon-privacy-flow.js`
- `wearon-shopify/extensions/wearon-tryon/assets/tryon-widget.js`
- `wearon-shopify/__tests__/tryon-privacy-flow.test.js`
- `wearon-shopify/__tests__/tryon-widget.test.js`
- `apps/next/__tests__/b2b-generation-overage.route.test.ts` (overage flow tests)

### Change Log

- 2026-02-13: Code review found critical test gap: all 5 overage flow tests missing `age_verified: true`, causing 100% failure rate (all returning 403 instead of testing overage logic). Fixed all test cases, all 8 tests now passing. Story marked done.
