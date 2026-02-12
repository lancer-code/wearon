# Story 1.2: Cross-Repo Infrastructure (Logging, Correlation ID, snake_case)

Status: review

## Story

As a **developer**,
I want **structured logging, correlation IDs, and boundary conversion utilities**,
so that **all API requests can be traced across services with consistent data formats at boundaries**.

## Acceptance Criteria

1. **Given** the pino logger is configured in `packages/api`, **When** any API handler or service logs a message, **Then** output is structured JSON with `level`, `request_id`, `message`, `timestamp`, and `repo` fields. `console.log` is not used anywhere (Biome enforces `noConsoleLog: error`).

2. **Given** the `request-id.ts` middleware in `packages/api/src/middleware/`, **When** an API request arrives without an `X-Request-Id` header, **Then** a new correlation ID in format `req_` + UUID v4 is generated and attached to the request context.

3. **Given** the `request-id.ts` middleware, **When** an API request arrives with an `X-Request-Id` header, **Then** the existing value is preserved and used throughout the request lifecycle.

4. **Given** the `snake-case.ts` utility in `packages/api/src/utils/`, **When** a camelCase object is passed to `toSnakeCase()`, **Then** all keys are converted to `snake_case` for API responses and Redis payloads.

5. **Given** the `snake-case.ts` utility, **When** a snake_case object is passed to `toCamelCase()`, **Then** all keys are converted to `camelCase` for internal TypeScript use.

## Tasks / Subtasks

