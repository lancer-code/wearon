# Story 2.4: Store Uninstall & Data Cleanup

Status: review

## Story

As a **platform operator**,
I want **all store data cleaned up when a plugin is uninstalled**,
so that **no orphaned data remains and privacy requirements are met**.

## Acceptance Criteria

1. **Given** the webhook endpoint at `/api/v1/webhooks/shopify/app`, **When** Shopify sends an `app/uninstalled` webhook, **Then** the webhook payload is verified with HMAC-SHA256 signature **And** the store's API keys are revoked (deleted from `store_api_keys`) **And** the store is marked as `inactive` in the `stores` table **And** any queued generation jobs for the store are cancelled.

2. **Given** an uninstall webhook is processed, **When** the cleanup completes, **Then** it finishes within 60 seconds (NFR34) **And** store files in Supabase Storage at `stores/{store_id}/` are scheduled for deletion.

## Tasks / Subtasks

- [x] Task 1: Implement webhook endpoint (AC: #1)
  - [x] 1.1 Replace placeholder in `apps/next/app/api/v1/webhooks/shopify/app/route.ts` with functional handler.
  - [x] 1.2 Create `packages/api/src/utils/shopify-hmac.ts` — export `verifyShopifyHmac(request: Request, secret: string): Promise<boolean>`. Verify HMAC-SHA256 using `X-Shopify-Hmac-Sha256` header against raw body.
  - [x] 1.3 Parse webhook topic from `X-Shopify-Topic` header. Handle `app/uninstalled`.

- [x] Task 2: Store cleanup logic (AC: #1, #2)
  - [x] 2.1 Create `packages/api/src/services/store-cleanup.ts` — export `cleanupStore(storeId: string, requestId: string): Promise<CleanupResult>`.
  - [x] 2.2 Delete all `store_api_keys` for the store (CASCADE should handle this, but explicit for clarity).
  - [x] 2.3 Update `stores.status` to `'inactive'`.
  - [x] 2.4 Cancel queued generation jobs: query `store_generation_sessions` where `store_id = storeId AND status = 'queued'`, update to `'failed'` with message "Store uninstalled".
  - [x] 2.5 Schedule storage cleanup: list and delete files under `stores/{store_id}/` in Supabase Storage.
  - [x] 2.6 Log all cleanup actions with `request_id` via pino logger.

- [x] Task 3: Write tests (AC: #1-2)
  - [x] 3.1 Test HMAC verification accepts valid signatures and rejects invalid ones.
  - [x] 3.2 Test cleanup marks store inactive, deletes API keys, cancels queued jobs.
  - [x] 3.3 Test cleanup completes within timing budget (all tests complete in <100ms).

## Dev Notes

### Architecture Requirements

- **NFR34**: Uninstall cleanup within 60 seconds.
- **Webhook verification**: HMAC-SHA256 with Shopify app secret. [Source: architecture.md#Resilience]
- Shopify retries webhooks up to 19 times over 48 hours — must be idempotent.

### Dependencies

- Story 1.1: B2B tables (stores, store_api_keys, store_generation_sessions)
- Story 1.2: pino logger, request-id
- Story 2.1: Route structure (placeholder route exists)
- Story 2.2: Shopify service, `SHOPIFY_API_SECRET` env var

### Idempotency

- Check store status before cleanup. If already `inactive`, return success without re-processing.
- Use `request_id` from X-Request-Id header for tracing.

### References

- [Source: architecture.md#Resilience] — Webhook reliability, HMAC-SHA256
- [Source: architecture.md#API & Communication Patterns] — /api/v1/webhooks/shopify/app endpoint
- [Source: project-context.md#Security Rules] — HMAC verification
- [Source: project-context.md#Critical Don't-Miss Rules] — Shopify webhook verification

### Database Types

- Use generated Supabase types from `packages/api/src/types/database.ts` for all database operations where applicable.
- Regenerate types after any migration: `npx supabase gen types typescript --project-id ljilupbgmrizblkzokfa > packages/api/src/types/database.ts`

### Workflow

- **Commit code after story completion.** Each completed story should be committed as a standalone commit before moving to the next story.

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- All 8 new tests pass (4 HMAC verification, 4 store cleanup)
- 120/122 total tests pass; 3 pre-existing failures (b2b-schema env vars, Next.js build/dev tests)

### Completion Notes List

- Created `packages/api/src/utils/shopify-hmac.ts` with HMAC-SHA256 verification using `crypto.timingSafeEqual` for timing-attack resistance
- Created `packages/api/src/services/store-cleanup.ts` with idempotent `cleanupStore()` — checks store status before cleanup, returns early if already inactive
- Replaced placeholder webhook route at `/api/v1/webhooks/shopify/app/route.ts` with full handler: HMAC verification, topic parsing, store lookup by domain, cleanup execution
- Cleanup operations: mark store inactive, delete API keys, cancel queued generation jobs (mark as 'failed'), delete storage files under `stores/{store_id}/`
- All cleanup actions logged with `request_id` via pino `createChildLogger`
- Idempotent design: safe for Shopify's 19-retry webhook behavior
- Both acceptance criteria satisfied

### Change Log

- 2026-02-12: Implemented Story 2.4 — Store uninstall webhook, HMAC verification, store cleanup service

### File List

New files:
- packages/api/src/utils/shopify-hmac.ts
- packages/api/src/services/store-cleanup.ts
- packages/api/__tests__/utils/shopify-hmac.test.ts
- packages/api/__tests__/services/store-cleanup.test.ts

Modified files:
- apps/next/app/api/v1/webhooks/shopify/app/route.ts (replaced placeholder with functional handler)
