---
project_name: 'wearon'
user_name: 'Abaid'
date: '2026-02-09'
sections_completed:
  ['technology_stack', 'language_rules', 'framework_rules', 'testing_rules', 'quality_rules', 'workflow_rules', 'anti_patterns']
status: 'complete'
rule_count: 42
optimized_for_llm: true
---

# Project Context for AI Agents

_This file contains critical rules and patterns that AI agents must follow when implementing code in this project. Focus on unobvious details that agents might otherwise miss._

---

## Technology Stack & Versions

| Technology | Version | Notes |
|---|---|---|
| Node.js | 22 | Enforced via `engines` field |
| Yarn | 4.5.0 | PnP mode, enforced via `packageManager` |
| TypeScript | ~5.8.3 | `strictNullChecks: true`, `noUncheckedIndexedAccess: true` |
| React | 19.0.0 | Pinned via `resolutions`, shared across all platforms |
| Next.js | 16 | App Router, Vercel deployment |
| Expo SDK | 53 | Expo Router for native |
| Tamagui | ^1.143.x | Universal UI, extends `@tamagui/config/v4` |
| Solito | — | Cross-platform navigation (Expo Router ↔ Next.js) |
| tRPC | — | B2C type-safe API (unchanged for B2B) |
| Supabase | — | Auth, PostgreSQL, Storage, Realtime |
| Biome | ^1.9.3 | Linter + formatter (no Prettier) |
| Vitest | ^2.1.1 | Testing framework |
| Python | 3.12+ | wearon-worker only |
| Celery | — | Python-side task management (wearon-worker) |
| FastAPI | — | Size rec HTTP endpoint (wearon-worker) |
| MediaPipe | — | 33 3D body landmarks for size rec (wearon-worker) |
| Redis | — | Celery broker + rate limiting + cross-language queue |
| Axios | — | HTTP client for all requests (never use fetch) |

## Critical Implementation Rules

### Language-Specific Rules

- **`useImportType: "error"`** — Biome enforces `import type` for type-only imports. Using plain `import` for types will fail lint.
- **`noConsoleLog: "error"`** — No `console.log` anywhere in TypeScript. Use `pino` logger instead.
- **`strictNullChecks: true`** + **`noUncheckedIndexedAccess: true`** — Array/object index access returns `T | undefined`. Always handle the `undefined` case.
- **Single quotes, no semicolons (unless needed), ES5 trailing commas** — Biome formatter enforces this. Don't fight it.
- **Line width: 100 chars** — Biome formatter wraps at 100.
- **JSX attributes: multiline** — Biome enforces multiline attribute positioning for JSX.
- **Python (wearon-worker):** `snake_case` for everything. Pydantic strict mode for all models. Type hints required.

### Cross-Language Data Contract

**This is the #1 source of cross-repo bugs.** All data at boundaries must be `snake_case`:

- **Database columns:** `snake_case` (`store_id`, `created_at`, `credit_balance`)
- **API JSON fields (B2B REST):** `snake_case` (`{ "store_id": "...", "session_id": "..." }`)
- **Redis task payloads:** `snake_case` (shared between TypeScript and Python)
- **TypeScript internal code** stays `camelCase` — convert at boundaries using thin `toSnakeCase`/`toCamelCase` utilities.
- **Python** is natively `snake_case` — no conversion needed.
- Pydantic strict mode on Python side catches any `camelCase` leaks from TypeScript.

### Framework-Specific Rules

**Tamagui:**
- Config lives in `packages/config/src/tamagui.config.ts`, extends `@tamagui/config/v4`
- `onlyAllowShorthands: false` — both shorthand and full props work
- Add `// debug` as first-line comment in any file to see Tamagui compiler output
- Prefer Tamagui styling props over raw CSS/StyleSheet

**Next.js (apps/next):**
- App Router — file-based routing in `app/` directory
- New native dependencies must be added to `transpilePackages` in `next.config.js` if they show "Cannot use import statement outside a module"
- Route protection via `proxy.ts` (formerly middleware) — server-side auth + role checks
- B2B REST API routes at `/api/v1/*`, B2C tRPC at `/api/trpc`

**Expo (apps/expo):**
- Expo Router for navigation
- Native dependencies go in `apps/expo/package.json` — if also in `packages/app`, **exact same version required** (monorepo version mismatch = severe bugs)

**tRPC:**
- B2C only (unchanged for B2B)
- Use `protectedProcedure` for authenticated endpoints
- Use `adminProcedure` / `moderatorProcedure` / `withPermission()` for RBAC
- Client from `packages/app/utils/trpc.ts`

**Supabase:**
- Platform-aware clients: web uses `@supabase/ssr` with cookies, native uses AsyncStorage
- Access user via `useSupabase()` hook from `SupabaseProvider`
- B2B uses service role key with application-level `store_id` scoping (no RLS for B2B)
- B2C uses JWT-based RLS (existing)

**Shopify Plugin (wearon-shopify):**
- Official React Router template (Remix v7 merged)
- Polaris for Admin UI, Preact/vanilla JS for theme extension storefront (<50KB gzipped)
- Plugin is a thin client — no business logic, no database, calls WearOn B2B REST API via server-side proxy
- API key never exposed in client JS — held server-side only
- Shopper email resolved server-side via Shopify customer context

### API Response Format

**B2B REST (all `/api/v1/*` endpoints):**

```json
// Success
{ "data": { "session_id": "abc", "status": "queued" }, "error": null }

// Error
{ "data": null, "error": { "code": "RATE_LIMIT_EXCEEDED", "message": "Store rate limit reached." } }
```

