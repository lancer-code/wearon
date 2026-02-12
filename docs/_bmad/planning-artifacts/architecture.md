---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
inputDocuments:
  - docs/_bmad/planning-artifacts/prd.md
  - docs/project-documentation/architecture-api.md
  - docs/project-documentation/data-models.md
  - docs/project-documentation/api-contracts.md
  - docs/project-documentation/source-tree.md
  - docs/_bmad/analysis/brainstorming-session-2026-02-07.md
workflowType: 'architecture'
lastStep: 8
status: 'complete'
completedAt: '2026-02-09'
project_name: 'wearon'
user_name: 'Abaid'
date: '2026-02-09'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

**Functional Requirements:**
53 FRs across 8 capability areas. Heaviest areas: Credit & Billing (10 FRs — subscriptions, PAYG, resell mode with Shopify checkout), Plugin UI (8 FRs — sandboxed loading, camera/pose guidance, privacy disclosure, accessibility, two operational modes), and Generation Pipeline (8 FRs — reuses B2C but needs store-scoped credit deduction and separate B2B storage).

**Non-Functional Requirements:**
34 NFRs with key architectural drivers:
- Plugin load <2s on 3G mobile (constrains plugin technology and bundle size)
- Size rec <1s real-time (server-side inference via MediaPipe on persistent Python worker)
- Generation <10s end-to-end (existing pipeline meets this)
- 99.5% API uptime (plugin must never break host store)
- WCAG 2.1 AA for plugin (accessibility-first design)
- Domain-restricted API keys + CORS whitelisting (per-store security)
- 200 concurrent stores, 100 concurrent generation requests

**Scale & Complexity:**

- Primary domain: Full-stack (Shopify App + REST API + Plugin + Mobile App + Background Workers)
- Complexity level: Medium-High
- Estimated architectural components: 12-15

### Technical Constraints & Dependencies

