# Story 5.1: Size Rec Proxy API Endpoint

Status: review

## Story

As a **shopper**,
I want **to get an instant size recommendation from the store's plugin**,
so that **I can order the right size and avoid returns**.

## Acceptance Criteria

1. **Given** the endpoint `/api/v1/size-rec`, **When** a valid request is received with `image_url` and `height_cm`, **Then** the request is proxied to the FastAPI `/estimate-body` endpoint on the Python worker **And** the size recommendation is returned in <1s (NFR2).

2. **Given** the proxy endpoint, **When** the FastAPI worker is unreachable or times out (5s limit), **Then** a `503 Service Unavailable` response is returned: "Size recommendation temporarily unavailable" **And** the error does not affect generation pipeline availability (NFR32 — graceful degradation).

3. **Given** size rec is requested, **When** the response is returned, **Then** no credits are deducted (size rec is free, zero cost).

## Tasks / Subtasks

- [x] Task 1: Implement POST /api/v1/size-rec (AC: #1, #3)
  - [x] 1.1 Create route at `apps/next/app/api/v1/size-rec/route.ts`.
  - [x] 1.2 Use `withB2BAuth` middleware (API key required to prevent abuse).
  - [x] 1.3 Validate input with Zod: `image_url` (string URL, required), `height_cm` (number, required, 100-250 range).
  - [x] 1.4 Proxy request to FastAPI worker endpoint `POST /estimate-body` using axios with 5s timeout.
  - [x] 1.5 Transform FastAPI response to B2B response format: `{ data: { recommended_size, measurements, confidence, body_type }, error: null }`.
  - [x] 1.6 No credit deduction — size rec is always free.

- [x] Task 2: Graceful degradation on worker failure (AC: #2)
  - [x] 2.1 Catch axios timeout (5s) and connection errors.
  - [x] 2.2 Return 503: `{ data: null, error: { code: "SERVICE_UNAVAILABLE", message: "Size recommendation temporarily unavailable" } }`.
  - [x] 2.3 Log error with `request_id` and worker URL (never log image URLs with signatures).

- [x] Task 3: Write tests (AC: #1-3)
  - [x] 3.1 Test valid request proxies to FastAPI and returns size recommendation.
  - [x] 3.2 Test worker timeout returns 503 without affecting other endpoints.
  - [x] 3.3 Test no credit deduction occurs for size rec requests.
  - [x] 3.4 Test input validation rejects invalid height_cm values.

## Dev Notes

### Architecture Requirements

- **FP-1**: Size rec runs on Python worker via FastAPI HTTP endpoint. Model loads once on startup, stays warm. [Source: architecture.md#FP-1]
- **NFR2**: Size rec response <1s (real-time). 5s timeout is the maximum allowed before failing.
- **NFR32**: Size rec independent of generation — partial degradation only. If worker is down, generation may still work (different path).
- **BR1**: Size rec is the retention moat — free, zero cost to serve. Never charge credits for it.

### Dependencies

- Story 2.1: `withB2BAuth` middleware, B2B response utilities.
- Story 5.4: FastAPI `/estimate-body` endpoint on wearon-worker (can be developed in parallel — mock the endpoint for testing).

### Worker Communication

- Use axios (never fetch) to proxy to FastAPI worker.
- Worker URL from environment variable: `WORKER_API_URL` (e.g., `https://wearon-worker.ondigitalocean.app`).
- Request body to FastAPI: `{ "image_url": "...", "height_cm": 175 }` (snake_case — Python native).
- FastAPI response: `{ "recommended_size": "M", "measurements": { "chest_cm": 96, ... }, "confidence": 0.85, "body_type": "athletic" }`.

### References

- [Source: architecture.md#FP-1] — Size Rec on Python Worker
- [Source: architecture.md#API & Communication Patterns] — /api/v1/size-rec proxy
- [Source: architecture.md#Resilience & Failure Handling] — Size Rec Proxy failure handling
- [Source: epics.md#Epic 5] — Size Recommendation stories

### Database Types

- Use generated Supabase types from `packages/api/src/types/database.ts` for all database operations where applicable.
- Regenerate types after any migration: `npx supabase gen types typescript --project-id ljilupbgmrizblkzokfa > packages/api/src/types/database.ts`

### Workflow

- **Commit code after story completion.** Each completed story should be committed as a standalone commit before moving to the next story.

## Dev Agent Record

### Agent Model Used

Codex (GPT-5)

### Debug Log References

- Red phase: added `apps/next/__tests__/size-rec.route.test.ts` and confirmed initial failure from placeholder/incorrect route import path
- Green phase: implemented full proxy endpoint with `withB2BAuth`, Zod validation, axios timeout, worker response normalization, and graceful 503 handling
- Validation: `node ./node_modules/vitest/vitest.mjs run apps/next/__tests__/size-rec.route.test.ts` passed (`4/4`)
- Regression: `yarn test` shows no new regressions from this story; remaining failures are existing infra/env-dependent tests (`packages/api/__tests__/migrations/b2b-schema.test.ts`, `apps/next/__tests__/build.test.ts`, `apps/next/__tests__/dev.test.ts`)
- Lint/format: `yarn biome format --write ...` and `yarn biome check ...` passed for touched Story 5.1 files

### Implementation Plan

- Replace `/api/v1/size-rec` placeholder with production proxy behavior
- Validate request contract with Zod before proxying
- Proxy to worker `POST /estimate-body` with strict 5s timeout and request-id forwarding
- Keep B2B envelope format and snake_case response fields
- Return graceful 503 on worker timeout/unreachable states without touching credit flows
### Completion Notes List

- Implemented `handleSizeRecPost` and exported `POST = withB2BAuth(handleSizeRecPost)` in `apps/next/app/api/v1/size-rec/route.ts`
- Added strict Zod input validation:
  - `image_url`: required valid URL
  - `height_cm`: required number between 100 and 250
- Added worker URL resolution from `WORKER_API_URL` and proxy call to `${WORKER_API_URL}/estimate-body` using axios with:
  - timeout `5000`
  - `X-Request-Id` header propagation
- Added worker response validation and conversion to existing B2B response envelope via `successResponse(...)`
- Added graceful degradation:
  - timeout/connection/5xx worker failures map to `503 SERVICE_UNAVAILABLE` with message `"Size recommendation temporarily unavailable"`
  - structured error logging includes worker URL and error metadata only (no image URL logging)
- Confirmed no credit mutation path exists in this endpoint (size rec remains free)
- Added Story-specific tests covering valid proxy, timeout handling, no-credit-deduction behavior, and height validation failures
### File List

- `apps/next/app/api/v1/size-rec/route.ts` (modified)
- `apps/next/__tests__/size-rec.route.test.ts` (created)

### Change Log

| Change | Reason |
|--------|--------|
| Replaced placeholder `/api/v1/size-rec` route with worker proxy implementation | Deliver AC #1 and AC #3 with production behavior |
| Added explicit 5s timeout + graceful 503 mapping and sanitized logging | Deliver AC #2 and resilience requirement NFR32 |
| Added route-level test suite for proxy/validation/free-size-rec guarantees | Prevent regressions and prove AC #1-#3 coverage |