- Error codes: `UPPER_SNAKE_CASE` strings (`INVALID_API_KEY`, `INSUFFICIENT_CREDITS`, `MODERATION_BLOCKED`, etc.)
- Status codes: 400 (validation), 401 (auth), 403 (forbidden), 404 (not found), 422 (moderation), 429 (rate limit), 500 (server), 503 (unavailable)
- Always include both `data` and `error` fields (use `null` for empty, never omit)
- All timestamps: ISO 8601 UTC (`2026-02-09T14:30:00Z`), never Unix timestamps

**B2C tRPC:** Unchanged — tRPC handles its own response format.

### Credit Operations

- **Always atomic:** Use Supabase RPC functions (`deduct_credits`, `refund_credits`). NEVER use raw `UPDATE` on credit tables.
- **API deducts before queueing** (never the worker). Worker refunds on failure only.
- **Log every operation** in the transaction table with `request_id`.
- B2B: `store_credits` (absorb mode) or `store_shopper_credits` (resell mode). B2C: `user_credits`.

### Correlation ID

- Format: `req_` + UUID v4 (e.g., `req_a1b2c3d4-e5f6-...`)
- Generated at API entry point if not present in `X-Request-Id` header
- Passed through: API → Redis task (`request_id` field) → worker logs → Supabase session metadata
- **Every log line must include `request_id`**

### Testing Rules

- **Vitest** for TypeScript (wearon, wearon-shopify). **pytest** for Python (wearon-worker).
- Test directories: `__tests__/` at package level for TypeScript, `tests/` at project root for Python.
- File naming: `{feature}.test.ts` (TypeScript), `test_{feature}.py` (Python).
- Cross-language integration test in CI: push sample task from Node.js → verify Python worker processes it.

### Code Quality & Style Rules

- **Biome** handles formatting and linting for TypeScript repos. No Prettier.
- Run `yarn lint` in the app directory before committing.
- `useImportType: "error"` — always use `import type` for type-only imports.
- No `console.log` — use structured logger (pino for TS, structlog for Python).
- Husky git hooks enforce quality on commit.

### Project Organization

- **Feature-based** organization in `packages/app/features/` — not screens, not layers.
- **packages/api:** tRPC routers + B2B REST service layer
- **packages/app:** Shared features, navigation, providers, utils
- **packages/ui:** Tamagui-based reusable UI components (`@my/ui`)
- **packages/config:** Tamagui theme config
- **wearon-worker:** Module-based (`worker/`, `size_rec/`, `services/`, `models/`)
- **wearon-shopify:** Shopify template structure (routes for Admin, extensions for storefront)

### Development Workflow Rules

- **Repo layout:** Create `wearon-shopify/` and `wearon-worker/` inside this repo's root folder. They are separate git repos, added to this repo's `.gitignore`.
- **Three repos, three terminals:** `yarn web` (wearon), `docker-compose up` (wearon-worker), `shopify app dev` (wearon-shopify)
- **Deploy order:** Worker first, API second. Worker handles both old and new task formats during transitions.
- **Task payload `version` field** for backward-compatible migrations.
- **Makefile** in each repo: `make dev`, `make test`, `make deploy`.
- **Feature flag `USE_PYTHON_WORKER`** for B2C migration — toggles between BullMQ and Redis queue.
- **CI/CD:** Vercel auto-deploys (wearon), DigitalOcean App Platform auto-deploys (wearon-worker), Shopify CLI deploy (wearon-shopify).

### Critical Don't-Miss Rules

- **Never expose API keys in client-side JS.** Plugin calls server-side proxy, proxy holds the key.
- **Never log secrets, tokens, image URLs with signatures, or shopper emails.** Log `shopper_email_hash` if needed.
- **Never use raw `UPDATE` for credits.** Always use atomic Supabase RPC functions.
- **Never use `fetch`** — always use Axios for HTTP requests.
- **Never omit `request_id`** from logs or cross-service calls.
- **Always convert to `snake_case`** at TypeScript→JSON boundaries (API responses, Redis payloads).
- **Always include both `data` and `error` in B2B responses** — use `null`, never omit.
- **Moderation blocks:** Return `MODERATION_BLOCKED` error, refund credit, do NOT retry.
- **6-hour auto-delete** for all uploaded/generated images (privacy compliance).
- **Shopify webhook verification:** HMAC-SHA256 on every incoming webhook. Idempotent processing via `shopify_order_id`.
- **Native dependencies in monorepo:** Same exact version in `packages/app` and `apps/expo` — version mismatch = severe bugs.
- **Status values:** Only `queued`, `processing`, `completed`, `failed` (lowercase). No other values in session tables.

### Security Rules

- API keys: `wk_` + 32-char hex, stored as SHA-256 hash (never plaintext)
- Shopify access tokens: AES-256 encrypted before storing in `stores` table
- CORS: Only registered store domain accepted per API key
- B2B auth: API key → `store_id` resolution in middleware, `store_id` enforced in all queries
- Webhooks: HMAC-SHA256 signature verification (Shopify signs with app secret)
- Plugin: Shadow DOM or scoped styles for CSS isolation on merchant stores

---

## Usage Guidelines

**For AI Agents:**

- Read this file before implementing any code
- Follow ALL rules exactly as documented
- When in doubt, prefer the more restrictive option
- Update this file if new patterns emerge

**For Humans:**

- Keep this file lean and focused on agent needs
- Update when technology stack changes
- Review quarterly for outdated rules
- Remove rules that become obvious over time

Last Updated: 2026-02-09
