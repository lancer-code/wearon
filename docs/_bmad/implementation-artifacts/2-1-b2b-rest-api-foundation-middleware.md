# Story 2.1: B2B REST API Foundation & Middleware

Status: review

## Story

As a **platform operator**,
I want **a secure B2B REST API layer with API key authentication, CORS, and rate limiting**,
so that **Shopify plugins can safely communicate with the WearOn platform through versioned endpoints**.

## Acceptance Criteria

1. **Given** the Next.js app router, **When** B2B API routes are created at `/api/v1/*`, **Then** the route structure follows: `/api/v1/generation/`, `/api/v1/credits/`, `/api/v1/stores/`, `/api/v1/size-rec/`, `/api/v1/webhooks/shopify/`.

2. **Given** the `api-key-auth.ts` middleware in `packages/api/src/middleware/`, **When** a request arrives with a valid API key in the `Authorization` header, **Then** the key hash is resolved to a `store_id` via the `store_api_keys` table **And** the `store_id` is attached to the request context for all downstream queries.

3. **Given** the `api-key-auth.ts` middleware, **When** a request arrives with an invalid or missing API key, **Then** a `401 Unauthorized` response is returned with `{ data: null, error: { code: "INVALID_API_KEY", message: "..." } }`.

4. **Given** the `cors.ts` middleware, **When** a request arrives from a domain not registered to the store's API key, **Then** the request is rejected with a `403 Forbidden` response with `{ data: null, error: { code: "DOMAIN_MISMATCH", message: "..." } }`.

5. **Given** the `rate-limit.ts` middleware, **When** a store exceeds its tier rate limit (tracked via Redis INCR with TTL), **Then** a `429 Too Many Requests` response is returned with headers `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` **And** response body contains `{ data: null, error: { code: "RATE_LIMIT_EXCEEDED", message: "..." } }`.

6. **Given** any B2B REST API response, **When** the response is sent, **Then** it follows the format `{ data: {...}, error: null }` for success or `{ data: null, error: { code, message } }` for errors **And** all JSON field names use `snake_case`.

## Tasks / Subtasks

