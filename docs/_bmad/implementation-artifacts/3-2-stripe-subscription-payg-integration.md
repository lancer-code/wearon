# Story 3.2: Payment Integration (Subscription & PAYG)

Status: in-progress

> Historical filename retained for continuity. Implementation uses **Paddle**, not Stripe.

## Story

As a **store owner**,
I want **to subscribe to a credit plan or buy pay-as-you-go packs**,
so that **I can fund my store's try-on feature with the pricing model that fits my needs**.

## Acceptance Criteria

1. **Given** the billing page at `/merchant/billing`, **When** a store owner selects a subscription tier (Starter $49/350, Growth $99/800, Scale $199/1800), **Then** a Paddle checkout session is created **And** on successful payment webhook, `store_credits` is incremented by the tier allocation **And** the store's `subscription_tier` and `subscription_id` are stored in `stores`.

2. **Given** the billing page, **When** a store owner selects a PAYG credit pack, **Then** a Paddle checkout session is created at $0.18/credit **And** on successful payment webhook, credits are added to `store_credits`.

3. **Given** a subscription renewal webhook, **When** payment succeeds, **Then** the store's credit balance is topped up by the tier allocation **And** a credit transaction is logged.

4. **Given** a payment failure webhook, **When** subscription payment fails, **Then** the store subscription status is updated for follow-up handling.

## Tasks / Subtasks

- [x] Task 1: Install payment provider SDK (AC: #1, #2)
  - [x] 1.1 Add Paddle integration service (`packages/api/src/services/paddle.ts`) using Axios.
  - [x] 1.2 Configure checkout/session helper functions for subscription and PAYG purchases.
  - [x] 1.3 Define subscription tiers and pricing constants (Starter, Growth, Scale + PAYG).

- [x] Task 2: Create billing page UI (AC: #1, #2)
  - [x] 2.1 Create `apps/next/app/merchant/billing/page.tsx`.
  - [x] 2.2 Add `merchant.createCheckoutSession` + `merchant.getBillingCatalog`.
  - [x] 2.3 Redirect to Paddle checkout URL on plan/PAYG selection.

- [x] Task 3: Create payment webhook handler (AC: #3, #4)
  - [x] 3.1 Create `apps/next/app/api/v1/webhooks/paddle/route.ts` with signature verification.
  - [x] 3.2 Handle `transaction.completed` for subscription/PAYG crediting via atomic RPC.
  - [x] 3.3 Persist webhook idempotency records in `billing_webhook_events`.
  - [x] 3.4 Track subscription lifecycle status updates from `subscription.*` events.

- [ ] Task 4: Full integration tests (AC: #1-4)
  - [x] 4.1 Add unit tests for Paddle signature + tier helpers.
  - [ ] 4.2 Add webhook route integration tests (valid/invalid signature, duplicate events).
  - [ ] 4.3 Add end-to-end sandbox test coverage for checkout -> webhook -> credits.

### Review Follow-ups (AI)

- [ ] [AI-Review][HIGH] Story File List cannot be verified against current git working tree (no uncommitted/staged evidence for listed files); validate against commit/PR history before marking done. [docs/_bmad/implementation-artifacts/3-2-stripe-subscription-payg-integration.md:83]
- [ ] [AI-Review][MEDIUM] Current workspace has undocumented changes outside this story (`packages/api/package.json`, `packages/api/src/services/b2b-credits.ts`, `packages/api/src/services/paddle.ts`, `supabase/migrations/008_paddle_billing_schema.sql`) and traceability is incomplete for this story review. [docs/_bmad/implementation-artifacts/3-2-stripe-subscription-payg-integration.md:83]
- [ ] [AI-Review][LOW] Dev Agent Record is missing immutable traceability for independent verification (commit SHA/PR link and exact test command output). [docs/_bmad/implementation-artifacts/3-2-stripe-subscription-payg-integration.md:83]
- [ ] [AI-Review][HIGH] Paddle webhook signature verification does not enforce timestamp freshness, leaving replay risk for signed payloads. [packages/api/src/services/paddle.ts:321]
## Dev Notes

### Architecture Requirements

- Merchant billing remains on WearOn platform (`/merchant/*`) and not Shopify Billing API.
- API keys remain server-side only.
- Credit updates use atomic RPC, never raw `UPDATE` on credit tables.

### Dependencies

- Story 2.3: Merchant dashboard routes.
- Story 3.1: B2B credit operations.
- Migration 008: `add_store_credits()` and `billing_webhook_events`.

### References

- [Source: architecture.md#ADR-5] — Free Connector App Pattern
- [Source: epics.md#Story 3.2] — Payment Integration

### Workflow

- Code implemented and moved to review.
- Remaining webhook integration tests tracked under Task 4.

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Completion Notes List

- Paddle service implemented with checkout creation, plan change, overage charging, and signature verification helpers.
- Merchant billing UI implemented with subscription cards + PAYG flow.
- Paddle webhook route added with idempotency persistence and transaction/subscription handlers.
- Added migration for webhook event audit + atomic credit add RPC.

### File List

**Created:**
- `packages/api/src/services/paddle.ts`
- `apps/next/app/api/v1/webhooks/paddle/route.ts`
- `apps/next/app/merchant/billing/page.tsx`
- `packages/app/features/merchant/merchant-billing.tsx`
- `packages/api/__tests__/services/paddle.test.ts`
- `supabase/migrations/008_paddle_billing_schema.sql`

**Modified:**
- `packages/api/src/routers/merchant.ts`
- `packages/api/src/services/b2b-credits.ts`
- `apps/next/.env.example`
- `packages/app/features/merchant/index.ts`
