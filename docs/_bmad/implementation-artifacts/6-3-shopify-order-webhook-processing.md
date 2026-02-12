# Story 6.3: Shopify Order Webhook Processing

Status: ready-for-dev

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

- [ ] Task 1: Webhook endpoint with HMAC verification (AC: #1)
  - [ ] 1.1 Create route at `apps/next/app/api/v1/webhooks/shopify/orders/route.ts`.
  - [ ] 1.2 Verify HMAC-SHA256 signature using Shopify app secret from environment variable.
  - [ ] 1.3 Read raw request body for signature verification (before JSON parsing).
  - [ ] 1.4 Reject invalid signatures with 401.
  - [ ] 1.5 Log all webhook arrivals with `request_id` (never log shopper emails in plaintext).

- [ ] Task 2: Credit transfer logic (AC: #2)
  - [ ] 2.1 Parse order webhook payload — extract `shopify_order_id`, line items, customer email, shop domain.
  - [ ] 2.2 Identify "Try-On Credit" product by matching `shopify_product_id` stored in `stores` table.
  - [ ] 2.3 Calculate credit quantity (N) from order line item quantity.
  - [ ] 2.4 Resolve `store_id` from `shop_domain` in `stores` table.
  - [ ] 2.5 Atomically: deduct N from `store_credits` (wholesale pool), add N to `store_shopper_credits` (shopper balance).
  - [ ] 2.6 Create `store_shopper_purchases` record with `shopify_order_id`, `store_id`, `shopper_email`, `credits_purchased`, `amount_paid`, `currency`.

- [ ] Task 3: Idempotent processing (AC: #3)
  - [ ] 3.1 Check `store_shopper_purchases` for existing record with same `shopify_order_id` before processing.
  - [ ] 3.2 If exists, return 200 with existing purchase data (no re-processing).
  - [ ] 3.3 Use `shopify_order_id` UNIQUE constraint to catch race conditions.

- [ ] Task 4: Insufficient credit handling (AC: #4)
  - [ ] 4.1 Before transferring, check `store_credits.balance >= N`.
  - [ ] 4.2 If insufficient, log error with `store_id` and `request_id`.
  - [ ] 4.3 Return 200 to Shopify (acknowledge webhook) but do NOT transfer credits.
  - [ ] 4.4 Create an analytics event `store_credit_insufficient` for admin visibility.

- [ ] Task 5: Write tests (AC: #1-4)
  - [ ] 5.1 Test HMAC verification accepts valid and rejects invalid signatures.
  - [ ] 5.2 Test credit transfer deducts from store pool and adds to shopper balance.
  - [ ] 5.3 Test duplicate webhook is idempotent.
  - [ ] 5.4 Test insufficient credits prevents transfer.
  - [ ] 5.5 Test non-"Try-On Credit" orders are ignored.

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

- Store buys credits wholesale from WearOn (via Stripe, Story 3.2).
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

## Dev Agent Record

### Agent Model Used

(to be filled by dev agent)

### Debug Log References

### Completion Notes List

### File List
