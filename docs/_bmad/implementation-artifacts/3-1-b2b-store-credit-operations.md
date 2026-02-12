# Story 3.1: B2B Store Credit Operations

Status: ready-for-dev

## Story

As a **platform operator**,
I want **atomic credit deduction and refund operations for B2B stores**,
so that **store credit balances are always accurate and generation costs are tracked**.

## Acceptance Criteria

1. **Given** the `deduct_store_credits()` Supabase RPC function, **When** a B2B generation is requested via `/api/v1/generation/create`, **Then** exactly 1 credit is atomically deducted from `store_credits` **And** a `store_credit_transactions` record is logged with `request_id`, `type: deduction`, and `amount: 1`.

2. **Given** the `refund_store_credits()` Supabase RPC function, **When** a B2B generation fails (moderation block or processing error), **Then** the credit is atomically refunded to `store_credits` **And** a `store_credit_transactions` record is logged with `type: refund`.

3. **Given** the `/api/v1/credits/balance` endpoint, **When** a store queries its credit balance via valid API key, **Then** the current balance, total purchased, and total spent are returned in `snake_case` JSON.

4. **Given** a store has 0 credits, **When** a generation is requested, **Then** a `402` response is returned with `{ data: null, error: { code: "INSUFFICIENT_CREDITS", message: "..." } }`.

5. **Given** existing B2C credit operations (FR14, FR15), **When** B2C users purchase credits or receive free starter credits, **Then** these continue to work unchanged through existing tRPC endpoints.

## Tasks / Subtasks

- [ ] Task 1: Implement /api/v1/credits/balance endpoint (AC: #3)
  - [ ] 1.1 Replace placeholder in `apps/next/app/api/v1/credits/balance/route.ts` with functional GET handler using `withB2BAuth`.
  - [ ] 1.2 Query `store_credits` WHERE `store_id = context.storeId`. Return `{ data: { balance, total_purchased, total_spent }, error: null }`.
  - [ ] 1.3 Use `toSnakeCase()` for response data. Include rate limit headers from middleware.

- [ ] Task 2: Create B2B credit service (AC: #1, #2, #4)
  - [ ] 2.1 Create `packages/api/src/services/b2b-credits.ts` — export `deductStoreCredit(storeId: string, requestId: string, description: string): Promise<boolean>`. Calls `deduct_store_credits` RPC (from Story 1.1 migration).
  - [ ] 2.2 Export `refundStoreCredit(storeId: string, requestId: string, description: string): Promise<void>`. Calls `refund_store_credits` RPC.
  - [ ] 2.3 Export `getStoreBalance(storeId: string): Promise<{ balance: number, totalPurchased: number, totalSpent: number }>`.
  - [ ] 2.4 All functions use Supabase service role client (singleton from Story 2.1 pattern).

- [ ] Task 3: Write tests (AC: #1-5)
  - [ ] 3.1 Test credit deduction creates transaction record with request_id.
  - [ ] 3.2 Test refund operation restores balance.
  - [ ] 3.3 Test balance endpoint returns snake_case JSON.
  - [ ] 3.4 Test 0 balance returns 402.
  - [ ] 3.5 Verify B2C credit endpoints remain unchanged.

## Dev Notes

### Architecture Requirements

- **Always atomic**: Use Supabase RPC functions. NEVER raw UPDATE on credit tables. [Source: project-context.md#Credit Operations]
- **API deducts before queueing** (never worker). Worker refunds on failure only.
- Log every credit operation with `request_id`. [Source: architecture.md#Process Patterns]

### Dependencies

- Story 1.1: `store_credits`, `store_credit_transactions` tables, `deduct_store_credits()` and `refund_store_credits()` RPC functions.
- Story 2.1: `withB2BAuth` middleware, `B2BContext`, response utilities.

### Existing B2C Pattern

Existing B2C credit operations in `packages/api/src/routers/credits.ts` use `deduct_credits` RPC. Follow same atomic pattern for B2B.

### References

- [Source: architecture.md#Process Patterns] — Credit operations
- [Source: project-context.md#Credit Operations] — Always atomic, API deducts, worker refunds
- [Source: packages/api/src/routers/credits.ts] — Existing B2C credit pattern

## Dev Agent Record

### Agent Model Used

(to be filled by dev agent)

### Debug Log References

### Completion Notes List

### File List