**Existing System Constraints (Brownfield):**
- Monorepo structure preserved (apps/next, apps/expo, packages/*). Shopify plugin is a separate repo (wearon-shopify).
- tRPC remains B2C API layer; B2B gets new REST API layer alongside it
- Supabase: database, auth (B2C), storage, realtime
- Celery + Redis: job queuing via Python worker (shared B2B and B2C)
- OpenAI GPT Image 1.5: generation engine (shared)
- Vercel hosts Next.js app (serverless functions for API)

**External Dependencies:**
- Shopify API (OAuth, App Bridge, Webhooks, Theme App Extensions)
- Shopify App Store review requirements (CSP compliance, data handling)
- OpenAI API (rate limits, pricing, moderation policy)
- MediaPipe (server-side pose estimation for size rec on Python worker — 33 3D landmarks)
- Payment provider selected: Paddle (merchant billing on WearOn platform)

**Solo Developer Constraint:**
- Single developer (Abaid) building all components
- Architecture must favor simplicity, code reuse, and managed services
- Monorepo shared code critical to avoid B2B/B2C duplication

### Cross-Cutting Concerns Identified

1. **Multi-Tenancy** — Fully separate B2B data model. New tables: stores, store_credits, store_credit_transactions, store_generation_sessions, store_analytics_events, store_api_keys, store_shopper_credits, store_shopper_purchases. B2C tables unchanged. Worker writes to correct table based on job channel field. Storage: /stores/{store_id}/.

2. **Dual Authentication** — B2B: Shopify OAuth for merchant admin + domain-restricted API keys for plugin API calls. Shoppers must be logged into store account to use try-on (email auto-fetched from Shopify customer context). B2C: Supabase Auth (email/Google). B2B uses service role key with application-level store_id scoping (not RLS).

3. **Dual Billing** — B2B: subscriptions + PAYG on WearOn's own platform via Paddle (not Shopify Billing API). Plugin listed as free on Shopify App Store (size rec is genuinely free). B2C: credit packs in-app. Resell mode uses Shopify's native checkout + order webhook.

4. **Plugin Isolation** — Plugin is a separate repo (wearon-shopify) using Shopify's official React Router template. Theme app extension embeds storefront UI on merchant product pages. Must not leak CSS/JS into host page.

5. **Shared Generation Pipeline** — Both B2B plugin and B2C app feed the same Celery task queue via Redis. Python worker is channel-aware: reads channel field, writes to store_generation_sessions (B2B) or generation_sessions (B2C), deducts from store_credits/store_shopper_credits or user_credits accordingly.

6. **Privacy & Compliance** — GDPR/CCPA templates, COPPA age gating, 6-hour auto-delete, Shopify App Store policies. Shopper email usage for try-on disclosed in privacy policy. Cuts across every component handling user photos.

7. **Analytics Segmentation** — Three views (merchant, B2C user, platform admin). Fully separate event tables: store_analytics_events (B2B) and analytics_events (B2C). Platform admin queries both.

8. **Two-Layer Rate Limiting** — API middleware enforces per-store tier limits + per-shopper email rate limits via Redis counters. Celery worker enforces global OpenAI 300 req/min rate limit. Clean separation of concerns.

### Architectural Decisions (from ADR + First Principles Elicitation)

**ADR-1: B2B API Layer** — REST via Next.js API routes (/api/v1/*), reusing packages/api service layer. No separate server. Theme app extension calls Shopify app's server-side proxy (React Router backend) which holds the API key and forwards requests to WearOn API. API key never exposed in client-side JavaScript.

**ADR-2: Data Model — Full Separation** — Completely separate B2B and B2C tables. B2B: stores, store_credits, store_credit_transactions, store_generation_sessions, store_analytics_events, store_api_keys, store_shopper_credits, store_shopper_purchases. B2C: users, user_credits, credit_transactions, generation_sessions, analytics_events. No shared tables, no polymorphic columns. Worker writes to correct table based on channel.

**ADR-3: Plugin Architecture** — Separate repo (wearon-shopify) using Shopify's official React Router template. Two parts: (1) Theme app extension for storefront UI (try-on/size-rec on product pages, Preact/vanilla JS for minimal bundle) — calls Shopify app's server-side proxy, never WearOn API directly. (2) App Bridge embedded pages in Shopify Admin (API key config + dashboard cards, Polaris UI). Plugin is a thin client — API key held server-side only, shopper email resolved server-side via Shopify customer context, no secrets in client JS.

**ADR-4: Shared Generation Pipeline** — Single Python worker replaces the existing TypeScript BullMQ worker. Handles both B2B and B2C generation. Simple Redis queue (LPUSH/BRPOP) for cross-language communication — Celery used only on Python side for retries and rate limiting. Next.js API deducts credits atomically before queueing, then pushes plain JSON task to Redis. Python worker consumes tasks, calls OpenAI, writes results to Supabase, and handles refunds on failure. Channel-aware task data (channel, store_id or user_id). Two-layer rate limiting: API middleware (per-store tier + per-shopper email) + worker (global OpenAI).

**ADR-5: Billing — Free Connector App Pattern** — Plugin is free on Shopify App Store. Size rec works immediately for all visitors (no login needed). Virtual try-on requires store account login. Merchant billing: subscription + PAYG on WearOn platform via Paddle. No Shopify Billing API, no 20% rev share. Fallback: add Shopify Billing API if App Store review rejects this approach.

**FP-1: Size Rec on Python Worker (MVP)** — MediaPipe pose estimation runs on the persistent Python worker process (DigitalOcean). 33 3D body landmarks for accurate size recommendations. Worker runs two interfaces: FastAPI HTTP server for synchronous size rec requests (<1s), Celery worker for async generation jobs. Model loads once on startup, stays warm.

**FP-2: B2B Auth — Application-Level Scoping** — B2B API resolves API key → store_id in middleware, uses Supabase service role key, enforces store_id in WHERE clauses. No RLS for B2B (RLS requires Supabase JWT which B2B doesn't use).

**FP-3: Merchant Dashboard — Minimal** — Onboarding + billing on WearOn platform (apps/next). Day-to-day ops via Shopify Admin App Bridge: simple cards fetching credits, usage, stats from WearOn API. No full dashboard to build.

**FP-4: Shopper Login Required for Try-On** — All shoppers must be logged into their Shopify store account to generate try-ons, both absorb and resell mode. Shopper email resolved server-side by the Shopify app proxy (never trusted from client payload). Size rec remains free and anonymous. Rate limiting per shopper email + store_id, configurable by store owner.

### Resell Mode Architecture

**Credit Flow:**
- On shopper purchase (Shopify order webhook only): deduct N credits from store's wholesale pool (store_credits), add N credits to shopper's balance (store_shopper_credits keyed by shopper_email + store_id), log purchase in store_shopper_purchases for audit.
- On generation (plugin REST API call): check store_shopper_credits (shopper_email + store_id), deduct 1 from shopper balance, queue generation. No store pool deduction at generation time — already deducted at purchase.

**Shopper Identification:** Email auto-fetched from Shopify customer context (shopper must be logged into store account). Email usage disclosed in privacy policy. Credits are store-scoped (credits on Store A don't exist on Store B).

**Credit Purchase UX:** Hidden Shopify product (removed from Online Store sales channel, not browsable). Plugin shows credit quantity selection (Option A for MVP: single price, variable quantity via cart link). Checkout opens in new tab via direct cart link (store.myshopify.com/cart/{variant_id}:{quantity}). Plugin polls for credit balance, auto-detects when credits arrive.

**Credit Product Management:** App Bridge admin app creates/manages the hidden digital product via Shopify Admin API when store owner enables resell mode. Store owner configures per-credit price in App Bridge settings.

**Webhook Reliability:** HMAC-SHA256 signature verification on every incoming webhook. Primary: Shopify orders/create webhook delivers purchase data → verify signature → credits added immediately. Fallback: plugin verifies purchase via WearOn API → WearOn confirms order via Shopify Admin API. Idempotent processing via shopify_order_id as unique key in store_shopper_purchases.

**New B2B Tables for Resell:**
- store_shopper_credits: per-shopper credit balance per store (store_id, shopper_email, balance, total_purchased, total_spent)
- store_shopper_purchases: audit trail of every credit purchase (store_id, shopper_email, shopify_order_id, credits_purchased, amount_paid, currency)

### Absorb Mode Architecture

**Credit Flow:**
- On generation (plugin REST API call): plugin auto-fetches shopper email from Shopify customer context → POST /api/v1/generation/create with email, images, store_id → API deducts 1 from store_credits (store's wholesale pool) → generation queued.
- No shopper-level credit tracking needed — store absorbs all cost.

**Rate Limiting:** Per shopper email + store_id. Configurable by store owner in App Bridge settings (e.g., max 5 generations/day per shopper). Prevents abuse while keeping zero-cost experience for shoppers.

## Starter Template Evaluation

### Primary Technology Domain

Brownfield monorepo (wearon) + new separate Shopify plugin repo (wearon-shopify). No greenfield starter for the main platform.

### Three-Repo Architecture

| Repo | Purpose | Stack |
|---|---|---|
| **wearon** (existing) | Platform: B2B REST API, B2C tRPC, web app, mobile app, admin | Next.js 16, Expo, tRPC, Supabase, Vercel |
| **wearon-shopify** (new) | Shopify plugin: App Bridge admin, theme app extension (storefront UI) | Shopify official React Router template |
| **wearon-worker** (new) | Generation worker, size rec, image processing | Python, Celery, Redis, MediaPipe, FastAPI, DigitalOcean |

### WearOn Platform (Existing Monorepo)

No starter template. Direct package integration for Shopify support:
- @shopify/shopify-api added to packages/api for OAuth, webhooks, Admin API
- B2B REST API routes at /api/v1/* in apps/next/
- Webhook endpoints at /api/v1/webhooks/shopify/ in apps/next/
- Merchant onboarding + billing pages in apps/next/ (Paddle integration)

### WearOn Shopify Plugin (New Separate Repo)

**Starter:** Shopify official template (React Router — Remix v7 merged with React Router)

**Initialization:**
```bash
shopify app init --template reactRouter
```

**Included out of the box:**
- OAuth + session management
- App Bridge v4 (embedded admin pages)
- Polaris React (merchant UI components)
- GraphQL Admin API client
- Webhook registration
- Theme app extension scaffolding (storefront UI)
- Prisma ORM (can be removed — WearOn uses Supabase)

**Plugin is a thin client:**
- App Bridge pages: API key config + dashboard cards (fetch from WearOn API)
- Theme app extension: storefront try-on/size-rec UI (Preact/vanilla JS, lightweight)
- No business logic, no database — all logic lives on WearOn platform
- Communicates exclusively via WearOn B2B REST API

### UI Library Decision

- Polaris for Shopify Admin merchant pages (native Shopify look, built into template)
- Tamagui for B2C mobile app + WearOn platform (existing, shared components)
- Preact/vanilla JS for theme app extension storefront UI (minimal bundle size, <2s load)

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Block Implementation):**
- Python worker replaces existing TypeScript BullMQ worker — single Celery worker for both B2B and B2C
- Cross-language queue integration (Next.js LPUSH → Redis → Python BRPOP, Celery internal only)
- Supabase as shared database accessed by both TypeScript and Python
- B2B REST API authentication (API key → store_id resolution)
- Shopify OAuth flow for merchant onboarding

**Important Decisions (Shape Architecture):**
- MediaPipe for pose estimation (33 3D landmarks, replacing MoveNet/TensorFlow)
- FastAPI for size rec HTTP endpoint on worker
- Pillow for image processing (replacing Sharp)
- supabase-py for Python worker database access
- Redis as both Celery broker and rate limit store
- Storage path segmentation (B2B vs B2C)

**Deferred Decisions (Post-MVP):**
- Worker auto-scaling strategy (start with single DigitalOcean droplet)
- CDN for generated images
- Worker health monitoring and alerting tooling
- Multi-region deployment

### Data Architecture

**Database: Supabase PostgreSQL (existing)**
- Shared database instance accessed by Next.js (supabase-js) and Python worker (supabase-py)
- B2B tables: stores, store_credits, store_credit_transactions, store_generation_sessions, store_analytics_events, store_api_keys, store_shopper_credits, store_shopper_purchases
- B2C tables: users, user_credits, credit_transactions, generation_sessions, analytics_events
- Full table separation — no shared tables, no polymorphic columns
- Migrations managed via Supabase CLI (single source of truth)

**Data Validation:**
- Next.js API: Zod schemas for all B2B REST endpoints
- Python worker: Pydantic models for task payloads and API responses
- Database: PostgreSQL constraints + CHECK constraints for critical fields

**Caching Strategy:**
- Redis for rate limit counters (per-store, per-shopper)
- Redis as Celery broker (task queue)
- No application-level caching for MVP — Supabase handles query performance

**Migration Approach:**
- Supabase migration files (SQL) checked into wearon repo
- Sequential numbered migrations (existing pattern: 001, 002, 003...)
- New B2B tables added as migration 004+

### Authentication & Security

**B2C Authentication: Supabase Auth (existing)**
- Email/password + Google OAuth
- JWT-based sessions, RLS enforced
- No changes needed for B2B expansion

**B2B Merchant Authentication: Shopify OAuth**
- Shopify OAuth flow for app installation
- Session stored in stores table (shop domain, access token)
- Merchant accesses WearOn platform for onboarding/billing via separate auth (Supabase Auth account)

**B2B Plugin API Authentication: Domain-Restricted API Keys**
- Format: wk_ + 32-char random hex (e.g., wk_a1b2c3d4...)
- Hashed (SHA-256) in store_api_keys table, never stored in plaintext
- API middleware: resolve API key → store_id, enforce store_id in all queries
- CORS whitelisting: only requests from registered store domain accepted
- Rotatable: merchant can regenerate API key from WearOn platform

**B2B Worker Authentication: Service Role Key**
- Python worker uses Supabase service role key (bypasses RLS)
- Application-level store_id scoping enforced in code, not RLS
- Worker only receives pre-validated task payloads from API

**Data Encryption:**
- TLS for all API communication (HTTPS enforced)
- Supabase handles at-rest encryption
- API keys hashed before storage
- Shopify access tokens encrypted at application level (AES-256) before storing in stores table

### API & Communication Patterns

**B2B REST API: Next.js API Routes (/api/v1/*)**
- RESTful design with versioned endpoints
- JSON request/response format
- Endpoints: /api/v1/generation/create, /api/v1/generation/{id} (status polling — plugin polls every 2s, 60s timeout), /api/v1/size-rec (proxies to FastAPI on worker), /api/v1/credits/balance, /api/v1/stores/config
- Webhook endpoints: /api/v1/webhooks/shopify/orders, /api/v1/webhooks/shopify/app (app/uninstalled → revoke API keys, mark store inactive, cleanup queued jobs)

**B2C API: tRPC (existing, unchanged)**
- Type-safe end-to-end API via tRPC
- No changes for B2B expansion

**Cross-Language Queue: Simple Redis + Celery (Python-side only)**
- Single Python worker handles all generation jobs (replaces existing TypeScript BullMQ worker)
- Next.js API pushes plain JSON messages to Redis via LPUSH (ioredis) — no Celery protocol from Node.js
- Python worker reads from Redis via BRPOP in a simple consumer loop, dispatches to Celery tasks internally
- Celery used only on Python side for retries, rate limiting, and worker management
- Task payload: { channel: "b2b"|"b2c", store_id|user_id, session_id, image_urls, prompt, version: 1 }
- Result storage: Worker writes results directly to Supabase (not Redis result backend)
- B2C tRPC generation endpoint updated to push to Redis queue instead of BullMQ

**Error Handling Standards:**
- Consistent error response format: { error: { code, message, details? } }
- HTTP status codes: 400 (validation), 401 (auth), 403 (forbidden), 404 (not found), 429 (rate limit), 500 (server)
- Moderation blocks: 422 with specific moderation error code
- Credit refund on any generation failure

**Rate Limiting:**
- Layer 1 (API middleware): Per-store tier limits + per-shopper email limits via Redis INCR with TTL
- Layer 2 (Celery worker): Global OpenAI rate limit (300 req/min) via custom Celery rate limiting or Redis token bucket
- Rate limit headers in API responses (X-RateLimit-Limit, X-RateLimit-Remaining)

### Frontend Architecture

**WearOn Platform (apps/next — existing):**
- Next.js App Router with React 19
- Tamagui for UI components
- tRPC client for B2C API calls
- New pages: merchant onboarding, billing/subscription management, API key management

**WearOn Mobile App (apps/expo — existing):**
- Expo SDK 53 with Expo Router
- Tamagui shared components
- No changes for B2B expansion

**Shopify Plugin Storefront (wearon-shopify theme app extension):**
- Preact or vanilla JS for minimal bundle (<50KB gzipped)
- App embed block on product pages
- Shadow DOM or scoped styles for CSS isolation
- Calls Shopify app's server-side proxy (React Router backend) — proxy holds API key and forwards to WearOn API
- Shopper email resolved server-side by proxy, never in client JS
- Proxy latency budget: <100ms. WearOn API responds immediately after queueing (<200ms). Total queue time <500ms

**Shopify Plugin Admin (wearon-shopify App Bridge):**
- Polaris React components (native Shopify look)
- App Bridge v4 for embedded admin experience
- Dashboard cards: credit balance, usage stats, recent generations
- Settings: API key display, rate limit config, mode selection (absorb/resell)

### Infrastructure & Deployment

**WearOn Platform: Vercel (existing)**
- Next.js app deployed as serverless functions
- API routes (/api/v1/*, /api/trpc) run as serverless functions
- Environment variables managed via Vercel dashboard
- Automatic deployments from Git

**Python Worker: DigitalOcean App Platform**
- Managed Docker deployment with auto-deploy from Git (no raw Droplet management)
- Single container running Redis consumer + Celery + FastAPI server
- Redis connection to managed Redis instance (provider TBD)
- MediaPipe model loaded once on process startup, stays warm in memory
- FastAPI `/health` endpoint checks Redis connection + MediaPipe model loaded — App Platform auto-restarts on failure
- Built-in logging and alerting (no manual Supervisor/systemd config)
- Benchmark memory/CPU requirements before choosing plan (MediaPipe + Celery + FastAPI). Fallback: Droplet with Docker Compose + GitHub Actions auto-deploy

**Shopify Plugin: Shopify Infrastructure**
- Hosted and deployed via Shopify CLI
- Theme app extension served from Shopify CDN
- App Bridge pages rendered within Shopify Admin

**Redis: Managed Service (provider TBD)**
- Used for: Celery broker, rate limit counters
- Single Redis instance shared across all services

**CI/CD:**
- wearon: Vercel auto-deploys from Git (existing)
- wearon-worker: DigitalOcean App Platform auto-deploys from Git on push to main
- wearon-shopify: `shopify app deploy` via Makefile (manual or GitHub Action)
- Cross-language integration test: GitHub Action on wearon repo spins up Redis + Python worker container, pushes sample task from Node.js, verifies Python processes it

**Monitoring & Logging:**
- Vercel: Built-in function logs and analytics
- DigitalOcean App Platform: Built-in application logs and alerts
- Celery: Flower dashboard for task monitoring (optional, post-MVP)
- Supabase: Built-in database monitoring

**Scaling Strategy (Post-MVP):**
- Vercel auto-scales serverless functions
- DigitalOcean App Platform: Vertical scaling (larger container) → Horizontal scaling (multiple instances with Celery concurrency)
- Redis: scales via managed service plan upgrade

### Resilience & Failure Handling

**Celery Worker:**
- `acks_late=True` — tasks requeued if worker dies before completion
- `task_time_limit=60` — prevents stuck jobs
- Startup cleanup: query Supabase for sessions stuck in "processing" >2 min → refund credits, mark failed
- App Platform auto-restarts on health check failure

**Redis Unavailability:**
- Next.js API catches Redis connection errors → returns 503 "temporarily unavailable"
- Rate limit counters auto-recover (TTL-based, no state to restore)
- No data loss — generation sessions live in Supabase, only queue is in Redis
- Size rec unaffected (FastAPI → MediaPipe is direct, no Redis)

**OpenAI API Failures:**
- 429 (rate limit): Celery retry with exponential backoff, max 3 retries
- 500 (server error): Retry once, then fail
- Moderation block: No retry, refund credit, user-friendly message
- All final failures: refund credit, mark session failed

**Size Rec Proxy:**
- Next.js sets 5s timeout on FastAPI proxy call
- FastAPI down → 503 to plugin → "size recommendation temporarily unavailable"
- Size rec independent of generation — partial degradation only

**Webhook Reliability (Resell Mode):**
- HMAC-SHA256 signature verification on every webhook (Shopify signs with app secret)
- Primary: Shopify webhook delivers → verify signature → credits added immediately
- Fallback: Plugin polls WearOn API → WearOn verifies via Shopify Admin API → credits added
- Idempotent: shopify_order_id as unique key prevents double-credit
- Shopify retries webhooks up to 19 times over 48 hours

**Cross-Language Queue Integrity:**
- Pydantic validation on Python side — malformed tasks fail immediately with logged error
- Integration test in CI: push sample task from Node.js, verify Python worker processes it
- Session status monitoring: if "queued" status doesn't change within timeout → frontend shows error

### Operational Practices (Solo Dev)

**Local Development:**
- wearon: `yarn web` (existing)
- wearon-worker: `docker-compose up` (Celery + FastAPI + Redis in one command)
- wearon-shopify: `shopify app dev` (Shopify CLI handles tunnel)
- Three terminals, one command each. Shared Supabase cloud instance.

**Cross-Repo Debugging:**
- Correlation ID (request_id) generated at entry point, passed through every hop: plugin → API header → Redis task → worker logs → Supabase session
- Grep for request_id across Vercel logs, App Platform logs, and Supabase to trace full request lifecycle

**B2C Migration Strategy:**
- Feature flag (USE_PYTHON_WORKER) to switch B2C between BullMQ and Redis queue
- Run both workers in parallel during migration — BullMQ handles existing jobs, Python handles new ones
- Python worker must be output-compatible with existing TS worker (same column values, same status flow, same Realtime triggers)
- Roll back instantly by toggling feature flag

**Deployment Coordination:**
- Always deploy worker first, API second — worker handles both old and new task formats during transition
- Task payload includes `version` field for backward-compatible migrations
- Plugin is independent — only depends on versioned REST API contract (/api/v1/)

**Dev Experience:**
- `Makefile` in each repo: `make dev`, `make test`, `make deploy`
- Shared `.env.example` across repos with same Supabase and Redis URLs

### Decision Impact Analysis

**Implementation Sequence:**
1. Supabase migration for B2B tables (foundation for everything)
2. Python worker repo setup (Redis consumer + Celery + FastAPI + MediaPipe)
3. Migrate B2C generation flow from BullMQ to Redis queue (feature flag: USE_PYTHON_WORKER=true/false, run both workers in parallel during transition, validate output compatibility)
4. B2B REST API endpoints in Next.js (/api/v1/*)
5. Cross-language queue integration (Next.js LPUSH → Redis → Python BRPOP)
6. Submit skeleton Shopify app for early App Store review (OAuth + empty admin page + basic theme extension — validates billing model before building)
7. Shopify OAuth + merchant onboarding flow
8. Plugin storefront UI (theme app extension) — absorb mode only for MVP
9. Billing integration (Paddle on WearOn platform)
10. Resell mode (Phase 2 — webhook + shopper credits + hidden products)

**Cross-Component Dependencies:**
- Python worker depends on: Supabase (tables + service role key), Redis (Celery broker), OpenAI API, MediaPipe (pose estimation)
- B2B REST API depends on: Supabase (store_api_keys for auth), Redis (rate limiting + task pushing)
- Shopify plugin depends on: B2B REST API (all operations), Shopify Admin API (hidden products, webhooks)
- Billing depends on: stores table (subscription tier), Paddle API
- Resell mode depends on: Shopify webhooks, store_shopper_credits table, B2B REST API

## Implementation Patterns & Consistency Rules

### Critical Conflict Points Identified

**18 areas** where AI agents working across three repos (wearon, wearon-shopify, wearon-worker) could make incompatible choices. Patterns below eliminate ambiguity.

### Naming Patterns

**Database Naming (Supabase PostgreSQL):**
- Tables: `snake_case`, plural (`store_credits`, `generation_sessions`)
- Columns: `snake_case` (`store_id`, `created_at`, `credit_balance`)
- Foreign keys: `{referenced_table_singular}_id` (`store_id`, `user_id`)
- Indexes: `idx_{table}_{columns}` (`idx_store_api_keys_key_hash`)
- Enums: `snake_case` values (`absorb_mode`, `resell_mode`)

**API Naming (B2B REST /api/v1/*):**
- Endpoints: plural nouns, `kebab-case` path segments (`/api/v1/generation/create`, `/api/v1/credits/balance`)
- Query parameters: `snake_case` (`?store_id=...&page_size=20`)
- JSON request/response fields: `snake_case` (`{ "store_id": "...", "session_id": "..." }`)
- Headers: `X-Request-Id`, `X-RateLimit-Remaining` (HTTP standard capitalization)

**Redis Task Payload:**
- All fields `snake_case` — shared contract between TypeScript and Python
- Example: `{ "channel": "b2b", "store_id": "...", "session_id": "...", "image_urls": [...], "version": 1 }`

**Code Naming:**
- TypeScript (wearon, wearon-shopify): `camelCase` variables/functions, `PascalCase` components/classes, `kebab-case` file names
- Python (wearon-worker): `snake_case` variables/functions/files, `PascalCase` classes
- Boundary conversion: TypeScript serializes to `snake_case` JSON before pushing to Redis or sending API responses. Use a thin `toSnakeCase`/`toCamelCase` utility at boundaries, not throughout codebase.

### Structure Patterns

**Test Directories:**
- wearon: `__tests__/` directory at package level (e.g., `packages/api/__tests__/`, `packages/app/__tests__/`)
- wearon-worker: `tests/` directory at project root (`tests/test_worker.py`, `tests/test_size_rec.py`)
- wearon-shopify: `__tests__/` following Shopify template convention
- Test file naming: `{feature}.test.ts` (TypeScript), `test_{feature}.py` (Python)

**Project Organization:**
- wearon: Feature-based in `packages/app/features/` (existing pattern)
- wearon-worker: Module-based (`worker/`, `size_rec/`, `services/`, `models/`)
- wearon-shopify: Shopify template structure (routes for App Bridge, extensions for theme app)

**Configuration:**
- Environment files: `.env.example` in each repo root, same variable names where shared (`SUPABASE_URL`, `REDIS_URL`)
- Each repo: `Makefile` with `make dev`, `make test`, `make deploy`

### Format Patterns

**API Response Format (B2B REST only — tRPC unchanged for B2C):**

Success:
```json
{ "data": { "session_id": "abc", "status": "queued" }, "error": null }
```

Error:
```json
{ "data": null, "error": { "code": "RATE_LIMIT_EXCEEDED", "message": "Store rate limit reached. Try again in 30s." } }
```

Error codes: `UPPER_SNAKE_CASE` strings (e.g., `INVALID_API_KEY`, `INSUFFICIENT_CREDITS`, `MODERATION_BLOCKED`, `RATE_LIMIT_EXCEEDED`, `INTERNAL_ERROR`)

HTTP status codes: 400 (validation), 401 (bad/missing API key), 403 (forbidden), 404 (not found), 422 (moderation block), 429 (rate limit), 500 (server), 503 (service unavailable)

**Date/Time Format:**
- All timestamps: ISO 8601 strings in UTC (`2026-02-09T14:30:00Z`)
- Database: `timestamptz` columns (PostgreSQL stores UTC)
- JSON responses: ISO 8601 string
- No Unix timestamps in API layer

**Null Handling:**
- JSON responses: include field with `null` value (don't omit the field)
- Database: prefer `NOT NULL` with defaults where possible

### Communication Patterns

**Redis Queue Contract (Cross-Language):**

Task pushed by Next.js (LPUSH):
```json
{
  "task_id": "uuid-v4",
  "channel": "b2b",
  "store_id": "store_abc",
  "session_id": "sess_123",
  "image_urls": ["https://...signed-url-1", "https://...signed-url-2"],
  "prompt": "...",
  "request_id": "req_xyz",
  "version": 1,
  "created_at": "2026-02-09T14:30:00Z"
}
```

Python worker validates with Pydantic model. Malformed tasks → log error with `request_id`, mark session failed, do not retry.

**Correlation ID (request_id):**
- Generated at entry point: `req_` + UUID v4 short (e.g., `req_a1b2c3d4`)
- Passed: API request header (`X-Request-Id`) → Redis task field (`request_id`) → worker logs → Supabase session metadata
- Every log line includes `request_id`
- If incoming request has no `X-Request-Id`, generate one

**Supabase Realtime Events:**
- Status field values: `queued`, `processing`, `completed`, `failed` (lowercase, no other values)
- Status transitions: `queued → processing → completed` or `queued → processing → failed`
- Both B2B and B2C use same status values in their respective session tables

### Process Patterns

**Error Handling:**
- TypeScript (API layer): try/catch at route handler level, return `{ data: null, error: { code, message } }` wrapper
- Python (worker): try/except in task function, log error with `request_id`, update session to `failed`, refund credit
- User-facing errors: human-readable `message` field in `error` object
- Internal errors: log full stack trace with `request_id`, return generic "Internal error" to client
- Moderation blocks: specific `MODERATION_BLOCKED` code, no retry, refund credit

**Credit Operations:**
- Always atomic: use Supabase RPC functions (`deduct_credits`, `refund_credits`)
- API deducts before queueing (never worker)
- Worker refunds on failure only
- Log every credit operation in transaction table with `request_id`

**Rate Limiting Response:**
- HTTP 429 with headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` (Unix timestamp)
- Response body: `{ "data": null, "error": { "code": "RATE_LIMIT_EXCEEDED", "message": "..." } }`

### Logging Patterns

**Format (all repos):**
```json
{ "level": "info", "request_id": "req_a1b2c3d4", "message": "Generation started", "timestamp": "2026-02-09T14:30:00Z", "repo": "wearon-worker", "extra": {} }
```

**Levels:**
- `error`: Failures requiring attention (failed generation, Redis down, OpenAI error)
- `warn`: Recoverable issues (rate limit hit, moderation block, retry triggered)
- `info`: Normal operations (generation queued, generation completed, credit deducted)
- `debug`: Development only (task payload, response body, timing)

**Libraries:**
- TypeScript (wearon): `pino` with `pino-pretty` for dev — fast, JSON output, Next.js compatible
- Python (wearon-worker): `structlog` for JSON output
- wearon-shopify: Shopify CLI built-in logging (no extra library)

**Rules:**
- No `console.log` in wearon (Biome enforces `noConsoleLog: error`) — use pino logger
- Python: structlog for JSON output
- Never log: API keys, access tokens, image URLs with signatures, shopper emails (log `shopper_email_hash` if needed)

### Enforcement Guidelines

**All AI Agents MUST:**
1. Use `snake_case` for all JSON fields in API requests/responses and Redis payloads
2. Include `request_id` in every log line and pass it through every hop
3. Use `{ data, error }` wrapper for all B2B REST responses
4. Use atomic Supabase RPC for credit operations (never raw UPDATE)
5. Never log secrets, tokens, or PII
6. Follow file naming convention of the repo's language (`kebab-case.tsx`, `snake_case.py`)

**Pattern Verification:**
- Cross-language integration test in CI: push sample task from Node.js, verify Python worker parses and processes it
- Biome lint catches `console.log` and enforces import type usage in TypeScript repos
- Pydantic strict mode catches snake_case violations in Python task models

### Pattern Examples

**Good:**
```typescript
// TypeScript API route - converts camelCase internal to snake_case response
const session = await createGeneration(storeId, imageUrls)
return NextResponse.json({
  data: { session_id: session.id, status: session.status },
  error: null
})
```

```python
# Python worker - snake_case native, Pydantic validates
class GenerationTask(BaseModel):
    task_id: str
    channel: Literal["b2b", "b2c"]
    store_id: str | None = None
    user_id: str | None = None
    session_id: str
    image_urls: list[str]
    request_id: str
    version: int = 1
```

**Anti-Patterns:**
```typescript
// BAD: camelCase in API response
return { sessionId: "...", storeId: "..." }

// BAD: missing request_id in log
console.log("Generation started")

// BAD: raw credit update
await supabase.from('store_credits').update({ balance: newBalance })
```

## Project Structure & Boundaries

### Repo 1: wearon (Existing Monorepo — Vercel)

```
wearon/
├── apps/
│   ├── next/                              # [web] Next.js 16 app (Vercel)
│   │   ├── app/
│   │   │   ├── (auth)/                    # Auth route group (existing)
│   │   │   │   ├── login/page.tsx
│   │   │   │   └── signup/page.tsx
│   │   │   ├── admin/                     # Admin panel (existing)
│   │   │   │   ├── layout.tsx
│   │   │   │   ├── page.tsx
│   │   │   │   ├── users/
│   │   │   │   ├── analytics/
│   │   │   │   ├── generations/
│   │   │   │   ├── credits/
│   │   │   │   └── settings/
│   │   │   ├── api/
│   │   │   │   ├── trpc/                  # tRPC handler (existing)
│   │   │   │   ├── auth/                  # OAuth callback (existing)
│   │   │   │   ├── cron/                  # Scheduled jobs (existing)
│   │   │   │   │   └── cleanup/route.ts
│   │   │   │   └── v1/                    # [NEW] B2B REST API
│   │   │   │       ├── generation/
│   │   │   │       │   ├── create/route.ts
│   │   │   │       │   └── [id]/route.ts
│   │   │   │       ├── size-rec/
│   │   │   │       │   └── route.ts       # Proxies to FastAPI on worker
│   │   │   │       ├── credits/
│   │   │   │       │   └── balance/route.ts
│   │   │   │       ├── stores/
│   │   │   │       │   └── config/route.ts
│   │   │   │       └── webhooks/
│   │   │   │           └── shopify/
│   │   │   │               ├── orders/route.ts   # [NEW] Resell mode
│   │   │   │               └── app/route.ts      # [NEW] App lifecycle
│   │   │   ├── (merchant)/                # [NEW] Merchant-facing pages
│   │   │   │   ├── onboarding/page.tsx
│   │   │   │   ├── billing/page.tsx
│   │   │   │   └── api-keys/page.tsx
│   │   │   ├── dashboard/                 # B2C dashboard (existing)
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx
│   │   │   └── not-found.tsx
│   │   ├── proxy.ts                       # Route protection (existing)
│   │   └── utils/supabase/                # Server-side clients (existing)
│   │
│   └── expo/                              # [mobile] Expo app (unchanged)
│       ├── app/
│       ├── scripts/
│       └── package.json
│
├── packages/
│   ├── api/
│   │   └── src/
│   │       ├── routers/
│   │       │   ├── _app.ts                # Router aggregation (existing)
│   │       │   ├── auth.ts                # B2C auth (existing)
│   │       │   ├── user.ts                # B2C user (existing)
│   │       │   ├── credits.ts             # B2C credits (existing)
│   │       │   ├── generation.ts          # B2C generation (existing, updated to use Redis queue)
│   │       │   ├── storage.ts             # File storage (existing)
│   │       │   ├── analytics.ts           # B2C analytics (existing)
│   │       │   └── roles.ts               # RBAC (existing)
│   │       ├── services/
│   │       │   ├── openai-image.ts        # OpenAI client (existing, shared)
│   │       │   ├── queue.ts               # BullMQ queue (existing, deprecated)
│   │       │   ├── redis-queue.ts         # [NEW] Redis LPUSH queue (replaces BullMQ)
│   │       │   ├── storage-cleanup.ts     # File expiry (existing)
│   │       │   └── shopify.ts             # [NEW] Shopify API client (@shopify/shopify-api)
│   │       ├── middleware/                 # [NEW] B2B middleware
│   │       │   ├── api-key-auth.ts        # API key → store_id resolution
│   │       │   ├── rate-limit.ts          # Per-store + per-shopper rate limiting
│   │       │   ├── cors.ts                # Domain-restricted CORS
│   │       │   └── request-id.ts          # Correlation ID generation
│   │       ├── workers/
│   │       │   └── generation.worker.ts   # BullMQ worker (existing, deprecated after migration)
│   │       ├── utils/
│   │       │   ├── rbac.ts                # Role/permission types (existing)
│   │       │   └── snake-case.ts          # [NEW] camelCase ↔ snake_case conversion
│   │       ├── types/                     # [NEW] Shared type definitions
│   │       │   ├── b2b.ts                 # B2B-specific types (store, API key, etc.)
│   │       │   └── queue.ts               # Redis task payload types
│   │       ├── trpc.ts                    # tRPC context (existing)
│   │       └── index.ts                   # Exports (existing)
│   │
│   ├── app/                               # [library] Shared logic
│   │   ├── features/
│   │   │   ├── admin/                     # Admin components (existing)
│   │   │   ├── auth/                      # Auth UI (existing)
│   │   │   ├── dashboard/                 # Dashboard (existing)
│   │   │   ├── home/                      # Home (existing)
│   │   │   ├── user/                      # User profile (existing)
│   │   │   └── merchant/                  # [NEW] Merchant pages
│   │   │       ├── onboarding-screen.tsx
│   │   │       ├── billing-screen.tsx
│   │   │       └── api-key-screen.tsx
│   │   ├── provider/                      # Providers (existing)
│   │   └── utils/                         # Utilities (existing)
│   │
│   ├── ui/                                # Tamagui components (existing)
│   └── config/                            # Tamagui config (existing)
│
├── supabase/
│   ├── migrations/
│   │   ├── 001_initial_schema.sql         # (existing)
│   │   ├── 002_rls_policies.sql           # (existing)
│   │   ├── 003_rbac_schema.sql            # (existing)
│   │   ├── 004_user_credit_update_policy.sql # (existing)
│   │   ├── 005_b2b_stores_schema.sql      # [NEW] stores, store_api_keys, store_credits
│   │   ├── 006_b2b_generation_schema.sql  # [NEW] store_generation_sessions, store_analytics_events
│   │   └── 007_b2b_resell_schema.sql      # [NEW] store_shopper_credits, store_shopper_purchases
│   └── README.md
│
├── __tests__/                             # [NEW] Test directories
│   ├── api/
│   │   ├── b2b-rest.test.ts               # B2B REST endpoint tests
│   │   ├── api-key-auth.test.ts           # API key middleware tests
│   │   └── rate-limit.test.ts             # Rate limiting tests
│   ├── integration/
│   │   └── redis-queue.test.ts            # Cross-language queue contract test
│   └── e2e/                               # Playwright E2E (existing structure)
│
├── CLAUDE.md
├── Makefile                               # [NEW] make dev, make test, make deploy
├── package.json
├── turbo.json
├── biome.json
├── tsconfig.json
└── .env.example                           # Updated with REDIS_URL, SHOPIFY vars
```

### Repo 2: wearon-shopify (New — Shopify CLI)

```
wearon-shopify/
├── app/                                   # React Router (Remix v7) app
│   ├── routes/                            # App Bridge admin pages
│   │   ├── app._index.tsx                 # Main admin page (dashboard cards)
│   │   ├── app.settings.tsx               # API key config, mode selection, rate limits
│   │   ├── app.billing.tsx                # Link to WearOn platform billing
│   │   └── webhooks.tsx                   # Webhook registration handler
│   ├── services/
│   │   └── wearon-api.ts                  # WearOn B2B REST API client (server-side only)
│   ├── utils/
│   │   └── hmac.ts                        # Webhook HMAC verification
│   └── root.tsx                           # App root with Polaris provider
│
├── extensions/
│   └── wearon-tryon/                      # Theme App Extension (storefront)
│       ├── blocks/
│       │   └── tryon-block.liquid         # App embed block for product pages
│       ├── assets/
│       │   ├── tryon-widget.js            # Preact/vanilla JS try-on UI (<50KB gzipped)
│       │   ├── size-rec-widget.js         # Size rec UI (lightweight)
│       │   └── styles.css                 # Scoped styles
│       └── locales/
│           └── en.default.json            # i18n strings
│
├── __tests__/
│   ├── routes/
│   │   └── app.settings.test.tsx
│   └── services/
│       └── wearon-api.test.ts
│
├── shopify.app.toml                       # Shopify app config
├── Makefile                               # make dev, make test, make deploy
├── package.json
├── .env.example                           # WEARON_API_URL, WEARON_API_KEY (dev)
├── .gitignore
└── README.md
```

### Repo 3: wearon-worker (New — DigitalOcean App Platform)

```
wearon-worker/
├── worker/
│   ├── consumer.py                        # Redis BRPOP consumer loop → dispatches to Celery
│   ├── tasks.py                           # Celery task definitions (generation, cleanup)
│   ├── celery_app.py                      # Celery config (broker, rate limits, acks_late)
│   └── startup.py                         # Startup cleanup (stuck sessions → refund)
│
├── size_rec/
│   ├── app.py                             # FastAPI app (health check + size rec endpoint)
│   ├── mediapipe_service.py               # MediaPipe pose estimation (33 3D landmarks)
│   └── size_calculator.py                 # Landmarks → size recommendation logic
│
├── services/
│   ├── supabase_client.py                 # supabase-py client (service role key)
│   ├── openai_client.py                   # OpenAI GPT Image 1.5 API calls
│   ├── redis_client.py                    # Redis connection (shared consumer + rate limiter)
│   └── image_processor.py                 # Pillow — resize to 1024px for cost optimization
│
├── models/
│   ├── task_payload.py                    # Pydantic: GenerationTask (strict validation)
│   ├── generation.py                      # Pydantic: session status, result models
│   └── size_rec.py                        # Pydantic: size rec request/response
│
├── config/
│   ├── settings.py                        # Pydantic Settings (env vars)
│   └── logging_config.py                  # structlog JSON formatter setup
│
├── tests/
│   ├── test_consumer.py                   # Redis consumer tests
│   ├── test_tasks.py                      # Celery task tests
│   ├── test_size_rec.py                   # MediaPipe + size calc tests
│   └── test_task_payload.py               # Pydantic model validation tests
│
├── main.py                                # Entrypoint: starts Redis consumer + Celery + FastAPI
├── Dockerfile                             # Multi-stage build for App Platform
├── docker-compose.yml                     # Local dev: worker + Redis
├── Makefile                               # make dev, make test, make deploy
├── requirements.txt                       # Python dependencies
├── pyproject.toml                         # Python project config
├── .env.example                           # SUPABASE_URL, REDIS_URL, OPENAI_API_KEY, etc.
├── .gitignore
└── README.md
```

### Architectural Boundaries

**API Boundaries:**

| Boundary | From → To | Protocol | Auth |
|---|---|---|---|
| B2C Frontend → API | apps/next, apps/expo → packages/api | tRPC | Supabase JWT |
| B2B Plugin → Shopify App | theme extension → wearon-shopify/app | HTTP (same-origin) | Shopify session |
| Shopify App → WearOn API | wearon-shopify → wearon /api/v1/ | REST (HTTPS) | API key (server-side) |
| WearOn API → Redis | packages/api → Redis | LPUSH (JSON) | Direct connection |
| Redis → Python Worker | Redis → wearon-worker | BRPOP (JSON) | Direct connection |
| Python Worker → Supabase | wearon-worker → Supabase | supabase-py | Service role key |
| WearOn API → FastAPI | /api/v1/size-rec → wearon-worker | HTTP proxy | Internal network |
| Shopify → Webhooks | Shopify → /api/v1/webhooks/ | HTTPS POST | HMAC-SHA256 |
| Merchant → WearOn Platform | Browser → apps/next/(merchant) | Next.js pages | Supabase Auth |
| Merchant → Payment Provider | WearOn platform → Paddle API | HTTPS | Provider secret key |

**Data Boundaries:**

| Data Domain | Tables | Accessed By | Auth Method |
|---|---|---|---|
| B2C Users | users, user_credits, credit_transactions, generation_sessions, analytics_events | wearon (supabase-js), wearon-worker (supabase-py) | Supabase JWT (web), service role (worker) |
| B2B Stores | stores, store_api_keys, store_credits, store_credit_transactions, store_generation_sessions, store_analytics_events | wearon (supabase-js), wearon-worker (supabase-py) | Service role + app-level store_id scoping |
| B2B Shoppers | store_shopper_credits, store_shopper_purchases | wearon (supabase-js) | Service role + store_id + shopper_email |
| RBAC | roles, permissions, role_permissions, user_roles | wearon (supabase-js) | Supabase RPC |

**Storage Boundaries (Supabase Storage):**
- B2C uploads: `uploads/{user_id}/`
- B2C generated: `generated/{user_id}/`
- B2B uploads: `stores/{store_id}/uploads/`
- B2B generated: `stores/{store_id}/generated/`

### FR Category → Structure Mapping

| FR Category | wearon | wearon-shopify | wearon-worker |
|---|---|---|---|
| **Store Management** | /api/v1/stores/, packages/api/middleware/, supabase/migrations/005 | app/routes/app.settings.tsx | — |
| **Plugin UI** | — | extensions/wearon-tryon/ (all blocks + assets) | — |
| **Authentication (B2B)** | /api/v1/ middleware (api-key-auth.ts, cors.ts), packages/api/services/shopify.ts | app/routes/webhooks.tsx, app/services/wearon-api.ts | — |
| **Credit & Billing** | /api/v1/credits/, packages/app/features/merchant/billing-screen.tsx, supabase/migrations/005-007 | app/routes/app.billing.tsx | worker/tasks.py (refund on failure) |
| **Generation Pipeline** | /api/v1/generation/, packages/api/services/redis-queue.ts | extensions/wearon-tryon/assets/tryon-widget.js | worker/consumer.py, worker/tasks.py, services/openai_client.py |
| **Size Recommendation** | /api/v1/size-rec/ (proxy) | extensions/wearon-tryon/assets/size-rec-widget.js | size_rec/app.py, size_rec/mediapipe_service.py |
| **Analytics** | packages/api/routers/analytics.ts (extended for B2B), admin panel | app/routes/app._index.tsx (dashboard cards) | — |
| **Admin/Moderation** | apps/next/app/admin/ (existing, extended for B2B store view) | — | — |

### Data Flow

```
[Shopify Storefront]
    │
    ▼
[Theme App Extension] ──HTTP──▶ [wearon-shopify App Server]
                                    │ (holds API key, resolves email)
                                    ▼
                               [WearOn /api/v1/*] ──LPUSH──▶ [Redis]
                                    │                           │
                                    │                        BRPOP
                                    │                           │
                                    │                           ▼
                                    │                    [Python Worker]
                                    │                    ├─ Celery (generation)
                                    │                    └─ FastAPI (size rec)
                                    │                           │
                                    ▼                           ▼
                               [Supabase] ◀───────────── [supabase-py]
                               (DB, Storage, Realtime)
```

## Architecture Validation Results

### Coherence Validation: PASS

**Decision Compatibility:**
- Three-repo architecture with clear ownership (wearon/Vercel, wearon-shopify/Shopify, wearon-worker/DigitalOcean)
- Cross-language bridge uses simplest possible pattern (LPUSH/BRPOP plain JSON) — no protocol risks
- Celery isolated to Python side only — no cross-language Celery protocol from Node.js
- Both languages access Supabase with appropriate clients (supabase-js, supabase-py)
- Server-side proxy pattern consistently prevents API key leakage

**Pattern Consistency:**
- snake_case enforced at every data boundary (DB, API JSON, Redis payloads)
- `{ data, error }` wrapper for all B2B REST endpoints
- request_id correlation traced from entry to worker to DB
- Structured JSON logging (pino for TS, structlog for Python) across all repos
- Status values (`queued`, `processing`, `completed`, `failed`) shared between B2B and B2C tables

**Structure Alignment:**
- Project trees match architectural decisions (middleware dir for B2B auth, services for shopify/redis-queue)
- Test directories follow language conventions (__tests__/ for TS, tests/ for Python)
- Storage paths properly segmented (stores/{store_id}/ for B2B)
- No contradictory decisions found

### Requirements Coverage: PASS

**FR Categories (8/8 covered):**

| Category | Architectural Support | Status |
|---|---|---|
| Store Management | /api/v1/stores/, middleware, migrations 005 | COVERED |
| Plugin UI | extensions/wearon-tryon/ (Preact/vanilla JS) | COVERED |
| Authentication (B2B) | API key middleware, Shopify OAuth, HMAC webhooks | COVERED |
| Credit & Billing | /api/v1/credits/, Paddle billing, RPC functions, resell mode tables | COVERED |
| Generation Pipeline | Redis queue, Python worker, OpenAI, channel-aware routing | COVERED |
| Size Recommendation | FastAPI + MediaPipe on worker, Next.js proxy | COVERED |
| Analytics | Extended analytics router, separate B2B/B2C event tables | COVERED |
| Admin/Moderation | Existing admin panel extended for B2B store views | COVERED |

**NFR Validation (Key Items):**

| NFR | Architectural Support | Status |
|---|---|---|
| Plugin load <2s on 3G | Preact/vanilla JS <50KB gzipped, Shopify CDN | COVERED |
| Size rec <1s | FastAPI + MediaPipe on persistent worker, model warm in memory | COVERED |
| Generation <10s | Existing pipeline, proxy latency budget (<100ms + <200ms + <500ms) | COVERED |
| 99.5% API uptime | App Platform auto-restart, health checks, Vercel auto-scaling | COVERED |
| WCAG 2.1 AA | Plugin UI accessibility requirements noted | COVERED (design-time) |
| Domain-restricted API keys | middleware/api-key-auth.ts + middleware/cors.ts | COVERED |
| 200 stores / 100 concurrent gen | Rate limiting + scaling strategy (vertical → horizontal) | COVERED |
| GDPR/CCPA/COPPA | 6-hour auto-delete, privacy disclosure, age gating | COVERED |

### Implementation Readiness: PASS

**Decision Completeness:**
- All critical decisions documented with technology choices and rationale (5 ADRs, 4 first-principles)
- Implementation patterns comprehensive with concrete code examples
- Consistency rules clear and enforceable (6 mandatory rules, 3 verification methods)

**Structure Completeness:**
- Complete directory trees for all three repos with [NEW] markers for B2B additions
- All files and directories defined with purpose annotations
- Integration points mapped in boundary tables (10 API boundaries, 4 data domains)

**Pattern Completeness:**
- All cross-language conflict points addressed (naming, format, logging)
- Redis task payload contract specified with Pydantic model example
- Error handling, credit operations, and rate limiting patterns fully specified
- Good/bad code examples provided for critical patterns

### Gap Analysis: ALL RESOLVED

| Gap | Resolution |
|---|---|
| TypeScript structured logger unspecified | pino with pino-pretty for dev |
| CI/CD pipeline undefined for new repos | Auto-deploy per repo + cross-language integration test in GitHub Actions |
| Plugin generation status polling undefined | /api/v1/generation/{id}, 2s polling interval, 60s timeout |
| App uninstall webhook behavior undocumented | Revoke API keys, mark store inactive, cleanup queued jobs |

### Architecture Completeness Checklist

**Requirements Analysis:**
- [x] Project context thoroughly analyzed (53 FRs, 34 NFRs)
- [x] Scale and complexity assessed (medium-high, 12-15 components)
- [x] Technical constraints identified (brownfield monorepo, Shopify API, solo developer)
- [x] Cross-cutting concerns mapped (8 concerns)

**Architectural Decisions:**
- [x] Critical decisions documented with rationale (5 ADRs + 4 first-principles)
- [x] Technology stack fully specified (Next.js 16, Python/Celery/FastAPI, Shopify React Router)
- [x] Integration patterns defined (LPUSH/BRPOP, HTTP proxy, webhooks)
- [x] Performance considerations addressed (latency budget, warm model, rate limiting)
- [x] Security architecture validated (server-side proxy, HMAC, AES-256, no client secrets)

**Implementation Patterns:**
- [x] Naming conventions established (snake_case boundaries, language-native internal)
- [x] Structure patterns defined (feature-based TS, module-based Python)
- [x] Communication patterns specified (Redis contract, correlation ID, Realtime status)
- [x] Process patterns documented (error handling, credit operations, rate limiting)
- [x] Logging patterns specified (pino/structlog, JSON format, levels)

**Project Structure:**
- [x] Complete directory structure for all three repos
- [x] Component boundaries established (10 API boundaries, 4 data domains)
- [x] Integration points mapped (boundary tables)
- [x] Requirements to structure mapping complete (8 FR categories → files)

**Resilience & Operations:**
- [x] Failure handling documented (Celery, Redis, OpenAI, webhooks, queue integrity)
- [x] B2C migration strategy defined (feature flag, parallel workers)
- [x] Operational practices specified (local dev, debugging, deployment coordination)
- [x] CI/CD approach defined (auto-deploy + integration testing)

### Architecture Readiness Assessment

**Overall Status:** READY FOR IMPLEMENTATION

**Confidence Level:** HIGH

**Key Strengths:**
- Simplest possible cross-language integration (plain JSON over Redis)
- Clear three-repo separation with single responsibility per repo
- Security-first design (server-side proxy, no client secrets, HMAC webhooks)
- Solo-dev friendly (managed services, auto-deploy, Makefile conventions)
- Existing B2C system preserved with clean migration path (feature flag)

**Areas for Future Enhancement (Post-MVP):**
- Worker auto-scaling (horizontal Celery workers)
- CDN for generated images
- Health monitoring and alerting tooling (Flower, custom dashboards)
- Multi-region deployment
- Redis provider selection (benchmark Upstash vs DigitalOcean Managed Redis)

### Implementation Handoff

**AI Agent Guidelines:**
- Follow all architectural decisions exactly as documented
- Use implementation patterns consistently across all components
- Respect project structure and boundaries
- Refer to this document for all architectural questions
- Use snake_case at all data boundaries, language-native conventions internally
- Include request_id in every log line and pass through every hop

**First Implementation Priority:**
1. Supabase migration for B2B tables (migration 005)
2. Python worker repo setup (Redis consumer + Celery + FastAPI + MediaPipe)
3. B2C migration from BullMQ to Redis queue (feature flag)

## Architecture Completion Summary

### Workflow Completion

**Architecture Decision Workflow:** COMPLETED
**Total Steps Completed:** 8
**Date Completed:** 2026-02-09
**Document Location:** docs/_bmad/planning-artifacts/architecture.md

### Final Architecture Deliverables

**Complete Architecture Document:**
- 9 architectural decisions documented (5 ADRs + 4 first-principles)
- 18 implementation patterns defined for cross-repo consistency
- 3 complete project directory trees (wearon, wearon-shopify, wearon-worker)
- 8 FR categories mapped to specific files and directories
- 8 key NFRs validated with architectural support
- 8 cross-cutting concerns addressed

**Implementation Ready Foundation:**
- Three-repo architecture with clear ownership and deployment targets
- Cross-language queue contract (TypeScript → Redis → Python) with Pydantic validation
- Security architecture (server-side proxy, HMAC webhooks, AES-256 encryption)
- Resilience patterns (failure handling, B2C migration strategy, operational practices)
- CI/CD approach (auto-deploy + cross-language integration testing)

### Development Sequence

1. Supabase migration for B2B tables (migration 005)
2. Python worker repo setup (Redis consumer + Celery + FastAPI + MediaPipe)
3. Migrate B2C generation from BullMQ to Redis queue (feature flag)
4. B2B REST API endpoints in Next.js (/api/v1/*)
5. Cross-language queue integration (LPUSH → Redis → BRPOP)
6. Submit skeleton Shopify app for early App Store review
7. Shopify OAuth + merchant onboarding flow
8. Plugin storefront UI (theme app extension) — absorb mode only
9. Billing integration (Paddle on WearOn platform)
10. Resell mode (Phase 2)

---

**Architecture Status:** READY FOR IMPLEMENTATION

**Next Phase:** Create epics and stories from this architecture, then begin implementation.

**Document Maintenance:** Update this architecture when major technical decisions change during implementation.