- [x] Task 1: Install pino and create logger module (AC: #1)
  - [x] 1.1 Install `pino` as dependency in `packages/api` (`yarn add pino`). Install `pino-pretty` as devDependency (`yarn add -D pino-pretty`).
  - [x] 1.2 Create `packages/api/src/logger.ts` — export a configured pino logger instance with: base fields `{ repo: 'wearon' }`, timestamp in ISO 8601 format, transport set to `pino-pretty` when `NODE_ENV !== 'production'`. Export a `createChildLogger(requestId: string)` function that returns a child logger with `request_id` field bound.
  - [x] 1.3 Export logger from `packages/api/src/index.ts` so it's importable as `import { logger } from 'api'`.
- [x] Task 2: Create request-id middleware (AC: #2, #3)
  - [x] 2.1 Create `packages/api/src/middleware/` directory.
  - [x] 2.2 Create `packages/api/src/middleware/request-id.ts` — export `extractRequestId(request: Request): string` function that reads `X-Request-Id` header if present, otherwise generates `req_` + crypto.randomUUID(). Also export `REQUEST_ID_HEADER = 'X-Request-Id'` constant.
  - [x] 2.3 Create `packages/api/src/middleware/index.ts` — barrel export for all middleware modules.
- [x] Task 3: Create snake_case conversion utility (AC: #4, #5)
  - [x] 3.1 Create `packages/api/src/utils/snake-case.ts` — export `toSnakeCase<T>(obj: T): T` that recursively converts all object keys from camelCase to snake_case. Handle nested objects, arrays, null/undefined/primitives passthrough. Do NOT convert values, only keys.
  - [x] 3.2 In same file, export `toCamelCase<T>(obj: T): T` that recursively converts snake_case keys to camelCase. Same recursive handling.
  - [x] 3.3 Key conversion rules: `camelCase` → `camel_case`, `storeId` → `store_id`, `createdAt` → `created_at`. Handle edge cases: consecutive capitals (`apiURL` → `api_url`), already-converted keys (passthrough), empty objects, arrays of objects.
- [x] Task 4: Write tests (AC: #1-5)
  - [x] 4.1 Create `packages/api/__tests__/logger.test.ts` — test: logger outputs JSON with required fields, createChildLogger includes request_id, logger.info/warn/error produce correct levels.
  - [x] 4.2 Create `packages/api/__tests__/middleware/request-id.test.ts` — test: generates `req_` + UUID v4 format when no header, preserves existing header value, generated IDs are valid UUID format.
  - [x] 4.3 Create `packages/api/__tests__/utils/snake-case.test.ts` — test: toSnakeCase converts flat objects, nested objects, arrays of objects, passthrough for primitives/null/undefined. toCamelCase converts flat objects, nested objects, arrays. Roundtrip: toCamelCase(toSnakeCase(obj)) === obj for standard keys.

## Dev Notes

### Architecture Requirements

- **AR11: Correlation ID** — Format: `req_` + UUID v4. Passed through API → Redis task (`request_id` field) → worker logs → Supabase session metadata. Every log line must include `request_id`. [Source: architecture.md#Correlation ID]
- **AR12: snake_case at boundaries** — API JSON, Redis payloads, DB columns all use snake_case. TypeScript internal stays camelCase. Convert at boundaries using thin utilities. [Source: architecture.md#Naming Patterns]
- **AR13: Structured logging** — pino for TypeScript, structlog for Python. No console.log. JSON format with level, request_id, message, timestamp, repo. [Source: architecture.md#Logging Patterns]

### Existing Codebase Patterns

**Current state:**
- `packages/api/package.json` has `ioredis`, `@supabase/supabase-js`, `@trpc/server`, `zod`, `bullmq` (to be removed in Story 1.3)
- `pino` is NOT currently installed — must be added
- No `middleware/` directory exists yet — this story creates it
- No `utils/snake-case.ts` exists — this story creates it
- Existing tRPC handler at `apps/next/app/api/trpc/[trpc]/route.ts` uses `console.error` (line 47) — will be migrated to pino in a follow-up, not this story

**Export pattern (from index.ts):**
```
export { appRouter, type AppRouter } from './routers/_app'
export { createContext, type Context } from './trpc'
```
Follow same pattern — add logger export here.

**B2B REST API routes will be at `apps/next/app/api/v1/*`** — they'll import and use these middleware utilities. Not created in this story but designed for that use case.

### pino Configuration Notes

- Use `pino()` factory with options, NOT `pino.transport()` (transport is for separate thread logging which isn't needed for Vercel serverless)
- For dev: use `pino-pretty` via `transport: { target: 'pino-pretty' }` when `NODE_ENV !== 'production'`
- For prod: raw JSON output (default pino behavior) — Vercel logs consume JSON natively
- Base fields: `{ repo: 'wearon' }` — identifies log source in multi-repo environment
- Timestamp: use `pino.stdTimeFunctions.isoTime` for ISO 8601 format (architecture requires ISO 8601)
- Do NOT add `console.log` override — Biome enforces `noConsoleLog: error`

### snake_case Utility Design

- **Thin boundary utility** — used at API response serialization and Redis payload creation only
- Key conversion: insert underscore before each capital letter, then lowercase all
- Handle edge cases: `apiURL` → `api_url` (consecutive capitals need special handling)
- Do NOT convert values (only keys), do NOT convert class instances
- Recursive: handle nested objects and arrays containing objects
- TypeScript generics: return type matches input shape for type safety
- Keep implementation simple — no external libraries (lodash/camelcase not needed for this)

### Middleware Design

- `extractRequestId()` is a pure function (not Express/Next.js middleware) — it takes a `Request` object and returns a string
- This design works with both Next.js App Router (Request-based) and potential future frameworks
- B2B REST API route handlers will call `extractRequestId(request)` at the top, then pass the ID to child logger and downstream services
- UUID generation via `crypto.randomUUID()` (Node.js built-in, no external dependency)

### Previous Story Intelligence (Story 1.1)

- Story 1.1 creates B2B database tables — no code was written in `packages/api/src/` yet
- This story (1.2) creates the first infrastructure code in `packages/api/src/middleware/` and `packages/api/src/utils/snake-case.ts`
- The `request_id` parameter added to `deduct_store_credits` RPC in Story 1.1 will be populated using the correlation ID from this story's middleware

### Project Structure Notes

New files to create:
- `packages/api/src/logger.ts` — pino logger instance + createChildLogger
- `packages/api/src/middleware/request-id.ts` — correlation ID extraction
- `packages/api/src/middleware/index.ts` — barrel export
- `packages/api/src/utils/snake-case.ts` — boundary conversion utilities

Modified files:
- `packages/api/src/index.ts` — add logger export
- `packages/api/package.json` — add pino dependency

Test files:
- `packages/api/__tests__/logger.test.ts`
- `packages/api/__tests__/middleware/request-id.test.ts`
- `packages/api/__tests__/utils/snake-case.test.ts`

### References

- [Source: docs/_bmad/planning-artifacts/architecture.md#Logging Patterns] — pino for TS, JSON format, log levels
- [Source: docs/_bmad/planning-artifacts/architecture.md#Correlation ID] — req_ + UUID v4 format, X-Request-Id header
- [Source: docs/_bmad/planning-artifacts/architecture.md#Naming Patterns] — snake_case at boundaries, camelCase internal
- [Source: docs/_bmad/planning-artifacts/architecture.md#Implementation Patterns] — Code naming conventions
- [Source: docs/project-context.md#Language-Specific Rules] — noConsoleLog: error, strictNullChecks
- [Source: docs/project-context.md#Cross-Language Data Contract] — snake_case conversion rules
- [Source: packages/api/src/trpc.ts] — Existing context pattern, middleware style
- [Source: packages/api/src/index.ts] — Export barrel pattern
- [Source: packages/api/package.json] — Current dependencies (pino NOT installed)

### Database Types

- Use generated Supabase types from `packages/api/src/types/database.ts` for all database operations where applicable.
- Regenerate types after any migration: `npx supabase gen types typescript --project-id ljilupbgmrizblkzokfa > packages/api/src/types/database.ts`

### Workflow

- **Commit code after story completion.** Each completed story should be committed as a standalone commit before moving to the next story.

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- All 30 new tests pass (6 logger, 5 request-id, 19 snake-case)
- 3 pre-existing test failures unrelated to this story (b2b-schema needs Supabase env vars, Next.js build/dev server tests)

### Completion Notes List

- Installed pino ^9.6.0 and pino-pretty ^13.0.0 in packages/api
- Created logger.ts with pino configured for ISO 8601 timestamps, repo base field, pino-pretty in dev
- Created createChildLogger() that binds request_id to child logger
- Exported logger and createChildLogger from packages/api/src/index.ts
- Created middleware/request-id.ts with extractRequestId() pure function using crypto.randomUUID()
- Created middleware/index.ts barrel export
- Created utils/snake-case.ts with toSnakeCase() and toCamelCase() recursive key converters
- Handles edge cases: consecutive capitals (apiURL → api_url), nested objects, arrays, primitives passthrough, Date objects treated as non-plain
- All 5 acceptance criteria satisfied and verified by tests

### Change Log

- 2026-02-12: Implemented Story 1.2 — structured logging (pino), correlation ID middleware, snake_case boundary utilities with full test coverage

### File List

New files:
- packages/api/src/logger.ts
- packages/api/src/middleware/request-id.ts
- packages/api/src/middleware/index.ts
- packages/api/src/utils/snake-case.ts
- packages/api/__tests__/logger.test.ts
- packages/api/__tests__/middleware/request-id.test.ts
- packages/api/__tests__/utils/snake-case.test.ts

Modified files:
- packages/api/src/index.ts (added logger exports)
- packages/api/package.json (added pino, pino-pretty dependencies)
