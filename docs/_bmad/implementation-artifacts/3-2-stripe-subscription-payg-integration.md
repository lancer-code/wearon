# Story 3.2: Payment Integration (Subscription & PAYG)

Status: on-hold

> **IMPORTANT: Payment provider is TBD.** Stripe will NOT be used on this platform. The payment provider decision is deferred — to be discussed and decided later. All previous Stripe implementation code has been removed. This story will be rewritten once the payment provider is chosen.

## Story

As a **store owner**,
I want **to subscribe to a credit plan or buy pay-as-you-go packs**,
so that **I can fund my store's try-on feature with the pricing model that fits my needs**.

## Acceptance Criteria

1. **Given** the billing page at `/merchant/billing`, **When** a store owner selects a subscription tier (Starter $49/350, Growth $99/800, Scale $199/1800), **Then** a checkout session is created via the chosen payment provider **And** on successful payment, `store_credits` balance is incremented by the tier's credit allocation **And** the store's `subscription_tier` and `subscription_id` are stored in the `stores` table.

2. **Given** the billing page, **When** a store owner selects a PAYG credit pack, **Then** a one-time checkout session is created at $0.18/credit **And** on successful payment, credits are added to `store_credits`.

3. **Given** a webhook for subscription renewal, **When** payment succeeds, **Then** the store's credit balance is topped up by the tier allocation **And** a credit transaction is logged.

4. **Given** a webhook for payment failure, **When** subscription payment fails, **Then** the store is notified and given a grace period before credits are paused.

## Tasks / Subtasks

> All tasks are on hold pending payment provider decision.

- [ ] Task 1: Install payment provider SDK (AC: #1, #2)
  - [ ] 1.1 Add payment provider package to `packages/api` dependencies.
  - [ ] 1.2 Create `packages/api/src/services/payment.ts` — configure payment client. Export helper functions for checkout session creation.
  - [ ] 1.3 Define subscription tiers as constants: `{ starter: { price: 4900, credits: 350 }, growth: { price: 9900, credits: 800 }, scale: { price: 19900, credits: 1800 } }`.

- [ ] Task 2: Create billing page UI (AC: #1, #2)
  - [ ] 2.1 Create `apps/next/app/merchant/billing/page.tsx` — pricing cards for subscription tiers + PAYG option.
  - [ ] 2.2 Create tRPC endpoint `merchant.createCheckoutSession` — creates checkout session (subscription or one-time).
  - [ ] 2.3 Redirect to payment checkout on plan selection.

- [ ] Task 3: Create payment webhook handler (AC: #3, #4)
  - [ ] 3.1 Create webhook route — verify payment provider webhook signature.
  - [ ] 3.2 Handle checkout completed: add credits to `store_credits`, update `stores.subscription_tier` and `subscription_id`.
  - [ ] 3.3 Handle renewal: top up credits by tier allocation.
  - [ ] 3.4 Handle payment failure: log warning, record analytics event for alerting.

- [ ] Task 4: Write tests (AC: #1-4)
  - [ ] 4.1 Test checkout session creation for each tier and PAYG.
  - [ ] 4.2 Test webhook signature verification (valid and invalid).
  - [ ] 4.3 Test payment failure handling via analytics event logging.

## Dev Notes

### Architecture Requirements

- **ADR-5**: Merchant billing on WearOn platform (not Shopify Billing API). Payment provider TBD.
- Plugin listed as free on Shopify App Store (size rec is genuinely free).

### Dependencies

- Story 2.3: Merchant billing page route.
- Story 3.1: B2B credit operations (`deductStoreCredit`, `refundStoreCredit`).

### References

- [Source: architecture.md#ADR-5] — Free Connector App Pattern
- [Source: architecture.md#Cross-Cutting Concerns] — Dual Billing

### Database Types

- Use generated Supabase types from `packages/api/src/types/database.ts` for all database operations where applicable.
- Regenerate types after any migration: `npx supabase gen types typescript --project-id ljilupbgmrizblkzokfa > packages/api/src/types/database.ts`

### Workflow

- **Commit code after story completion.** Each completed story should be committed as a standalone commit before moving to the next story.

## Dev Agent Record

### Agent Model Used

(to be filled by dev agent — previous Stripe implementation removed)

### Debug Log References

### Completion Notes List

### Change Log

- 2026-02-12: Previously implemented with Stripe — all Stripe code removed, payment provider now TBD

### File List