- [x] Task 1: Create B2B types (AC: #2, #6)
  - [x] 1.1 Create `packages/api/src/types/b2b.ts` — export `B2BContext` interface: `{ storeId: string, shopDomain: string, allowedDomains: string[], subscriptionTier: string | null, isActive: boolean, requestId: string }`. Export `B2BErrorCode` type union: `'INVALID_API_KEY' | 'DOMAIN_MISMATCH' | 'RATE_LIMIT_EXCEEDED' | 'INSUFFICIENT_CREDITS' | 'MODERATION_BLOCKED' | 'INTERNAL_ERROR' | 'SERVICE_UNAVAILABLE' | 'NOT_FOUND' | 'VALIDATION_ERROR'`. Export `B2BResponse<T>` type: `{ data: T | null, error: { code: B2BErrorCode, message: string } | null }`. Export `RateLimitTier` config type: `{ maxRequestsPerHour: number, maxRequestsPerMinute: number }`.
  - [x] 1.2 Export `RATE_LIMIT_TIERS` constant mapping subscription tier to limits: `{ starter: { maxRequestsPerHour: 100, maxRequestsPerMinute: 10 }, growth: { maxRequestsPerHour: 500, maxRequestsPerMinute: 30 }, scale: { maxRequestsPerHour: 2000, maxRequestsPerMinute: 100 }, enterprise: { maxRequestsPerHour: 10000, maxRequestsPerMinute: 500 }, default: { maxRequestsPerHour: 50, maxRequestsPerMinute: 5 } }`. These are configurable starting points.
  - [x] 1.3 Add `b2b.ts` export to `packages/api/src/types/index.ts` barrel (create if needed, alongside existing `databaseTypes.ts`).

- [x] Task 2: Create B2B response utility (AC: #6)
  - [x] 2.1 Create `packages/api/src/utils/b2b-response.ts` — export `successResponse<T>(data: T): NextResponse` that returns `NextResponse.json({ data: toSnakeCase(data), error: null })`. Import `toSnakeCase` from `./snake-case` (Story 1.2).
  - [x] 2.2 Export `errorResponse(code: B2BErrorCode, message: string, status: number): NextResponse` that returns `NextResponse.json({ data: null, error: { code, message } }, { status })`.
  - [x] 2.3 Export `rateLimitResponse(code: B2BErrorCode, message: string, headers: { limit: number, remaining: number, reset: number }): NextResponse` — includes `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` headers in the 429 response.
  - [x] 2.4 Export convenience functions: `unauthorizedResponse(message?: string)` (401), `forbiddenResponse(message?: string)` (403), `notFoundResponse(message?: string)` (404), `serviceUnavailableResponse(message?: string)` (503).

- [x] Task 3: Create API key authentication middleware (AC: #2, #3)
  - [x] 3.1 Create `packages/api/src/middleware/api-key-auth.ts`. Import `createClient` from `@supabase/supabase-js` (Supabase service role client for B2B — no RLS per FP-2).
  - [x] 3.2 Export `authenticateApiKey(request: Request): Promise<{ context: B2BContext } | { error: NextResponse }>`. Extract API key from `Authorization: Bearer wk_...` header. Validate format starts with `wk_` prefix.
  - [x] 3.3 Hash the API key using `crypto.createHash('sha256').update(apiKey).digest('hex')`. Look up in `store_api_keys` table: `SELECT store_api_keys.*, stores.shop_domain, stores.subscription_tier, stores.status FROM store_api_keys JOIN stores ON store_api_keys.store_id = stores.id WHERE store_api_keys.key_hash = $hash AND store_api_keys.is_active = true`.
  - [x] 3.4 Verify the joined `stores.status` is `'active'`. If store is inactive, return 401 with `INVALID_API_KEY` (don't reveal store exists).
  - [x] 3.5 Return `B2BContext` on success: `{ storeId, shopDomain, allowedDomains, subscriptionTier, isActive: true, requestId }`. Get `requestId` from `extractRequestId(request)` (Story 1.2 dependency).
  - [x] 3.6 Lazy-initialize the Supabase service role client using `SUPABASE_SERVICE_ROLE_KEY` env var. Cache the client instance (singleton pattern, not per-request).

- [x] Task 4: Create CORS middleware (AC: #4)
  - [x] 4.1 Create `packages/api/src/middleware/cors.ts`. Export `checkCors(request: Request, allowedDomains: string[]): NextResponse | null`. Returns `null` if CORS passes, returns error `NextResponse` if domain mismatch.
  - [x] 4.2 Extract `Origin` header from request. Compare against `allowedDomains` array from the store's API key record. Use exact domain matching (e.g., `https://store.myshopify.com`). Allow requests with no `Origin` header (server-to-server calls from Shopify app proxy).
  - [x] 4.3 For valid origins, add CORS headers to the response: `Access-Control-Allow-Origin: {origin}`, `Access-Control-Allow-Methods: GET, POST, OPTIONS`, `Access-Control-Allow-Headers: Authorization, Content-Type, X-Request-Id`, `Access-Control-Max-Age: 86400`.
  - [x] 4.4 Export `handlePreflight(request: Request, allowedDomains: string[]): NextResponse | null` for OPTIONS requests — returns a 204 response with CORS headers if origin is allowed, 403 if not.

- [x] Task 5: Create rate limiting middleware (AC: #5)
  - [x] 5.1 Create `packages/api/src/middleware/rate-limit.ts`. Import `IORedis` from `ioredis`. Lazy-initialize Redis connection following the same Upstash TLS detection pattern from existing `services/queue.ts` (lines 33-76).
  - [x] 5.2 Export `checkRateLimit(storeId: string, subscriptionTier: string | null): Promise<{ allowed: true, headers: RateLimitHeaders } | { allowed: false, response: NextResponse }>`. Look up tier limits from `RATE_LIMIT_TIERS`, default to `default` tier if unknown.
  - [x] 5.3 Implement sliding window rate limiting using Redis: key pattern `ratelimit:{store_id}:{window}` where window is current minute (for per-minute limit). Use `INCR` + `EXPIRE` (set TTL only on first increment via `SETNX` + `EXPIRE` atomic pattern or `INCR` then check if result is 1 to set TTL).
  - [x] 5.4 Calculate `X-RateLimit-Remaining` and `X-RateLimit-Reset` (Unix timestamp of window expiry). Return headers object for successful requests so route handlers can include them in responses.
  - [x] 5.5 On Redis connection failure, **allow the request through** (fail-open for rate limiting — availability over strictness). Log the error via pino logger (Story 1.2).
  - [x] 5.6 Export `closeRateLimitRedis(): Promise<void>` for graceful shutdown.

- [x] Task 6: Create composite B2B middleware wrapper (AC: #2-5)
  - [x] 6.1 Create `packages/api/src/middleware/b2b.ts`. Export `withB2BAuth(handler: (request: Request, context: B2BContext) => Promise<NextResponse>): (request: Request) => Promise<NextResponse>` — higher-order function that chains: extractRequestId → authenticateApiKey → checkCors → checkRateLimit → handler.
  - [x] 6.2 Handle OPTIONS preflight requests before auth (CORS preflight doesn't include Authorization header). If OPTIONS, call `handlePreflight` directly.
  - [x] 6.3 On any middleware failure, return the appropriate error response (401, 403, 429) with `{ data: null, error: { code, message } }` format. Include rate limit headers on 429 responses.
  - [x] 6.4 Pass `B2BContext` to the handler function so endpoint implementations have `storeId`, `requestId`, `shopDomain`, and `subscriptionTier` available.

- [x] Task 7: Create `/api/v1/` route structure (AC: #1)
  - [x] 7.1 Create directory structure under `apps/next/app/api/v1/`:
    ```
    v1/
      generation/
        create/route.ts
        [id]/route.ts
      credits/
        balance/route.ts
      stores/
        config/route.ts
      size-rec/
        route.ts
      webhooks/
        shopify/
          orders/route.ts
          app/route.ts
    ```
  - [x] 7.2 Each placeholder `route.ts` exports a handler that returns `501 Not Implemented` with `{ data: null, error: { code: "NOT_IMPLEMENTED", message: "Endpoint coming in a future release" } }` — so the structure exists and middleware can be tested, but actual logic comes in later stories.
  - [x] 7.3 Create `apps/next/app/api/v1/health/route.ts` — a functional health check endpoint that applies `withB2BAuth` and returns `{ data: { status: "ok", store_id: context.storeId, timestamp: "..." }, error: null }`. This validates the full middleware chain end-to-end.

- [x] Task 8: Update middleware barrel exports
  - [x] 8.1 Update `packages/api/src/middleware/index.ts` (created by Story 1.2) — add exports for `api-key-auth`, `cors`, `rate-limit`, `b2b`.
  - [x] 8.2 Update `packages/api/src/index.ts` — add exports for B2B middleware and types so they're importable from `'api'` package.

- [x] Task 9: Write tests (AC: #1-6)
  - [x] 9.1 Create `packages/api/__tests__/middleware/api-key-auth.test.ts` — test: valid API key resolves to store_id, invalid key returns 401, missing Authorization header returns 401, inactive store returns 401, key without `wk_` prefix returns 401. Mock Supabase client.
  - [x] 9.2 Create `packages/api/__tests__/middleware/cors.test.ts` — test: allowed domain passes, disallowed domain returns 403, no Origin header passes (server-to-server), OPTIONS preflight returns 204 with correct headers.
  - [x] 9.3 Create `packages/api/__tests__/middleware/rate-limit.test.ts` — test: under-limit requests pass with correct headers, over-limit requests return 429 with headers, Redis failure allows request through (fail-open), different tiers have different limits. Mock Redis.
  - [x] 9.4 Create `packages/api/__tests__/middleware/b2b.test.ts` — test: full middleware chain passes for valid request, OPTIONS handled before auth, each failure mode returns correct error format.
  - [x] 9.5 Create `packages/api/__tests__/utils/b2b-response.test.ts` — test: success response wraps data in `{ data, error: null }` with snake_case keys, error response uses correct HTTP status, rate limit response includes headers.

## Dev Notes

### Architecture Requirements

- **ADR-1: B2B API Layer** — REST via Next.js API routes (/api/v1/*), reusing packages/api service layer. No separate server. [Source: architecture.md#ADR-1]
- **FP-2: B2B Auth — Application-Level Scoping** — API key → store_id in middleware, uses Supabase service role key. No RLS for B2B (RLS requires Supabase JWT which B2B doesn't use). Enforce store_id in WHERE clauses. [Source: architecture.md#FP-2]
- **AR5, AR8, AR14** — Store onboarding, API key management, rate limiting patterns.

### Dependencies on Epic 1

**This story requires ALL Epic 1 stories to be completed first:**

| Dependency | What's Used | Story |
|---|---|---|
| `store_api_keys` table | API key lookup (key_hash, store_id, allowed_domains, is_active) | 1.1 |
| `stores` table | Store status, shop_domain, subscription_tier | 1.1 |
| `extractRequestId()` | Correlation ID generation for every B2B request | 1.2 |
| pino logger | Structured logging (no console.log) | 1.2 |
| `toSnakeCase()` | Convert camelCase response data to snake_case | 1.2 |
| `middleware/index.ts` barrel | Existing barrel to extend with new middleware | 1.2 |
| Redis connection pattern | Rate limiting uses ioredis (pattern from redis-queue.ts) | 1.3 |

### Existing Codebase Patterns

**Next.js API Route pattern (from `apps/next/app/api/cron/cleanup/route.ts`):**
- Exports named functions: `GET`, `POST` (Next.js App Router convention)
- Uses `NextRequest` and `NextResponse` from `next/server`
- Header extraction: `request.headers.get('authorization')`
- JSON responses: `NextResponse.json({ ... }, { status: 200 })`
- Error handling: try/catch at handler level

**Supabase service role client pattern (from `apps/next/app/api/trpc/[trpc]/route.ts`):**
```typescript
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const adminSupabase = createClient(supabaseUrl, supabaseServiceKey)
```
For B2B middleware, create a singleton service role client (not per-request) since B2B always uses service role.

**Existing rbac.ts pattern (from `packages/api/src/utils/rbac.ts`):**
- Uses `SupabaseClient` type
- RPC calls: `supabase.rpc('function_name', { params })`
- Returns typed results
- Uses `console.error` (will need pino after Story 1.2)

**Existing proxy.ts pattern (from `apps/next/proxy.ts`):**
- Server-side request processing
- Header/cookie reading
- Redirect/rewrite responses
- Role checks via Supabase RPC

### API Key Authentication Design

**Key format:** `wk_` + 32-char random hex (e.g., `wk_a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4`)
**Storage:** SHA-256 hash in `store_api_keys.key_hash` (never plaintext)
**Authorization header:** `Authorization: Bearer wk_a1b2c3d4...`

**Authentication flow:**
1. Extract `Authorization` header
2. Validate `Bearer wk_*` format
3. `crypto.createHash('sha256').update(apiKey).digest('hex')`
4. Query: `store_api_keys JOIN stores WHERE key_hash = hash AND is_active = true`
5. Check `stores.status = 'active'`
6. Return `B2BContext` with store_id, shop_domain, allowed_domains, subscription_tier

**Security notes:**
- Never log the API key itself (log key_hash prefix or store_id only)
- Never return whether a store exists in error messages (always generic "Invalid API key")
- The service role client bypasses RLS — the middleware must enforce store_id scoping

### CORS Design

**Allowed domains** stored in `store_api_keys.allowed_domains` (TEXT[] NOT NULL DEFAULT '{}')
- Exact domain matching (e.g., `https://mystore.myshopify.com`)
- Empty array = no domain restriction (for server-to-server only)
- No Origin header = pass through (Shopify app proxy calls don't have Origin)

**Preflight handling:** OPTIONS requests must be handled BEFORE authentication because browsers send preflight without Authorization header. The CORS middleware needs the allowed_domains from the API key record, but for preflight we don't have the API key. Solution: handle OPTIONS at route level with known allowed origins, or use a catch-all CORS config for preflight.

**Recommended approach:** For OPTIONS requests, respond with permissive CORS headers (allow the specific Origin if it matches any store's domain) — this is safe because the actual POST/GET request will be fully authenticated. Alternatively, skip CORS check for OPTIONS and let the browser proceed to the actual request.

### Rate Limiting Design

**Per-store tier limits via Redis INCR with TTL:**

Key pattern: `ratelimit:store:{store_id}:{minute_window}`
- `minute_window` = `Math.floor(Date.now() / 60000)` (current minute)
- TTL: 120 seconds (2 minutes, covers the window + buffer)

**Algorithm:**
```
count = INCR key
if count == 1: EXPIRE key 120
if count > tier_limit: return 429
return headers { limit, remaining: limit - count, reset: window_end_timestamp }
```

**Fail-open:** If Redis is unavailable, allow the request through. Rate limiting is a protection, not a gate — availability trumps strictness.

**Rate limit headers (RFC 6585):**
- `X-RateLimit-Limit`: Maximum requests per window
- `X-RateLimit-Remaining`: Remaining requests in current window
- `X-RateLimit-Reset`: Unix timestamp when the window resets

### Response Format

**All B2B REST responses follow this wrapper (architecture mandate):**

Success:
```json
{ "data": { "session_id": "abc", "status": "queued" }, "error": null }
```

Error:
```json
{ "data": null, "error": { "code": "RATE_LIMIT_EXCEEDED", "message": "Store rate limit reached. Try again in 30s." } }
```

- Error codes: `UPPER_SNAKE_CASE` strings
- HTTP status codes: 400 (validation), 401 (auth), 403 (forbidden/CORS), 404 (not found), 422 (moderation), 429 (rate limit), 500 (server), 503 (unavailable)
- All field names in `snake_case` — use `toSnakeCase()` from Story 1.2 for data objects
- Always include both `data` and `error` fields (use `null`, never omit)
- Timestamps: ISO 8601 UTC (e.g., `2026-02-09T14:30:00Z`)

### Route Structure Notes

**New directories to create under `apps/next/app/api/v1/`:**
```
v1/
  health/route.ts          ← Functional (validates middleware chain)
  generation/
    create/route.ts        ← Placeholder (implemented in Story 4.1)
    [id]/route.ts          ← Placeholder (implemented in Story 4.1)
  credits/
    balance/route.ts       ← Placeholder (implemented in Story 3.1)
  stores/
    config/route.ts        ← Placeholder (implemented in Story 2.3)
  size-rec/
    route.ts               ← Placeholder (implemented in Story 5.1)
  webhooks/
    shopify/
      orders/route.ts      ← Placeholder (implemented in Story 6.3)
      app/route.ts         ← Placeholder (implemented in Story 2.4)
```

Placeholder routes return 501 with `{ data: null, error: { code: "NOT_IMPLEMENTED", message: "..." } }`. The health endpoint is fully functional and validates the complete middleware chain.

**Import pattern for route files:**
```typescript
import { withB2BAuth } from 'api/middleware/b2b'
import { successResponse } from 'api/utils/b2b-response'
import type { B2BContext } from 'api/types/b2b'
```

Route files in `apps/next/` import from the `api` package (which is `packages/api`). This follows the existing tRPC pattern where `apps/next/app/api/trpc/[trpc]/route.ts` imports `appRouter` from `'api'`.

### Middleware Composition Pattern

The `withB2BAuth` wrapper provides a clean pattern for all B2B route handlers:

```typescript
// In a route.ts file:
import { withB2BAuth } from 'api/middleware/b2b'
import { successResponse } from 'api/utils/b2b-response'

export const POST = withB2BAuth(async (request, context) => {
  // context.storeId, context.requestId, context.shopDomain available
  // All middleware (auth, CORS, rate limit) already applied
  return successResponse({ status: 'ok' })
})
```

This prevents developers from forgetting to apply middleware on individual routes.

### Previous Story Intelligence

**Story 1.1** creates the database tables this middleware queries:
- `stores` (shop_domain, subscription_tier, status)
- `store_api_keys` (key_hash, store_id, allowed_domains, is_active)

**Story 1.2** creates infrastructure this story uses:
- `extractRequestId()` — correlation ID for every B2B request
- pino logger — structured logging (no console.log)
- `toSnakeCase()` — response data conversion
- `middleware/index.ts` barrel — extend with new middleware

**Story 1.3** establishes the Redis connection pattern:
- ioredis lazy initialization with Upstash TLS detection
- Error handling patterns for Redis connection failures

### Project Structure Notes

New files to create:
- `packages/api/src/middleware/api-key-auth.ts`
- `packages/api/src/middleware/cors.ts`
- `packages/api/src/middleware/rate-limit.ts`
- `packages/api/src/middleware/b2b.ts`
- `packages/api/src/types/b2b.ts`
- `packages/api/src/utils/b2b-response.ts`
- `apps/next/app/api/v1/` (entire directory tree with route files)

Modified files:
- `packages/api/src/middleware/index.ts` — add barrel exports
- `packages/api/src/index.ts` — add B2B middleware/types exports

Test files:
- `packages/api/__tests__/middleware/api-key-auth.test.ts`
- `packages/api/__tests__/middleware/cors.test.ts`
- `packages/api/__tests__/middleware/rate-limit.test.ts`
- `packages/api/__tests__/middleware/b2b.test.ts`
- `packages/api/__tests__/utils/b2b-response.test.ts`

### References

- [Source: docs/_bmad/planning-artifacts/architecture.md#ADR-1] — B2B REST API via Next.js routes
- [Source: docs/_bmad/planning-artifacts/architecture.md#FP-2] — Application-level scoping, no RLS for B2B
- [Source: docs/_bmad/planning-artifacts/architecture.md#Authentication & Security] — API key format, CORS, domain restriction
- [Source: docs/_bmad/planning-artifacts/architecture.md#API & Communication Patterns] — Endpoint list, response format
- [Source: docs/_bmad/planning-artifacts/architecture.md#Rate Limiting] — Redis INCR, two-layer rate limiting
- [Source: docs/_bmad/planning-artifacts/architecture.md#Format Patterns] — Response wrapper, error codes, HTTP status codes
- [Source: docs/_bmad/planning-artifacts/architecture.md#Enforcement Guidelines] — snake_case, request_id, { data, error } wrapper
- [Source: docs/_bmad/planning-artifacts/architecture.md#Project Structure] — /api/v1/* directory tree
- [Source: docs/project-context.md#API Response Format] — B2B response format specification
- [Source: docs/project-context.md#Security Rules] — API key handling, CORS, HMAC verification
- [Source: docs/project-context.md#Critical Don't-Miss Rules] — Never expose API keys, snake_case at boundaries
- [Source: packages/api/src/utils/rbac.ts] — Existing utility pattern (Supabase RPC, error handling)
- [Source: apps/next/app/api/cron/cleanup/route.ts] — Existing API route pattern (NextRequest/NextResponse)
- [Source: apps/next/app/api/trpc/[trpc]/route.ts] — Supabase service role client creation pattern
- [Source: apps/next/proxy.ts] — Existing server-side request processing pattern

### Database Types

- Use generated Supabase types from `packages/api/src/types/database.ts` for all database operations where applicable.
- Regenerate types after any migration: `npx supabase gen types typescript --project-id ljilupbgmrizblkzokfa > packages/api/src/types/database.ts`

### Workflow

- **Commit code after story completion.** Each completed story should be committed as a standalone commit before moving to the next story.

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- All 83 tests pass (37 new for this story + 46 from Story 1.2)
- 3 pre-existing test failures unrelated to this story (b2b-schema.test.ts needs Supabase env vars, Next.js build/dev tests are infrastructure issues)

### Completion Notes List

- All 9 tasks and subtasks implemented per specification
- B2B types include `NOT_IMPLEMENTED` error code (added for placeholder routes)
- CORS middleware handles OPTIONS preflight before auth (browsers don't send Authorization on preflight)
- Rate limiter uses fail-open pattern — Redis failures allow requests through
- Supabase service role client uses singleton pattern (lazy-initialized, not per-request)
- Health endpoint (`/api/v1/health`) validates full middleware chain end-to-end
- All placeholder routes return 501 with `NOT_IMPLEMENTED` error code
- Webhook routes (`/api/v1/webhooks/shopify/*`) skip `withB2BAuth` (Shopify webhooks use HMAC, not API keys)
- `NextResponse` used in `b2b-response.ts` but tests use standard `Response` (NextResponse extends Response; works in Vitest without Next.js runtime)

### Change Log

| Change | Reason |
|--------|--------|
| Added `NOT_IMPLEMENTED` to `B2BErrorCode` union | Needed for placeholder route 501 responses |
| Webhook routes skip `withB2BAuth` | Shopify webhooks use HMAC verification, not API key auth — will be implemented in Story 6.3 |
| `b2b-response.ts` uses `Response` instead of `NextResponse` | Standard `Response` API works in both Next.js runtime and Vitest test environment; `NextResponse.json()` is not available outside Next.js |

### File List

**Created:**
- `packages/api/src/types/b2b.ts` — B2B type definitions (B2BContext, B2BErrorCode, B2BResponse, RateLimitTier, RATE_LIMIT_TIERS)
- `packages/api/src/utils/b2b-response.ts` — Response wrapper utilities (successResponse, errorResponse, rateLimitResponse, convenience responses)
- `packages/api/src/middleware/api-key-auth.ts` — API key authentication middleware
- `packages/api/src/middleware/cors.ts` — CORS validation middleware (checkCors, handlePreflight, addCorsHeaders)
- `packages/api/src/middleware/rate-limit.ts` — Redis-based rate limiting middleware
- `packages/api/src/middleware/b2b.ts` — Composite B2B middleware wrapper (withB2BAuth)
- `apps/next/app/api/v1/health/route.ts` — Health check endpoint (functional)
- `apps/next/app/api/v1/generation/create/route.ts` — Placeholder (501)
- `apps/next/app/api/v1/generation/[id]/route.ts` — Placeholder (501)
- `apps/next/app/api/v1/credits/balance/route.ts` — Placeholder (501)
- `apps/next/app/api/v1/stores/config/route.ts` — Placeholder (501)
- `apps/next/app/api/v1/size-rec/route.ts` — Placeholder (501)
- `apps/next/app/api/v1/webhooks/shopify/orders/route.ts` — Placeholder (501, no auth)
- `apps/next/app/api/v1/webhooks/shopify/app/route.ts` — Placeholder (501, no auth)
- `packages/api/__tests__/middleware/api-key-auth.test.ts` — 5 tests
- `packages/api/__tests__/middleware/cors.test.ts` — 8 tests
- `packages/api/__tests__/middleware/rate-limit.test.ts` — 8 tests
- `packages/api/__tests__/middleware/b2b.test.ts` — 7 tests
- `packages/api/__tests__/utils/b2b-response.test.ts` — 9 tests

**Modified:**
- `packages/api/src/types/index.ts` — Added B2B type exports
- `packages/api/src/middleware/index.ts` — Added exports for api-key-auth, cors, rate-limit, b2b
- `packages/api/src/index.ts` — Added B2B middleware, types, and response utility exports
