# Story 6.4: Shopper Credit Balance & Plugin Flow (wearon-shopify)

Status: ready-for-dev

## Story

As a **shopper on a resell-mode store**,
I want **to create an account, buy credits, and use them for try-ons**,
so that **I can pay for the try-on experience through the store's checkout**.

## Acceptance Criteria

1. **Given** a store is in resell mode, **When** a shopper taps "Try On", **Then** they are prompted to log into their store account (email resolved server-side via Shopify customer context).

2. **Given** a logged-in shopper with 0 credits, **When** they want a try-on, **Then** credit purchase options are shown with the store's retail pricing **And** checkout opens in a new tab via Shopify cart link.

3. **Given** a shopper has purchased credits, **When** the plugin checks balance via WearOn API, **Then** the updated credit balance is displayed and try-on is enabled.

## Tasks / Subtasks

- [ ] Task 1: Shopper credit balance API endpoint (AC: #3)
  - [ ] 1.1 Create route `apps/next/app/api/v1/credits/shopper/route.ts`.
  - [ ] 1.2 Use `withB2BAuth` middleware. Shopper email passed from server-side proxy (Shopify customer context).
  - [ ] 1.3 Query `store_shopper_credits` WHERE `store_id = context.storeId AND shopper_email = email`.
  - [ ] 1.4 Return `{ data: { balance, total_purchased, total_spent }, error: null }`.
  - [ ] 1.5 Return balance of 0 if no record exists (new shopper).

- [ ] Task 2: Resell mode plugin flow — wearon-shopify (AC: #1, #2)
  - [ ] 2.1 In theme app extension, check store config for `billing_mode === 'resell_mode'`.
  - [ ] 2.2 If resell mode: require Shopify customer login before try-on (server-side proxy resolves email).
  - [ ] 2.3 Check shopper credit balance via server-side proxy → WearOn API.
  - [ ] 2.4 If balance === 0: show credit purchase UI with retail pricing and Shopify cart link.
  - [ ] 2.5 If balance > 0: enable try-on button, show remaining credits.
  - [ ] 2.6 After checkout (new tab), poll balance endpoint until credits appear (5s interval, 60s timeout).

- [ ] Task 3: Shopper credit deduction for resell mode generation (AC: #3)
  - [ ] 3.1 Extend `POST /api/v1/generation/create` to check `billing_mode`.
  - [ ] 3.2 If `resell_mode`: deduct from `store_shopper_credits` (not `store_credits`).
  - [ ] 3.3 If `absorb_mode`: deduct from `store_credits` (existing behavior from Story 4.1).
  - [ ] 3.4 Create corresponding transaction records.

- [ ] Task 4: Write tests (AC: #1-3)
  - [ ] 4.1 Test shopper balance endpoint returns correct balance.
  - [ ] 4.2 Test new shopper returns 0 balance.
  - [ ] 4.3 Test resell mode generation deducts from shopper credits.
  - [ ] 4.4 Test absorb mode generation deducts from store credits.
  - [ ] 4.5 Test insufficient shopper credits returns 402.

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

## Dev Agent Record

### Agent Model Used

(to be filled by dev agent)

### Debug Log References

### Completion Notes List

### File List
