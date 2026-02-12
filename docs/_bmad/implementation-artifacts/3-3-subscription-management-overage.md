# Story 3.3: Subscription Management & Overage

Status: ready-for-dev

## Story

As a **store owner**,
I want **to upgrade, downgrade my plan, and have overage handled automatically**,
so that **my store never runs out of credits unexpectedly**.

## Acceptance Criteria

1. **Given** a store on a subscription plan, **When** the owner requests an upgrade (e.g., Starter → Growth), **Then** the change is processed via Stripe with prorated billing **And** the `stores.subscription_tier` is updated **And** additional credits from the new tier are added immediately.

2. **Given** a store on a subscription plan, **When** the owner requests a downgrade, **Then** the change takes effect at the next billing cycle **And** existing credits remain usable.

3. **Given** a store that has exhausted its subscription credits, **When** a generation is requested, **Then** the overage rate for the tier is applied (e.g., $0.16/credit for Starter) **And** the overage charge is tracked in `store_credit_transactions` **And** the generation proceeds normally.

## Tasks / Subtasks

- [ ] Task 1: Implement plan upgrade/downgrade (AC: #1, #2)
  - [ ] 1.1 Create tRPC endpoint `merchant.changePlan` — accepts target tier, calls Stripe API to modify subscription.
  - [ ] 1.2 For upgrades: use `proration_behavior: 'always_invoice'` in Stripe. Add delta credits immediately.
  - [ ] 1.3 For downgrades: use `proration_behavior: 'none'`, schedule change at period end.
  - [ ] 1.4 Update `stores.subscription_tier` on successful change.

- [ ] Task 2: Implement overage billing (AC: #3)
  - [ ] 2.1 Define overage rates per tier: `{ starter: 16, growth: 14, scale: 12 }` (cents per credit).
  - [ ] 2.2 In B2B generation flow, when `store_credits.balance <= 0` AND store has active subscription: create Stripe usage record instead of rejecting.
  - [ ] 2.3 Log overage in `store_credit_transactions` with `type: 'overage'`.
  - [ ] 2.4 Track overage usage on Stripe metered billing component.

- [ ] Task 3: Billing page UI updates (AC: #1, #2, #3)
  - [ ] 3.1 Show current plan with upgrade/downgrade buttons.
  - [ ] 3.2 Show overage usage and charges for current billing period.

- [ ] Task 4: Write tests (AC: #1-3)
  - [ ] 4.1 Test upgrade adds credits immediately.
  - [ ] 4.2 Test downgrade schedules at period end.
  - [ ] 4.3 Test overage allows generation and tracks usage.

## Dev Notes

### Dependencies

- Story 3.2: Stripe integration, subscription creation.
- Story 3.1: Credit operations.

### Overage Design

- Overage only applies to stores with active subscriptions. PAYG-only stores get 402 when balance is 0.
- Stripe metered billing component attached to subscription for overage tracking.

### References

- [Source: architecture.md#ADR-5] — Billing model
- [Source: epics.md#Story 3.3] — Overage rates per tier

## Dev Agent Record

### Agent Model Used

(to be filled by dev agent)

### Debug Log References

### Completion Notes List

### File List
