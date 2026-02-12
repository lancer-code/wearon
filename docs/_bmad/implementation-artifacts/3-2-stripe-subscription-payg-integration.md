# Story 3.2: Stripe Subscription & PAYG Integration

Status: ready-for-dev

## Story

As a **store owner**,
I want **to subscribe to a credit plan or buy pay-as-you-go packs**,
so that **I can fund my store's try-on feature with the pricing model that fits my needs**.

## Acceptance Criteria

1. **Given** the billing page at `/(merchant)/billing`, **When** a store owner selects a subscription tier (Starter $49/350, Growth $99/800, Scale $199/1800), **Then** a Stripe Checkout session is created for the recurring subscription **And** on successful payment, `store_credits` balance is incremented by the tier's credit allocation **And** the store's `subscription_tier` and `subscription_id` are stored in the `stores` table.

2. **Given** the billing page, **When** a store owner selects a PAYG credit pack, **Then** a Stripe Checkout session is created for the one-time purchase at $0.18/credit **And** on successful payment, credits are added to `store_credits`.

3. **Given** a Stripe webhook for subscription renewal, **When** payment succeeds, **Then** the store's credit balance is topped up by the tier allocation **And** a credit transaction is logged.

4. **Given** a Stripe webhook for payment failure, **When** subscription payment fails, **Then** the store is notified and given a grace period before credits are paused.

## Tasks / Subtasks

- [ ] Task 1: Install Stripe SDK (AC: #1, #2)
  - [ ] 1.1 Add `stripe` package to `packages/api` dependencies.
  - [ ] 1.2 Create `packages/api/src/services/stripe.ts` — configure Stripe client with `STRIPE_SECRET_KEY`. Export helper functions for checkout session creation.
  - [ ] 1.3 Define subscription tiers as constants: `{ starter: { price: 4900, credits: 350 }, growth: { price: 9900, credits: 800 }, scale: { price: 19900, credits: 1800 } }`.

- [ ] Task 2: Create billing page UI (AC: #1, #2)
  - [ ] 2.1 Create `apps/next/app/(merchant)/billing/page.tsx` — pricing cards for subscription tiers + PAYG option.
  - [ ] 2.2 Create tRPC endpoint `merchant.createCheckoutSession` — creates Stripe Checkout session (subscription or one-time).
  - [ ] 2.3 Redirect to Stripe Checkout on plan selection.

- [ ] Task 3: Create Stripe webhook handler (AC: #3, #4)
  - [ ] 3.1 Create `apps/next/app/api/v1/webhooks/stripe/route.ts` — verify Stripe webhook signature.
  - [ ] 3.2 Handle `checkout.session.completed`: add credits to `store_credits`, update `stores.subscription_tier` and `subscription_id`.
  - [ ] 3.3 Handle `invoice.paid` (renewal): top up credits by tier allocation.
  - [ ] 3.4 Handle `invoice.payment_failed`: log warning, notify store owner (email or dashboard alert).

- [ ] Task 4: Write tests (AC: #1-4)
  - [ ] 4.1 Test checkout session creation for each tier and PAYG.
  - [ ] 4.2 Test webhook adds credits correctly.
  - [ ] 4.3 Test payment failure handling.

## Dev Notes

### Architecture Requirements

- **ADR-5**: Merchant billing via Stripe on WearOn platform (not Shopify Billing API). [Source: architecture.md#ADR-5]
- Stripe webhook secret in `STRIPE_WEBHOOK_SECRET` env var.

### New Environment Variables

- `STRIPE_SECRET_KEY` — Stripe secret key
- `STRIPE_WEBHOOK_SECRET` — Stripe webhook signing secret
- `STRIPE_PUBLISHABLE_KEY` — For client-side Stripe.js

### Dependencies

- Story 2.3: Merchant billing page route.
- Story 3.1: B2B credit operations (`deductStoreCredit`, `refundStoreCredit`).

### References

- [Source: architecture.md#ADR-5] — Free Connector App Pattern, Stripe billing
- [Source: architecture.md#Cross-Cutting Concerns] — Dual Billing

## Dev Agent Record

### Agent Model Used

(to be filled by dev agent)

### Debug Log References

### Completion Notes List

### File List
