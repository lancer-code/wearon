# Story 6.3: Shopify Order Webhook Processing

Status: done

## Story

As a **platform operator**,
I want **shopper credit purchases confirmed via Shopify order webhooks**,
so that **credits are added to shopper balances reliably and idempotently**.

## Acceptance Criteria

1. **Given** the webhook endpoint at `/api/v1/webhooks/shopify/orders`, **When** a Shopify `orders/create` webhook arrives, **Then** the HMAC-SHA256 signature is verified against the app secret **And** invalid signatures are rejected with `401`.

2. **Given** a valid order webhook for a "Try-On Credit" product, **When** the order is processed, **Then** N credits are deducted from the store's wholesale pool (`store_credits`) **And** N credits are added to the shopper's balance (`store_shopper_credits` keyed by `store_id` + `shopper_email`) **And** a record is created in `store_shopper_purchases` with `shopify_order_id`.

3. **Given** a duplicate webhook with the same `shopify_order_id`, **When** processed, **Then** the operation is idempotent — no double-credit, no error **And** the existing purchase record is returned.

4. **Given** the store's wholesale pool has insufficient credits, **When** a shopper purchase webhook arrives, **Then** the credit transfer fails gracefully and the store owner is notified.

## Tasks / Subtasks

- [x] Task 1: Webhook endpoint with HMAC verification (AC: #1)
  - [x] 1.1 Create route at `apps/next/app/api/v1/webhooks/shopify/orders/route.ts`.
  - [x] 1.2 Verify HMAC-SHA256 signature using Shopify app secret from environment variable.
  - [x] 1.3 Read raw request body for signature verification (before JSON parsing).
  - [x] 1.4 Reject invalid signatures with 401.
  - [x] 1.5 Log all webhook arrivals with `request_id` (never log shopper emails in plaintext).

- [x] Task 2: Credit transfer logic (AC: #2)
  - [x] 2.1 Parse order webhook payload — extract `shopify_order_id`, line items, customer email, shop domain.
  - [x] 2.2 Identify "Try-On Credit" product by matching `shopify_product_id` stored in `stores` table.
  - [x] 2.3 Calculate credit quantity (N) from order line item quantity.
  - [x] 2.4 Resolve `store_id` from `shop_domain` in `stores` table.
  - [x] 2.5 Atomically: deduct N from `store_credits` (wholesale pool), add N to `store_shopper_credits` (shopper balance).
  - [x] 2.6 Create `store_shopper_purchases` record with `shopify_order_id`, `store_id`, `shopper_email`, `credits_purchased`, `amount_paid`, `currency`.

- [x] Task 3: Idempotent processing (AC: #3)
  - [x] 3.1 Check `store_shopper_purchases` for existing record with same `shopify_order_id` before processing.
  - [x] 3.2 If exists, return 200 with existing purchase data (no re-processing).
  - [x] 3.3 Use `shopify_order_id` UNIQUE constraint to catch race conditions.

- [x] Task 4: Insufficient credit handling (AC: #4)
  - [x] 4.1 Before transferring, check `store_credits.balance >= N`.
  - [x] 4.2 If insufficient, log error with `store_id` and `request_id`.
  - [x] 4.3 Return 200 to Shopify (acknowledge webhook) but do NOT transfer credits.
  - [x] 4.4 Create an analytics event `store_credit_insufficient` for admin visibility.

- [x] Task 5: Write tests (AC: #1-4)
  - [x] 5.1 Test HMAC verification accepts valid and rejects invalid signatures.
  - [x] 5.2 Test credit transfer deducts from store pool and adds to shopper balance.
  - [x] 5.3 Test duplicate webhook is idempotent.
  - [x] 5.4 Test insufficient credits prevents transfer.
  - [x] 5.5 Test non-"Try-On Credit" orders are ignored.

### Review Follow-ups (AI)

- [x] [AI-Review][HIGH] Analytics event uses incorrect event type `'credit_deducted'` instead of required `'store_credit_insufficient'` for insufficient credit scenarios, breaking AC #4 requirement for admin visibility and causing test failures. [apps/next/app/api/v1/webhooks/shopify/orders/route.ts:285] **FIXED 2026-02-13**: Changed event type from `'credit_deducted'` to `'store_credit_insufficient'` to match AC #4 specification. All 5 tests now passing.
- [x] [AI-Review][HIGH] Type definition `StoreAnalyticsEventType` missing `'store_credit_insufficient'` event type, preventing TypeScript from accepting the correct event type even after fixing the event name. [packages/api/src/services/store-analytics.ts:21-28] **FIXED 2026-02-13**: Added `'store_credit_insufficient'` to union type enum for full type safety.
- [x] [AI-Review][MEDIUM] Shopper emails passed in plaintext to analytics storage (via `logStoreAnalyticsEvent` 4th parameter) despite dev note requirement "never log shopper emails in plaintext" (Task 1.5), creating GDPR/privacy violation. [apps/next/app/api/v1/webhooks/shopify/orders/route.ts:292,322] **FIXED 2026-02-13**: Removed plaintext email parameter, moved hashed email to metadata object (`shopper_email_hash`) for both `'store_credit_insufficient'` and `'credit_purchased'` events. Updated test assertions to verify hash presence in metadata.

## Dev Notes

### Architecture Requirements

- **FR13**: Process Shopify order webhooks to confirm shopper credit purchases.
- **NFR11**: HMAC-SHA256 signature verification on every webhook.
- **NFR26**: Delivery confirmation with idempotent processing; handle duplicate deliveries.
- **Resell Mode Architecture**: Shopify retries webhooks up to 19 times over 48 hours. [Source: architecture.md#Resell Mode Architecture]

### Webhook Reliability

- Always return 200 to Shopify to acknowledge receipt (even on internal errors).
- If return non-2xx, Shopify will retry up to 19 times.
- Idempotency via `shopify_order_id` UNIQUE constraint is critical.

### Credit Flow (Resell Mode)

- Store buys credits wholesale from WearOn (via Paddle, Story 3.2).
- Shopper buys credits from store (via Shopify checkout, this story).
- On purchase: N credits move from `store_credits` → `store_shopper_credits`.
- On generation: 1 credit deducted from `store_shopper_credits` (not store pool).

### Dependencies

- Story 1.1: `store_shopper_credits`, `store_shopper_purchases` tables (migration 007).
- Story 3.1: `deduct_store_credits()` RPC function.
- Story 6.2: Hidden product with `shopify_product_id` to match in webhook payload.

### References

- [Source: architecture.md#Resell Mode Architecture] — Credit Flow, Webhook Reliability
- [Source: architecture.md#Resilience & Failure Handling] — Webhook reliability patterns
- [Source: epics.md#Story 6.3] — Shopify Order Webhook Processing

### Database Types

- Use generated Supabase types from `packages/api/src/types/database.ts` for all database operations where applicable.
- Regenerate types after any migration: `npx supabase gen types typescript --project-id ljilupbgmrizblkzokfa > packages/api/src/types/database.ts`

### Workflow

- **Commit code after story completion.** Each completed story should be committed as a standalone commit before moving to the next story.

## Dev Agent Record

### Agent Model Used

Codex GPT-5

### Debug Log References

- `yarn vitest run apps/next/__tests__/shopify-orders-webhook.route.test.ts`
- `yarn vitest run apps/next/__tests__/shopify-orders-webhook.route.test.ts apps/next/__tests__/stores-config.route.test.ts packages/api/__tests__/services/shopify-credit-product.test.ts`

### Completion Notes List

- Added new Shopify `orders/create` webhook route: `apps/next/app/api/v1/webhooks/shopify/orders/route.ts`.
- Implemented HMAC validation, shop/store resolution, and credit-line-item parsing against `stores.shopify_product_id`.
- Added idempotent pre-check using `store_shopper_purchases.shopify_order_id`.
- Added atomic database RPC via migration `011_shopify_order_credit_transfer_rpc.sql`:
  - deducts store wholesale credits
  - inserts purchase record
  - upserts shopper credit balance
  - handles race duplicates using unique constraint + refund compensation
- Added insufficient-credit handling with analytics event `store_credit_insufficient`.
- Added webhook tests covering signature validation, successful transfer flow, duplicate idempotency, insufficient credit handling, and non-credit-order ignore path.

### File List

- `apps/next/app/api/v1/webhooks/shopify/orders/route.ts`
- `apps/next/__tests__/shopify-orders-webhook.route.test.ts`
- `packages/api/src/services/store-analytics.ts`
- `supabase/migrations/011_shopify_order_credit_transfer_rpc.sql`

### Change Log

- 2026-02-13: Code review found 3 critical issues: (1) wrong analytics event type causing test failure, (2) missing event type in TypeScript enum, (3) privacy violation with plaintext email storage. Fixed all issues: changed event type to `'store_credit_insufficient'`, added type to enum, replaced plaintext email with hash in metadata. All 5 tests passing. Story marked done.
