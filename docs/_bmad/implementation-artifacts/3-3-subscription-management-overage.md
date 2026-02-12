# Story 3.3: Subscription Management & Overage

Status: in-progress

## Story

As a **store owner**,
I want **to upgrade, downgrade my plan, and have overage handled automatically**,
so that **my store never runs out of credits unexpectedly**.

## Acceptance Criteria

1. **Given** a store on a subscription plan, **When** the owner requests an upgrade (e.g., Starter -> Growth), **Then** the change is processed through Paddle with proration **And** `stores.subscription_tier` is updated **And** upgrade delta credits are added immediately.

2. **Given** a store on a subscription plan, **When** the owner requests a downgrade, **Then** the change is scheduled for next billing period.

3. **Given** a store that has exhausted subscription credits, **When** a generation is requested, **Then** overage billing is attempted through Paddle **And** an `overage` transaction is logged in `store_credit_transactions` **And** generation proceeds when charge succeeds.

## Tasks / Subtasks

- [x] Task 1: Implement plan upgrade/downgrade (AC: #1, #2)
  - [x] 1.1 Add `merchant.changePlan` endpoint.
  - [x] 1.2 Upgrades: apply immediately with proration and grant delta credits.
  - [x] 1.3 Downgrades: schedule for next billing period.
  - [x] 1.4 Update store subscription state for immediate upgrades.

- [x] Task 2: Implement overage billing (AC: #3)
  - [x] 2.1 Define tier overage rates: starter 16, growth 14, scale 12 (cents/credit).
  - [x] 2.2 In B2B generation flow, if balance is zero and subscription is active, trigger Paddle overage charge.
  - [x] 2.3 Log overage in `store_credit_transactions` (`type: overage`).
  - [x] 2.4 Keep 402 behavior for non-subscribed stores with zero credits.

- [ ] Task 3: Billing page UI updates (AC: #1, #2, #3)
  - [x] 3.1 Show current plan with upgrade/downgrade actions.
  - [x] 3.2 Show overage rates per plan.
  - [ ] 3.3 Add dedicated overage usage history table to billing page.

- [ ] Task 4: Extended test coverage (AC: #1-3)
  - [ ] 4.1 Automated plan upgrade/downgrade route tests.
  - [ ] 4.2 Automated overage happy-path tests.
  - [ ] 4.3 Automated overage failure compensation tests.

### Review Follow-ups (AI)

- [ ] [AI-Review][HIGH] Story File List cannot be verified against current git working tree (no uncommitted/staged evidence for listed files); validate against commit/PR history before marking done. [docs/_bmad/implementation-artifacts/3-3-subscription-management-overage.md:73]
- [ ] [AI-Review][MEDIUM] Current workspace has undocumented changes outside this story (`packages/api/package.json`, `packages/api/src/services/b2b-credits.ts`, `packages/api/src/services/paddle.ts`, `supabase/migrations/008_paddle_billing_schema.sql`) and traceability is incomplete for this story review. [docs/_bmad/implementation-artifacts/3-3-subscription-management-overage.md:73]
- [ ] [AI-Review][LOW] Dev Agent Record is missing immutable traceability for independent verification (commit SHA/PR link and exact test command output). [docs/_bmad/implementation-artifacts/3-3-subscription-management-overage.md:73]
- [ ] [AI-Review][MEDIUM] Overage and billing logic depends on schema additions from migration 008 (`subscription_status`, `add_store_credits`) and can fail if migration ordering is not enforced. [packages/api/src/services/b2b-credits.ts:109]
## Dev Notes

### Dependencies

- Story 3.2: Paddle checkout + webhook foundation.
- Story 3.1: Credit RPC operations.

### Overage Design

- Overage only applies when store has active/trialing subscription metadata.
- Non-subscribed stores still receive 402 on empty balance.
- Overage charge ID is logged for reconciliation.

### References

- [Source: architecture.md#ADR-5] — Billing model
- [Source: epics.md#Story 3.3] — Subscription management & overage

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Completion Notes List

- Implemented `merchant.changePlan` with immediate upgrade and scheduled downgrade behavior.
- Added overage fallback path in `/api/v1/generation/create`.
- Added overage transaction logging and subscription profile lookup helpers.

### File List

**Modified:**
- `packages/api/src/routers/merchant.ts`
- `apps/next/app/api/v1/generation/create/route.ts`
- `packages/api/src/services/b2b-credits.ts`
- `packages/api/src/services/paddle.ts`
- `packages/app/features/merchant/merchant-billing.tsx`
