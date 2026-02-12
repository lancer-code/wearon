# Story 4.1: B2B Generation REST API Endpoints

Status: ready-for-dev

## Story

As a **shopper on a merchant store**,
I want **to request a virtual try-on through the store's plugin**,
so that **I can see how an outfit looks on me before purchasing**.

## Acceptance Criteria

1. **Given** the endpoint `POST /api/v1/generation/create`, **When** a valid request is received with `image_urls`, `prompt`, and valid API key, **Then** 1 credit is deducted from the store's balance via `deduct_store_credits()` **And** a `store_generation_sessions` record is created with status `queued` **And** a task is pushed to the Redis queue with `channel: "b2b"`, `store_id`, and `session_id` **And** the response returns `{ data: { session_id, status: "queued" }, error: null }` with HTTP 201.

2. **Given** the endpoint `GET /api/v1/generation/{id}`, **When** a valid session ID is queried with valid API key, **Then** the session status, result URL (if completed), and error message (if failed) are returned **And** the response is scoped to the requesting store's `store_id` (no cross-tenant access).

3. **Given** B2B storage paths, **When** images are uploaded for B2B generation, **Then** they are stored under `stores/{store_id}/uploads/` and `stores/{store_id}/generated/`.

4. **Given** existing B2C try-on (FR18, FR19), **When** B2C users request try-ons via the mobile app, **Then** these continue to work through existing tRPC endpoints and B2C storage paths.

## Tasks / Subtasks

- [ ] Task 1: Implement POST /api/v1/generation/create (AC: #1)
  - [ ] 1.1 Replace placeholder in `apps/next/app/api/v1/generation/create/route.ts`. Use `withB2BAuth`.
  - [ ] 1.2 Validate input: `image_urls` (array of signed URLs), `prompt` (optional, default system prompt).
  - [ ] 1.3 Deduct 1 credit via `deductStoreCredit(context.storeId, context.requestId, 'B2B generation')`.
  - [ ] 1.4 Create `store_generation_sessions` record with `{ store_id, status: 'queued', image_urls, prompt, request_id }`.
  - [ ] 1.5 Build `GenerationTaskPayload` with `channel: 'b2b'`, `storeId`, push to Redis via `pushGenerationTask()`.
  - [ ] 1.6 On queue failure: refund credit, mark session failed, return 503.
  - [ ] 1.7 Return 201: `{ data: { session_id, status: 'queued' }, error: null }`.

- [ ] Task 2: Implement GET /api/v1/generation/[id] (AC: #2)
  - [ ] 2.1 Replace placeholder in `apps/next/app/api/v1/generation/[id]/route.ts`. Use `withB2BAuth`.
  - [ ] 2.2 Query `store_generation_sessions` WHERE `id = sessionId AND store_id = context.storeId`.
  - [ ] 2.3 Return session data with snake_case keys. Include `generated_image_url` for completed, `error_message` for failed.
  - [ ] 2.4 Return 404 if session not found or belongs to different store.

- [ ] Task 3: B2B storage paths (AC: #3)
  - [ ] 3.1 Create storage helper in `packages/api/src/services/b2b-storage.ts` — path prefix: `stores/{store_id}/uploads/` and `stores/{store_id}/generated/`.
  - [ ] 3.2 Generate presigned upload URLs scoped to store's storage path.

- [ ] Task 4: Write tests (AC: #1-4)
  - [ ] 4.1 Test generation create deducts credit, creates session, pushes to queue.
  - [ ] 4.2 Test session query is scoped to store_id (no cross-tenant access).
  - [ ] 4.3 Test queue failure triggers refund.
  - [ ] 4.4 Verify B2C generation endpoints unchanged.

## Dev Notes

### Architecture Requirements

- **ADR-4**: Shared generation pipeline. B2B tasks have `channel: 'b2b'` in Redis payload. [Source: architecture.md#ADR-4]
- **ADR-2**: Full separation — use `store_generation_sessions` (not `generation_sessions`). [Source: architecture.md#ADR-2]
- **FP-2**: Enforce `store_id` in all WHERE clauses. Never allow cross-tenant access.

### Dependencies

- Story 1.1: `store_generation_sessions` table.
- Story 1.3: `pushGenerationTask()`, `GenerationTaskPayload`.
- Story 2.1: `withB2BAuth`, response utilities.
- Story 3.1: `deductStoreCredit()`, `refundStoreCredit()`.

### Cross-Tenant Security

Every query MUST include `store_id = context.storeId`. The middleware provides `context.storeId` from API key authentication. Never trust client-provided store IDs.

### References

- [Source: architecture.md#ADR-4] — Shared generation pipeline
- [Source: architecture.md#ADR-2] — Full data separation
- [Source: architecture.md#API & Communication Patterns] — Endpoint definitions
- [Source: architecture.md#Communication Patterns] — Redis task payload contract

## Dev Agent Record

### Agent Model Used

(to be filled by dev agent)

### Debug Log References

### Completion Notes List

### File List
