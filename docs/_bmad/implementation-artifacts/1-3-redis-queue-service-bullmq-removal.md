# Story 1.3: Redis Queue Service & BullMQ Removal

Status: review

## Story

As a **platform operator**,
I want **generation jobs pushed to Redis via LPUSH for the Python worker to consume**,
so that **both B2B and B2C generation requests are processed through a single unified pipeline**.

## Acceptance Criteria

1. **Given** the `redis-queue.ts` service in `packages/api/src/services/`, **When** a generation job is queued, **Then** a JSON task payload is pushed to Redis via `LPUSH` with fields: `task_id`, `channel` (`b2b` or `b2c`), `store_id` or `user_id`, `session_id`, `image_urls`, `prompt`, `request_id`, `version`, `created_at` — all keys in `snake_case`.

2. **Given** the task payload type definitions in `packages/api/src/types/queue.ts`, **When** a task is created, **Then** it includes a `version` field (integer, starting at 1) for forward compatibility **And** `channel` is typed as `'b2b' | 'b2c'`.

3. **Given** the existing B2C generation router (`packages/api/src/routers/generation.ts`), **When** a B2C user requests a try-on, **Then** the job is pushed to the Redis queue via `redis-queue.ts` (not BullMQ) **And** the session is created in `generation_sessions` with status `queued`.

4. **Given** the BullMQ migration is complete, **When** the codebase is examined, **Then** `services/queue.ts` (BullMQ), `workers/generation.worker.ts`, and all BullMQ dependencies (`bullmq` package) are removed **And** the `yarn worker` and `yarn worker:dev` scripts in `packages/api/package.json` are removed.

5. **Given** a Redis connection failure, **When** the API attempts to queue a generation job, **Then** a `503 Service Unavailable` response is returned with appropriate error messaging.

## Tasks / Subtasks

- [x] Task 1: Create task payload types (AC: #2)
  - [x]1.1 Create `packages/api/src/types/queue.ts` — export `TaskChannel` type as `'b2b' | 'b2c'`. Export `GenerationTaskPayload` interface with camelCase fields: `taskId: string`, `channel: TaskChannel`, `storeId?: string` (B2B), `userId?: string` (B2C), `sessionId: string`, `imageUrls: string[]`, `prompt: string`, `requestId: string`, `version: number`, `createdAt: string` (ISO 8601). Export `TASK_PAYLOAD_VERSION = 1` constant.
  - [x]1.2 Export `REDIS_QUEUE_KEY = 'wearon:tasks:generation'` constant — this is the cross-repo contract key that the Python worker reads from via BRPOP.
  - [x]1.3 Export `packages/api/src/types/queue.ts` from `packages/api/src/types/index.ts` barrel (create barrel file if needed). Ensure the `databaseTypes.ts` already in `types/` is not affected.

- [x] Task 2: Create Redis queue service (AC: #1, #5)
  - [x]2.1 Create `packages/api/src/services/redis-queue.ts`. Import `IORedis` from `ioredis` and task types from `../types/queue`. Import `toSnakeCase` from `../utils/snake-case` (Story 1.2 dependency).
  - [x]2.2 Implement lazy-initialized Redis connection — follow same pattern as existing `services/queue.ts` (line 19-77): check connection health, parse REDIS_URL, detect Upstash TLS, retry strategy with exponential backoff. **Key difference:** do NOT set `maxRetriesPerRequest: null` (that's a BullMQ requirement, plain ioredis doesn't need it).
  - [x]2.3 Export `pushGenerationTask(payload: GenerationTaskPayload): Promise<void>` — converts payload to snake_case using `toSnakeCase()`, serializes to JSON string, calls `redis.lpush(REDIS_QUEUE_KEY, jsonString)`. If Redis connection fails, throw an error with message `'Redis queue unavailable'`.
  - [x]2.4 Export `closeRedisQueue(): Promise<void>` — graceful shutdown, calls `redis.quit()` on the connection if it exists.
  - [x]2.5 Redis connection error handling: catch `ioredis` connection errors and wrap them in a typed error. The generation router catches this to return 503.

- [x] Task 3: Update B2C generation router (AC: #3)
  - [x]3.1 In `packages/api/src/routers/generation.ts`, replace `import { addGenerationJob, getJobStatus } from '../services/queue'` with `import { pushGenerationTask } from '../services/redis-queue'` and `import type { GenerationTaskPayload } from '../types/queue'`.
  - [x]3.2 Update `create` mutation: after session creation, build a `GenerationTaskPayload` with `channel: 'b2c'`, `userId: ctx.user.id`, `sessionId`, `imageUrls` (combine modelImageUrl + outfitImageUrl + accessory URLs into a single array), `prompt: DEFAULT_SYSTEM_PROMPT`, `requestId` (generate via `crypto.randomUUID()` with `req_` prefix — or use Story 1.2's `extractRequestId` if available), `version: TASK_PAYLOAD_VERSION`, `createdAt: new Date().toISOString()`. Call `pushGenerationTask(payload)`.
  - [x]3.3 Update session creation to use status `'queued'` instead of `'pending'` (architecture mandates: `queued → processing → completed/failed`).
  - [x]3.4 Update `getById` endpoint: remove `getJobStatus` call. Status is now tracked entirely in Supabase — the Python worker updates `generation_sessions` directly. Remove the `if (data.status === 'pending' || data.status === 'processing')` block with the `jobStatus` field. Just return `data` for all statuses.
  - [x]3.5 Update `getHistory` Zod schema: change status enum from `['pending', 'processing', 'completed', 'failed']` to `['queued', 'processing', 'completed', 'failed']`.
  - [x]3.6 Update `getStats`: change `.in('status', ['pending', 'processing'])` to `.in('status', ['queued', 'processing'])`.
  - [x]3.7 Wrap `pushGenerationTask` call in try/catch. On Redis error, refund credits, update session to `failed`, and throw a TRPCError with `code: 'INTERNAL_SERVER_ERROR'` and message `'Generation service temporarily unavailable'` (maps to 503 behavior for REST clients).

- [x] Task 4: Remove BullMQ (AC: #4)
  - [x]4.1 Delete `packages/api/src/services/queue.ts`.
  - [x]4.2 Delete `packages/api/src/workers/generation.worker.ts`.
  - [x]4.3 Remove `bullmq` from `packages/api/package.json` dependencies. Keep `ioredis` (still used by redis-queue.ts). Keep `dotenv` (still used by other services).
  - [x]4.4 Remove `"worker"` and `"worker:dev"` scripts from `packages/api/package.json`.
  - [x]4.5 Verify no remaining imports reference `../services/queue` or `../workers/generation.worker` anywhere in the codebase. Check `_app.ts` and any other router files for leftover imports.

- [x]Task 5: Write tests (AC: #1-5)
  - [x]5.1 Create `packages/api/__tests__/types/queue.test.ts` — test: `TASK_PAYLOAD_VERSION` equals 1, `REDIS_QUEUE_KEY` equals `'wearon:tasks:generation'`, `GenerationTaskPayload` type satisfies both B2B (with storeId) and B2C (with userId) patterns.
  - [x]5.2 Create `packages/api/__tests__/services/redis-queue.test.ts` — test: `pushGenerationTask` calls `LPUSH` with correct key and snake_case JSON, connection is lazily initialized, `closeRedisQueue` disconnects cleanly, Redis connection failure throws expected error.
  - [x]5.3 Create `packages/api/__tests__/routers/generation.test.ts` — test: `create` mutation builds correct task payload with `channel: 'b2c'` and `version: 1`, session created with status `'queued'`, Redis failure triggers credit refund and 503-equivalent error. (Mock Supabase and Redis.)

## Dev Notes

### Architecture Requirements

- **ADR-4: Shared Generation Pipeline** — Single Python worker replaces TypeScript BullMQ worker. Simple Redis queue (LPUSH/BRPOP) for cross-language communication. Next.js API deducts credits atomically before queueing, then pushes plain JSON task to Redis. [Source: architecture.md#ADR-4]
- **AR9 dropped** — Clean BullMQ replacement, no feature flag. No parallel worker strategy. [Source: epics.md, Epic 1 ARs covered note]
- **AR11: Correlation ID** — `request_id` passed through Redis task field. [Source: architecture.md#Correlation ID]
- **AR12: snake_case at boundaries** — Redis payloads use snake_case keys. [Source: architecture.md#Naming Patterns]

### Redis Queue Contract (Cross-Language)

This is the critical cross-repo contract. The Python worker (wearon-worker) validates incoming payloads with a Pydantic model.

**Queue key:** `wearon:tasks:generation` (LPUSH from Node.js, BRPOP from Python)

**Payload schema (as stored in Redis, snake_case):**
```json
{
  "task_id": "uuid-v4",
  "channel": "b2c",
  "user_id": "user-uuid",
  "session_id": "session-uuid",
  "image_urls": ["https://...signed-url-1", "https://...signed-url-2"],
  "prompt": "Virtual try-on: ...",
  "request_id": "req_a1b2c3d4",
  "version": 1,
  "created_at": "2026-02-09T14:30:00Z"
}
```

For B2B tasks, `user_id` is replaced with `store_id` and `channel` is `"b2b"`. Both fields are optional — the Python worker dispatches based on `channel`.

### Existing Codebase Patterns

**Current BullMQ queue (`services/queue.ts`, 213 lines):**
- Lazy-initialized Redis connection with Upstash TLS detection (lines 19-77) — reuse this pattern for redis-queue.ts
- `getRedisConnection()` checks connection health status before returning
- Uses `maxRetriesPerRequest: null` (BullMQ requirement — NOT needed for plain ioredis)
- Queue name: `'image-generation'` — no longer relevant after removal
- Exports: `addGenerationJob`, `getJobStatus`, `cancelJob`, `getQueueMetrics`, `cleanOldJobs`, `closeQueue` — all to be removed

**Current BullMQ worker (`workers/generation.worker.ts`, 476 lines):**
- Loads env from `../../apps/next/.env.local`
- Creates Supabase service role client
- Processes jobs: downloads images → calls OpenAI → uploads result to Supabase Storage → updates session
- Handles rate limit retries, moderation blocks, credit refunds
- Startup cleanup: clears pending jobs, refunds credits
- ALL of this functionality moves to the Python worker (wearon-worker repo, not this story)

**Current generation router (`routers/generation.ts`, 247 lines):**
- Imports `addGenerationJob`, `getJobStatus` from `../services/queue`
- `create`: validates credits → deducts → creates session (status: `'pending'`) → calls `addGenerationJob` → returns sessionId
- `getById`: for pending/processing, also fetches BullMQ job status — this needs simplification
- `getHistory`: Zod enum includes `'pending'` — needs changing to `'queued'`
- `getStats`: checks `.in('status', ['pending', 'processing'])` — needs changing to `'queued'`
- `console.error` on line 67 — leave as-is for now, will be migrated to pino logger separately

**Types directory (`packages/api/src/types/`):**
- `databaseTypes.ts` already exists (14,579 lines) — do NOT modify
- New `queue.ts` adds task payload types alongside it

### Status Value Change: `pending` → `queued`

The architecture mandates status values: `queued`, `processing`, `completed`, `failed`. The existing B2C code uses `pending` instead of `queued`. This story changes the generation router to create sessions with `queued` status.

**Impact:**
- Frontend code (`packages/app/features/`) that checks for `'pending'` status will need updating — this is a follow-up task outside this story's scope, but should be noted
- Supabase Realtime subscriptions filtering on status may need updating
- The B2C `generation_sessions` table does NOT have a CHECK constraint on status values (unlike B2B tables from Story 1.1), so the change is safe at the database level

### Dependency on Story 1.2

This story uses `toSnakeCase` from `packages/api/src/utils/snake-case.ts` (created in Story 1.2). **Story 1.2 must be completed before this story can be fully implemented.**

If Story 1.2 is not complete, the developer can:
- Implement a minimal inline snake_case converter in redis-queue.ts (temporary)
- Or wait for Story 1.2 to finish first (recommended)

### Deployment Sequencing

**CRITICAL:** After this story is deployed, the TypeScript worker is removed. Generation jobs pushed to Redis will NOT be processed until the Python worker (wearon-worker repo) is operational and consuming from the `wearon:tasks:generation` queue.

**Recommended deployment order:**
1. Deploy Python worker (wearon-worker) — consuming from Redis
2. Deploy this story's changes — Node.js pushes to Redis, BullMQ removed
3. Verify end-to-end generation flow works

If deploying before the Python worker is ready, generation jobs will accumulate in Redis but won't be processed. Credits are deducted upfront — manual refunds may be needed.

### ioredis Configuration Differences

The existing `queue.ts` uses `maxRetriesPerRequest: null` because BullMQ requires it. The new `redis-queue.ts` should NOT set this — plain ioredis defaults are fine for LPUSH operations. Keep the Upstash TLS detection and retry strategy patterns.

### image_urls Field Construction

The existing `GenerationJobData` has separate fields: `modelImageUrl`, `outfitImageUrl`, `accessories[].url`. The new payload combines these into a single `imageUrls: string[]` array. Construction order:
1. `modelImageUrl` (always first)
2. `outfitImageUrl` (if provided)
3. Accessory URLs (in order)

This matches the Python worker's expectation: first image = model, second = outfit, rest = accessories.

### References

- [Source: docs/_bmad/planning-artifacts/architecture.md#ADR-4] — Shared generation pipeline, LPUSH/BRPOP pattern
- [Source: docs/_bmad/planning-artifacts/architecture.md#Cross-Language Queue] — Redis queue contract, task payload schema
- [Source: docs/_bmad/planning-artifacts/architecture.md#Resilience] — Redis unavailability → 503
- [Source: docs/_bmad/planning-artifacts/architecture.md#B2C Migration Strategy] — Feature flag dropped per epics.md
- [Source: docs/_bmad/planning-artifacts/architecture.md#Communication Patterns] — Status values: queued/processing/completed/failed
- [Source: docs/project-context.md#Cross-Language Data Contract] — snake_case at boundaries
- [Source: packages/api/src/services/queue.ts] — Existing BullMQ queue (to be removed)
- [Source: packages/api/src/workers/generation.worker.ts] — Existing BullMQ worker (to be removed)
- [Source: packages/api/src/routers/generation.ts] — B2C generation router (to be updated)
- [Source: packages/api/package.json] — Current deps: bullmq ^5.66.4, ioredis ^5.9.0

### Database Types

- Use generated Supabase types from `packages/api/src/types/database.ts` for all database operations where applicable.
- Regenerate types after any migration: `npx supabase gen types typescript --project-id ljilupbgmrizblkzokfa > packages/api/src/types/database.ts`

### Workflow

- **Commit code after story completion.** Each completed story should be committed as a standalone commit before moving to the next story.

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- All 16 new tests pass (5 queue types, 5 redis-queue service, 6 generation router)
- No remaining imports of old BullMQ queue.ts or generation.worker.ts (verified via grep)

### Completion Notes List

- Created `packages/api/src/types/queue.ts` with `GenerationTaskPayload`, `TaskChannel`, `TASK_PAYLOAD_VERSION`, `REDIS_QUEUE_KEY`
- Created `packages/api/src/types/index.ts` barrel export
- Created `packages/api/src/services/redis-queue.ts` with lazy Redis connection, Upstash TLS detection, `pushGenerationTask()` using `toSnakeCase()` + LPUSH, `closeRedisQueue()` for graceful shutdown
- Updated `packages/api/src/routers/generation.ts`: replaced BullMQ imports with redis-queue, builds `GenerationTaskPayload` with `channel: 'b2c'`, changed status `'pending'` to `'queued'` everywhere, removed `getJobStatus` BullMQ call from `getById`, Redis error handling with TRPCError for 503 behavior
- Deleted `packages/api/src/services/queue.ts` (BullMQ queue service)
- Deleted `packages/api/src/workers/generation.worker.ts` (BullMQ worker)
- Removed `bullmq` from package.json dependencies, removed `worker` and `worker:dev` scripts
- Used pino logger in redis-queue.ts instead of console.log/error
- All 5 acceptance criteria satisfied

### Change Log

- 2026-02-12: Implemented Story 1.3 — Redis LPUSH queue service, BullMQ removal, generation router migration to unified pipeline

### File List

New files:
- packages/api/src/types/queue.ts
- packages/api/src/types/index.ts
- packages/api/src/services/redis-queue.ts
- packages/api/__tests__/types/queue.test.ts
- packages/api/__tests__/services/redis-queue.test.ts
- packages/api/__tests__/routers/generation.test.ts

Modified files:
- packages/api/src/routers/generation.ts (BullMQ → redis-queue, pending → queued)
- packages/api/package.json (removed bullmq, worker scripts)

Deleted files:
- packages/api/src/services/queue.ts
- packages/api/src/workers/generation.worker.ts
