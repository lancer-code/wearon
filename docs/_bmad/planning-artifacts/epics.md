---
stepsCompleted: [1, 2, 3, 4]
inputDocuments:
  - docs/_bmad/planning-artifacts/prd.md
  - docs/_bmad/planning-artifacts/architecture.md
  - docs/project-context.md
  - docs/_bmad/analysis/brainstorming-session-2026-02-07.md
---

# WearOn - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for WearOn, decomposing the requirements from the PRD and Architecture into implementable stories.

## Requirements Inventory

### Functional Requirements

**Store Onboarding & Lifecycle (FR1-FR6)**

- FR1: Store owner can install WearOn via Shopify App Store with OAuth authorization
- FR2: Store owner can complete merchant onboarding in 3 steps or fewer
- FR3: Store owner can configure billing mode (absorb cost or resell credits to shoppers)
- FR4: Store owner can set retail credit price when resell mode is enabled
- FR5: Store owner can access and manage their merchant dashboard
- FR6: System can remove all store data when plugin is uninstalled

**Credit & Billing Management (FR7-FR16)**

- FR7: Store owner can subscribe to a credit plan (Starter, Growth, Scale, or Enterprise)
- FR8: Store owner can purchase pay-as-you-go credit packs without a subscription
- FR9: Store owner can upgrade or downgrade their subscription tier
- FR10: System can deduct credits automatically per generation request
- FR11: System can refund credits automatically when a generation fails or is blocked
- FR12: System can create a "Try-On Credit" digital product in the store's Shopify catalog when resell mode is enabled
- FR13: System can process Shopify order webhooks to confirm shopper credit purchases in resell mode
- FR14: B2C user can purchase credit packs within the mobile app
- FR15: B2C user can receive free starter credits on signup
- FR16: System can charge overage rates when a store exceeds subscription credit allocation

**Virtual Try-On Generation (FR17-FR24)**

- FR17: Shopper can request a virtual try-on through the store widget
- FR18: B2C user can request a virtual try-on through the mobile app
- FR19: B2C user can upload an outfit image from any source for try-on
- FR20: System can queue generation jobs with per-store rate limiting
- FR21: System can process generation jobs via background worker
- FR22: System can notify users of generation completion in real-time
- FR23: System can detect moderation blocks and display user-friendly messaging
- FR24: System can auto-delete all uploaded and generated images after 6 hours

**Size Recommendation (FR25-FR30)**

- FR25: Shopper can receive a size recommendation from a single photo and height input
- FR26: System can estimate body measurements from a single photo using pose detection
- FR27: System can display a confidence range when size confidence is below threshold
- FR28: B2C user can save a body profile for reuse across future try-ons
- FR29: System can provide size recommendations without queuing (real-time response)
- FR30: System can display a size recommendation disclaimer

**Embeddable Widget (FR31-FR38)**

- FR31: Widget can load automatically on store product pages after plugin installation
- FR32: Widget can operate in sandboxed mode without conflicting with store CSS or theme
- FR33: Widget can guide the user through camera capture with pose overlay
- FR34: Widget can display privacy disclosure before accessing the camera
- FR35: Widget can operate in zero-friction mode (no account required) when store absorbs cost
- FR36: Widget can collect shopper account creation when store uses resell mode
- FR37: Widget can display "Powered by WearOn" badge
- FR38: Widget can support screen readers, keyboard navigation, and proper contrast ratios

**Analytics & Insights (FR39-FR45)**

- FR39: Store owner can view store-level analytics (generation count, credit usage, conversion tracking)
- FR40: B2C user can view personal generation history and statistics
- FR41: Platform admin can view aggregated B2B analytics with store-by-store breakdown
- FR42: Platform admin can view aggregated B2C analytics (user growth, credit purchases, generation stats)
- FR43: Platform admin can view revenue dashboard (B2B wholesale + B2C credit packs, costs, margin)
- FR44: Platform admin can view quality metrics (success rate, moderation blocks, refunds)
- FR45: System can flag stores with sudden usage drops as churn risk

**Account & Access Management (FR46-FR51)**

- FR46: Store owner can authenticate via Shopify OAuth
- FR47: System can issue domain-restricted API keys per store
- FR48: System can enforce CORS whitelisting per store domain
- FR49: B2C user can sign up and authenticate via email or Google OAuth
- FR50: Platform admin can manage stores, users, and roles via admin panel
- FR51: System can enforce rate limits per store based on subscription tier

**Privacy & Compliance (FR52-FR53)**

- FR52: System can provide GDPR/CCPA privacy policy template for stores to embed
- FR53: System can block users under 13 from using try-on features (COPPA compliance)

### NonFunctional Requirements

**Performance (NFR1-NFR5)**

- NFR1: Widget initial load <2s on 3G mobile
- NFR2: Size rec response <1s (real-time)
- NFR3: Try-on generation <10s end-to-end
- NFR4: B2B API response (non-generation) <500ms
- NFR5: Merchant dashboard page load <3s

**Security (NFR6-NFR12)**

- NFR6: All data encrypted at rest and in transit (TLS 1.2+)
- NFR7: API keys are domain-restricted and rotatable by store owner
- NFR8: Store data isolation enforced at query level (no cross-tenant data access)
- NFR9: User photos encrypted in transit, never stored beyond 6-hour auto-delete window
- NFR10: OWASP Top 10 compliance across all endpoints
- NFR11: Webhook payloads validated with HMAC signature verification (Shopify webhooks)
- NFR12: Rate limiting enforced per API key based on subscription tier

**Scalability (NFR13-NFR17)**

- NFR13: Concurrent active stores: 200 (Growth phase)
- NFR14: Concurrent generation requests: 100 across all stores
- NFR15: Queue buffer capacity: 10x normal load during spikes
- NFR16: Worker scaling: Horizontal via additional worker instances
- NFR17: Storage: Path-based isolation supports unlimited stores without migration

**Accessibility (NFR18-NFR23)**

- NFR18: WCAG 2.1 Level AA compliance for embeddable widget
- NFR19: Screen reader support for all widget interactions
- NFR20: Full keyboard navigation (no mouse-only actions)
- NFR21: Minimum 4.5:1 contrast ratio for all text elements
- NFR22: Touch targets minimum 44x44px on mobile
- NFR23: Pose guidance overlay must have audio alternative for visually impaired users

**Integration (NFR24-NFR28)**

- NFR24: Shopify API version pinned with deprecation monitoring; graceful handling of API changes
- NFR25: OpenAI GPT Image 1.5: Retry on 429 (rate limit) only; immediate fail + refund on all other errors
- NFR26: Shopify Webhooks: Delivery confirmation with idempotent processing; handle duplicate deliveries
- NFR27: Supabase Realtime: Primary notification channel; auto-fallback to polling after 10s timeout
- NFR28: Redis: Persistent queue; jobs survive worker restart without loss

**Reliability (NFR29-NFR34)**

- NFR29: 99.5% API uptime (excluding planned maintenance windows)
- NFR30: Widget failure must never break the host store page (sandboxed isolation)
- NFR31: Automatic credit refund on any generation failure within 30 seconds
- NFR32: Graceful degradation: if generation service is down, size recommendation still functions independently
- NFR33: Zero data loss on worker restart (pending jobs cleaned and refunded on startup)
- NFR34: Uninstall hook completes full data cleanup within 60 seconds

### Additional Requirements

**From Architecture:**

- AR1: Three-repo architecture: wearon (Vercel), wearon-shopify (Shopify CLI), wearon-worker (DigitalOcean App Platform) — each repo has clear ownership and deployment target
- AR2: Python worker (Celery + FastAPI) replaces existing TypeScript BullMQ worker — single worker handles both B2B and B2C generation
- AR3: Cross-language queue via simple Redis (Next.js LPUSH → Redis → Python BRPOP) — Celery used only on Python side
- AR4: MediaPipe for size rec on Python worker — FastAPI HTTP endpoint, 33 3D body landmarks, model loaded once on startup
- AR5: B2B REST API at /api/v1/* alongside existing B2C tRPC — reuses packages/api service layer
- AR6: Full B2B table separation — stores, store_credits, store_credit_transactions, store_generation_sessions, store_analytics_events, store_api_keys, store_shopper_credits, store_shopper_purchases (no shared tables with B2C)
- AR7: Free Connector App Pattern — plugin free on Shopify App Store, billing on WearOn platform (payment provider TBD, no Shopify Billing API, no 20% rev share)
- AR8: Application-level scoping for B2B — service role key + store_id in WHERE clauses (no RLS for B2B)
- AR9: Feature flag USE_PYTHON_WORKER for B2C migration — toggles between BullMQ and Redis queue, run both workers in parallel during transition
- AR10: Task payload version field for backward-compatible migrations — worker handles both old and new task formats
- AR11: Correlation ID (request_id) format req_ + UUID v4 — passed through API → Redis task → worker logs → Supabase session metadata
- AR12: snake_case at all data boundaries — API JSON, Redis payloads, DB columns; camelCase internally in TypeScript
- AR13: Structured logging — pino for TypeScript, structlog for Python; no console.log
- AR14: Shopify OAuth for merchant authentication + separate WearOn platform auth (Supabase) for onboarding/billing
- AR15: Billing on WearOn platform — subscriptions + PAYG (payment provider TBD, not Shopify Billing API)
- AR16: Implementation sequence: DB migrations → Python worker → B2C migration → B2B API → Queue integration → Shopify skeleton → OAuth → Plugin UI → Billing → Resell mode

**From Brainstorming & Project Context:**

- BR1: Size rec as retention moat — free, zero cost to serve, prevents uninstalls
- BR2: Combined size rec + try-on is the unique differentiator — no competitor does both
- BR3: Plug-and-play setup differentiates from Sizebay (contact sales, manual onboarding)
- BR4: Dual pricing track — PAYG ($0.18/credit) and subscription tiers ($49-$199/month)
- BR5: Wholesale credit model — store buys credits from WearOn, optionally resells to shoppers at markup
- BR6: Store-collects-payment model — store keeps 100% of shopper payment, WearOn already paid via wholesale
- BR7: Mobile-first widget design with privacy-first UX (disclosure before camera)
- BR8: Lead-first funnel for resell mode — signup required before free try-on
- BR9: Size rec from single photo + height input, auto-filled body profile form (first time only)

### FR Coverage Map

| FR | Epic | Description |
|----|------|-------------|
| FR1 | Epic 2 | Shopify OAuth install |
| FR2 | Epic 2 | 3-step merchant onboarding |
| FR3 | Epic 6 | Billing mode config (absorb/resell) |
| FR4 | Epic 6 | Retail credit price setting |
| FR5 | Epic 2 | Merchant dashboard access |
| FR6 | Epic 2 | Uninstall data cleanup |
| FR7 | Epic 3 | Subscribe to credit plan |
| FR8 | Epic 3 | PAYG credit packs |
| FR9 | Epic 3 | Upgrade/downgrade subscription |
| FR10 | Epic 3 | Auto-deduct credits per generation |
| FR11 | Epic 3 | Auto-refund on failure |
| FR12 | Epic 6 | Create hidden Shopify product (resell) |
| FR13 | Epic 6 | Process Shopify order webhooks (resell) |
| FR14 | Epic 3 | B2C credit packs (existing) |
| FR15 | Epic 3 | B2C free starter credits (existing) |
| FR16 | Epic 3 | Overage rate charging |
| FR17 | Epic 4 | Try-on via store plugin |
| FR18 | Epic 4 | B2C try-on via mobile app (existing) |
| FR19 | Epic 4 | B2C upload outfit (existing) |
| FR20 | Epic 1 | Queue jobs with per-store rate limiting |
| FR21 | Epic 1 | Process jobs via background worker |
| FR22 | Epic 1 | Real-time completion notification |
| FR23 | Epic 1 | Moderation block detection |
| FR24 | Epic 1 | Auto-delete images after 6 hours |
| FR25 | Epic 5 | Size rec from photo + height |
| FR26 | Epic 5 | Pose detection body estimation |
| FR27 | Epic 5 | Confidence range display |
| FR28 | Epic 5 | Body profile save for reuse |
| FR29 | Epic 5 | Real-time size rec (no queuing) |
| FR30 | Epic 5 | Size rec disclaimer |
| FR31 | Epic 4 | Plugin auto-loads on product pages |
| FR32 | Epic 4 | Sandboxed mode (no CSS conflicts) |
| FR33 | Epic 4 | Camera capture with pose overlay |
| FR34 | Epic 4 | Privacy disclosure before camera |
| FR35 | Epic 4 | Zero-friction mode (absorb) |
| FR36 | Epic 6 | Shopper account creation (resell) |
| FR37 | Epic 4 | "Powered by WearOn" badge |
| FR38 | Epic 4 | Accessibility (screen reader, keyboard, contrast) |
| FR39 | Epic 7 | Store-level analytics |
| FR40 | Epic 7 | B2C personal history (existing) |
| FR41 | Epic 7 | B2B admin analytics |
| FR42 | Epic 7 | B2C admin analytics |
| FR43 | Epic 7 | Revenue dashboard |
| FR44 | Epic 7 | Quality metrics |
| FR45 | Epic 7 | Churn risk detection |
| FR46 | Epic 2 | Shopify OAuth authentication |
| FR47 | Epic 2 | Domain-restricted API keys |
| FR48 | Epic 2 | CORS whitelisting per store |
| FR49 | Epic 8 | B2C auth (existing) |
| FR50 | Epic 7 | Platform admin management |
| FR51 | Epic 2 | Rate limits per subscription tier |
| FR52 | Epic 8 | GDPR/CCPA privacy templates |
| FR53 | Epic 8 | COPPA age gating |

**Coverage: 53/53 FRs mapped (100%)**

## Epic List

### Epic 1: Platform Foundation & Unified Generation Pipeline

All users get reliable generation processing through a unified Python worker serving both B2B and B2C channels, with B2B database schema established.

**FRs covered:** FR20, FR21, FR22, FR23, FR24
**ARs covered:** AR2, AR3, AR6, AR10, AR11, AR12, AR13 (AR9 dropped — clean BullMQ replacement, no feature flag)
**NFRs addressed:** NFR3, NFR13-NFR17, NFR25, NFR27, NFR28, NFR29, NFR31, NFR33
**Depends on:** Nothing (foundational)

### Epic 2: Store Onboarding & Management

Store owners can install the WearOn plugin via Shopify App Store, complete onboarding, authenticate with OAuth, manage API keys, and configure their store.

**FRs covered:** FR1, FR2, FR5, FR6, FR46, FR47, FR48, FR51
**ARs covered:** AR5, AR8, AR14
**NFRs addressed:** NFR4, NFR5, NFR6, NFR7, NFR8, NFR10, NFR11, NFR12, NFR24, NFR34
**Depends on:** Epic 1 (B2B tables)

### Epic 3: Credit System & Merchant Billing

Store owners can subscribe to plans, purchase credits (PAYG or subscription), and the system handles automatic credit deduction, refunds, and overage charging. B2C credit operations continue working.

**FRs covered:** FR7, FR8, FR9, FR10, FR11, FR14, FR15, FR16
**ARs covered:** AR15
**Depends on:** Epic 2 (store exists to bill)

### Epic 4: Shopify Plugin Storefront & Virtual Try-On

Shoppers on merchant stores can try on outfits through the Shopify plugin's theme app extension — sandboxed, accessible, mobile-first, with camera guidance and privacy protections. B2C try-on continues working via mobile app.

**FRs covered:** FR17, FR18, FR19, FR31, FR32, FR33, FR34, FR35, FR37, FR38
**NFRs addressed:** NFR1, NFR18-NFR23, NFR30
**Depends on:** Epic 1 (generation pipeline), Epic 3 (credits)
**Cross-repo:** Plugin UI in wearon-shopify, API endpoints in wearon

### Epic 5: Size Recommendation

Shoppers and B2C users get instant, accurate size recommendations from a single photo using AI pose estimation on the Python worker.

**FRs covered:** FR25, FR26, FR27, FR28, FR29, FR30
**ARs covered:** AR4
**NFRs addressed:** NFR2, NFR32
**Depends on:** Epic 1 (Python worker with MediaPipe/FastAPI)
**Cross-repo:** MediaPipe service in wearon-worker, proxy endpoint in wearon

### Epic 6: Resell Mode & Shopper Credits

Stores can sell try-on credits to shoppers via Shopify's existing checkout, turning try-on from a cost center into a revenue stream. Includes billing mode configuration, hidden product creation, webhook processing, and shopper account management.

**FRs covered:** FR3, FR4, FR12, FR13, FR36
**NFRs addressed:** NFR11, NFR26
**Depends on:** Epic 3 (credit system), Epic 4 (plugin with account creation)
**Cross-repo:** Webhook handling in wearon, product creation via Shopify Admin API

### Epic 7: Analytics, Admin & Insights

Store owners view store-level analytics, B2C users see personal history, and platform admins manage the entire platform with revenue dashboards, quality metrics, and churn detection.

**FRs covered:** FR39, FR40, FR41, FR42, FR43, FR44, FR45, FR50
**Depends on:** Epic 2 (stores exist), Epic 3 (credit data exists)

### Epic 8: Privacy, Compliance & Trust

The platform meets GDPR, CCPA, and COPPA requirements with privacy-first UX, legal templates, and age gating. B2C authentication maintained.

**FRs covered:** FR49, FR52, FR53
**NFRs addressed:** NFR6, NFR9
**Depends on:** Cross-cutting (applied throughout)

---

## Epic 1: Platform Foundation & Unified Generation Pipeline

All users get reliable generation processing through a unified Python worker serving both B2B and B2C channels, with B2B database schema established.

### Story 1.1: B2B Database Schema (Supabase Migrations)

As a **platform operator**,
I want **all B2B database tables created with proper schema and constraints**,
So that **the platform can store B2B store data, credits, generations, and analytics separately from B2C**.

**Acceptance Criteria:**

**Given** the Supabase database with existing migrations 001-004
**When** migration 005_b2b_stores_schema.sql is applied
**Then** tables `stores`, `store_api_keys`, `store_credits`, `store_credit_transactions` are created with proper foreign keys, indexes, and NOT NULL constraints
**And** a trigger auto-creates a `store_credits` row with 0 balance when a new store is inserted
**And** `store_api_keys.key_hash` stores SHA-256 hashes (never plaintext)
**And** `store_credits` includes `deduct_store_credits()` and `refund_store_credits()` RPC functions for atomic operations

**Given** migration 005 has been applied
**When** migration 006_b2b_generation_schema.sql is applied
**Then** tables `store_generation_sessions` and `store_analytics_events` are created
**And** `store_generation_sessions.status` has CHECK constraint limiting values to `queued`, `processing`, `completed`, `failed`
**And** proper indexes exist on `store_id` and `status` columns

**Given** migrations 005-006 have been applied
**When** migration 007_b2b_resell_schema.sql is applied
**Then** tables `store_shopper_credits` and `store_shopper_purchases` are created
**And** `store_shopper_credits` is keyed by (`store_id`, `shopper_email`) with unique constraint
**And** `store_shopper_purchases` uses `shopify_order_id` as unique key for idempotent webhook processing

**Given** all B2B tables exist
**When** column names are examined
**Then** all follow `snake_case` convention with `timestamptz` for all timestamp columns

### Story 1.2: Cross-Repo Infrastructure (Logging, Correlation ID, snake_case)

As a **developer**,
I want **structured logging, correlation IDs, and boundary conversion utilities**,
So that **all API requests can be traced across services with consistent data formats at boundaries**.

**Acceptance Criteria:**

**Given** the pino logger is configured in `packages/api`
**When** any API handler or service logs a message
**Then** output is structured JSON with `level`, `request_id`, `message`, `timestamp`, and `repo` fields
**And** `console.log` is not used anywhere (Biome enforces `noConsoleLog: error`)

**Given** the `request-id.ts` middleware in `packages/api/src/middleware/`
**When** an API request arrives without an `X-Request-Id` header
**Then** a new correlation ID in format `req_` + UUID v4 is generated and attached to the request context

**Given** the `request-id.ts` middleware
**When** an API request arrives with an `X-Request-Id` header
**Then** the existing value is preserved and used throughout the request lifecycle

**Given** the `snake-case.ts` utility in `packages/api/src/utils/`
**When** a camelCase object is passed to `toSnakeCase()`
**Then** all keys are converted to `snake_case` for API responses and Redis payloads

**Given** the `snake-case.ts` utility
**When** a snake_case object is passed to `toCamelCase()`
**Then** all keys are converted to `camelCase` for internal TypeScript use

### Story 1.3: Redis Queue Service & BullMQ Removal

As a **platform operator**,
I want **generation jobs pushed to Redis via LPUSH for the Python worker to consume**,
So that **both B2B and B2C generation requests are processed through a single unified pipeline**.

**Acceptance Criteria:**

**Given** the `redis-queue.ts` service in `packages/api/src/services/`
**When** a generation job is queued
**Then** a JSON task payload is pushed to Redis via `LPUSH` with fields: `task_id`, `channel` (`b2b` or `b2c`), `store_id` or `user_id`, `session_id`, `image_urls`, `prompt`, `request_id`, `version`, `created_at` — all keys in `snake_case`

**Given** the task payload type definitions in `packages/api/src/types/queue.ts`
**When** a task is created
**Then** it includes a `version` field (integer, starting at 1) for forward compatibility
**And** `channel` is typed as `'b2b' | 'b2c'`

**Given** the existing B2C generation router (`packages/api/src/routers/generation.ts`)
**When** a B2C user requests a try-on
**Then** the job is pushed to the Redis queue via `redis-queue.ts` (not BullMQ)
**And** the session is created in `generation_sessions` with status `queued`

**Given** the BullMQ migration is complete
**When** the codebase is examined
**Then** `services/queue.ts` (BullMQ), `workers/generation.worker.ts`, and all BullMQ dependencies (`bullmq` package) are removed
**And** the `yarn worker` script in `packages/api/package.json` is removed

**Given** a Redis connection failure
**When** the API attempts to queue a generation job
**Then** a `503 Service Unavailable` response is returned with appropriate error messaging

---

## Epic 2: Store Onboarding & Management

Store owners can install the WearOn plugin via Shopify App Store, complete onboarding, authenticate with OAuth, manage API keys, and configure their store.

### Story 2.1: B2B REST API Foundation & Middleware

As a **platform operator**,
I want **a secure B2B REST API layer with API key authentication, CORS, and rate limiting**,
So that **Shopify plugins can safely communicate with the WearOn platform through versioned endpoints**.

**Acceptance Criteria:**

**Given** the Next.js app router
**When** B2B API routes are created at `/api/v1/*`
**Then** the route structure follows: `/api/v1/generation/`, `/api/v1/credits/`, `/api/v1/stores/`, `/api/v1/size-rec/`, `/api/v1/webhooks/shopify/`

**Given** the `api-key-auth.ts` middleware in `packages/api/src/middleware/`
**When** a request arrives with a valid API key in the `Authorization` header
**Then** the key hash is resolved to a `store_id` via the `store_api_keys` table
**And** the `store_id` is attached to the request context for all downstream queries

**Given** the `api-key-auth.ts` middleware
**When** a request arrives with an invalid or missing API key
**Then** a `401 Unauthorized` response is returned with `{ data: null, error: { code: "INVALID_API_KEY", message: "..." } }`

**Given** the `cors.ts` middleware
**When** a request arrives from a domain not registered to the store's API key
**Then** the request is rejected with a `403 Forbidden` response with `{ data: null, error: { code: "DOMAIN_MISMATCH", message: "..." } }`

**Given** the `rate-limit.ts` middleware
**When** a store exceeds its tier rate limit (tracked via Redis INCR with TTL)
**Then** a `429 Too Many Requests` response is returned with headers `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`
**And** response body contains `{ data: null, error: { code: "RATE_LIMIT_EXCEEDED", message: "..." } }`

**Given** any B2B REST API response
**When** the response is sent
**Then** it follows the format `{ data: {...}, error: null }` for success or `{ data: null, error: { code, message } }` for errors
**And** all JSON field names use `snake_case`

### Story 2.2: Shopify OAuth & Store Registration

As a **store owner**,
I want **to install the WearOn plugin from the Shopify App Store with one click**,
So that **my store is registered on the WearOn platform and I can start configuring try-on features**.

**Acceptance Criteria:**

**Given** a store owner clicks "Install" on the Shopify App Store listing
**When** the OAuth flow completes via `@shopify/shopify-api`
**Then** a `stores` record is created with the shop domain, access token (AES-256 encrypted), and `active` status
**And** a `store_api_keys` record is created with a generated API key in format `wk_` + 32-char hex (stored as SHA-256 hash)
**And** a `store_credits` record is created with 0 balance

**Given** a store owner has completed OAuth
**When** they access the WearOn merchant area
**Then** they are authenticated via their Shopify-linked WearOn account (Supabase Auth)

**Given** a store has been registered
**When** the store record is queried
**Then** the `access_token` field is encrypted (AES-256) and never stored in plaintext

### Story 2.3: Merchant Onboarding & Dashboard

As a **store owner**,
I want **a simple 3-step onboarding flow and a dashboard to manage my store**,
So that **I can get started quickly and manage my WearOn integration**.

**Acceptance Criteria:**

**Given** a newly registered store owner
**When** they access the WearOn merchant area for the first time
**Then** they are guided through a 3-step onboarding: (1) confirm store details, (2) add payment method, (3) review plugin status

**Given** an onboarded store owner
**When** they access the merchant dashboard at `/(merchant)/` pages
**Then** they can view their API key (masked, with copy button), credit balance, and store configuration

**Given** the merchant dashboard
**When** the store owner views their API key
**Then** the key is displayed partially masked (e.g., `wk_a1b2...****`) with a "Regenerate" option
**And** regenerating creates a new key, invalidates the old one, and updates the hash in `store_api_keys`

### Story 2.4: Store Uninstall & Data Cleanup

As a **platform operator**,
I want **all store data cleaned up when a plugin is uninstalled**,
So that **no orphaned data remains and privacy requirements are met**.

**Acceptance Criteria:**

**Given** the webhook endpoint at `/api/v1/webhooks/shopify/app`
**When** Shopify sends an `app/uninstalled` webhook
**Then** the webhook payload is verified with HMAC-SHA256 signature
**And** the store's API keys are revoked (deleted from `store_api_keys`)
**And** the store is marked as `inactive` in the `stores` table
**And** any queued generation jobs for the store are cancelled

**Given** an uninstall webhook is processed
**When** the cleanup completes
**Then** it finishes within 60 seconds (NFR34)
**And** store files in Supabase Storage at `stores/{store_id}/` are scheduled for deletion

---

## Epic 3: Credit System & Merchant Billing

Store owners can subscribe to plans, purchase credits, and the system handles automatic credit deduction, refunds, and overage charging. B2C credit operations continue working.

### Story 3.1: B2B Store Credit Operations

As a **platform operator**,
I want **atomic credit deduction and refund operations for B2B stores**,
So that **store credit balances are always accurate and generation costs are tracked**.

**Acceptance Criteria:**

**Given** the `deduct_store_credits()` Supabase RPC function
**When** a B2B generation is requested via `/api/v1/generation/create`
**Then** exactly 1 credit is atomically deducted from `store_credits`
**And** a `store_credit_transactions` record is logged with `request_id`, `type: deduction`, and `amount: 1`

**Given** the `refund_store_credits()` Supabase RPC function
**When** a B2B generation fails (moderation block or processing error)
**Then** the credit is atomically refunded to `store_credits`
**And** a `store_credit_transactions` record is logged with `type: refund`

**Given** the `/api/v1/credits/balance` endpoint
**When** a store queries its credit balance via valid API key
**Then** the current balance, total purchased, and total spent are returned in `snake_case` JSON

**Given** a store has 0 credits
**When** a generation is requested
**Then** a `402` response is returned with `{ data: null, error: { code: "INSUFFICIENT_CREDITS", message: "..." } }`

**Given** existing B2C credit operations (FR14, FR15)
**When** B2C users purchase credits or receive free starter credits
**Then** these continue to work unchanged through existing tRPC endpoints

### Story 3.2: Payment Integration (Subscription & PAYG) — ON HOLD

> **Payment provider is TBD. Stripe will NOT be used. This story is on hold.**

As a **store owner**,
I want **to subscribe to a credit plan or buy pay-as-you-go packs**,
So that **I can fund my store's try-on feature with the pricing model that fits my needs**.

**Acceptance Criteria:**

**Given** the billing page at `/merchant/billing`
**When** a store owner selects a subscription tier (Starter $49/350, Growth $99/800, Scale $199/1800)
**Then** a checkout session is created via the chosen payment provider
**And** on successful payment, `store_credits` balance is incremented by the tier's credit allocation
**And** the store's `subscription_tier` and `subscription_id` are stored in the `stores` table

**Given** the billing page
**When** a store owner selects a PAYG credit pack
**Then** a one-time checkout session is created at $0.18/credit
**And** on successful payment, credits are added to `store_credits`

**Given** a webhook for subscription renewal
**When** payment succeeds
**Then** the store's credit balance is topped up by the tier allocation
**And** a credit transaction is logged

**Given** a webhook for payment failure
**When** subscription payment fails
**Then** the store is notified and given a grace period before credits are paused

### Story 3.3: Subscription Management & Overage

As a **store owner**,
I want **to upgrade, downgrade my plan, and have overage handled automatically**,
So that **my store never runs out of credits unexpectedly**.

**Acceptance Criteria:**

**Given** a store on a subscription plan
**When** the owner requests an upgrade (e.g., Starter → Growth)
**Then** the change is processed via the payment provider with prorated billing
**And** the `stores.subscription_tier` is updated
**And** additional credits from the new tier are added immediately

**Given** a store on a subscription plan
**When** the owner requests a downgrade
**Then** the change takes effect at the next billing cycle
**And** existing credits remain usable

**Given** a store that has exhausted its subscription credits
**When** a generation is requested
**Then** the overage rate for the tier is applied (e.g., $0.16/credit for Starter)
**And** the overage charge is tracked in `store_credit_transactions`
**And** the generation proceeds normally

---

## Epic 4: Shopify Plugin Storefront & Virtual Try-On

Shoppers on merchant stores can try on outfits through the Shopify plugin's theme app extension. B2C try-on continues working via mobile app.

### Story 4.1: B2B Generation REST API Endpoints

As a **shopper on a merchant store**,
I want **to request a virtual try-on through the store's plugin**,
So that **I can see how an outfit looks on me before purchasing**.

**Acceptance Criteria:**

**Given** the endpoint `POST /api/v1/generation/create`
**When** a valid request is received with `image_urls`, `prompt`, and valid API key
**Then** 1 credit is deducted from the store's balance via `deduct_store_credits()`
**And** a `store_generation_sessions` record is created with status `queued`
**And** a task is pushed to the Redis queue with `channel: "b2b"`, `store_id`, and `session_id`
**And** the response returns `{ data: { session_id, status: "queued" }, error: null }` with HTTP 201

**Given** the endpoint `GET /api/v1/generation/{id}`
**When** a valid session ID is queried with valid API key
**Then** the session status, result URL (if completed), and error message (if failed) are returned
**And** the response is scoped to the requesting store's `store_id` (no cross-tenant access)

**Given** B2B storage paths
**When** images are uploaded for B2B generation
**Then** they are stored under `stores/{store_id}/uploads/` and `stores/{store_id}/generated/`

**Given** existing B2C try-on (FR18, FR19)
**When** B2C users request try-ons via the mobile app
**Then** these continue to work through existing tRPC endpoints and B2C storage paths

### Story 4.2: Plugin Theme App Extension Core (wearon-shopify)

As a **shopper on a merchant's product page**,
I want **a try-on button that loads seamlessly without breaking the store's design**,
So that **I can access virtual try-on naturally as part of my shopping experience**.

**Acceptance Criteria:**

**Given** a merchant has installed the WearOn plugin
**When** a shopper visits a product page
**Then** the try-on block loads automatically via Shopify theme app extension

**Given** the theme app extension
**When** it renders on any Shopify theme
**Then** it operates in sandboxed mode (shadow DOM or scoped styles) without conflicting with store CSS

**Given** the plugin UI
**When** rendered on the product page
**Then** a "Powered by WearOn" badge is visible

**Given** the plugin bundle
**When** loaded on a 3G mobile connection
**Then** initial load completes in <2s (NFR1) with total bundle <50KB gzipped

**Note:** This story is implemented in the **wearon-shopify** repo.

### Story 4.3: Try-On Experience & Privacy (wearon-shopify)

As a **shopper**,
I want **guided camera capture with clear privacy disclosures**,
So that **I feel confident and safe using the try-on feature**.

**Acceptance Criteria:**

**Given** a shopper taps the try-on button
**When** the camera is about to be accessed
**Then** a privacy disclosure is shown: "Your photo is deleted within 6 hours"
**And** the shopper must acknowledge before the camera opens

**Given** the camera is active
**When** the shopper is positioning themselves
**Then** a pose guidance overlay helps them align correctly

**Given** the store uses absorb mode
**When** a shopper accesses try-on
**Then** no account creation or login is required (zero-friction mode)

**Note:** This story is implemented in the **wearon-shopify** repo.

### Story 4.4: Plugin Accessibility (wearon-shopify)

As a **shopper with accessibility needs**,
I want **the plugin to be fully accessible**,
So that **I can use virtual try-on regardless of my abilities**.

**Acceptance Criteria:**

**Given** the plugin UI
**When** tested against WCAG 2.1 Level AA standards
**Then** all interactions support screen readers and keyboard navigation
**And** all text elements meet minimum 4.5:1 contrast ratio
**And** all touch targets are minimum 44x44px on mobile
**And** pose guidance overlay has an audio alternative for visually impaired users

**Note:** This story is implemented in the **wearon-shopify** repo.

---

## Epic 5: Size Recommendation

Shoppers and B2C users get instant, accurate size recommendations from a single photo using AI pose estimation on the Python worker.

### Story 5.1: Size Rec Proxy API Endpoint

As a **shopper**,
I want **to get an instant size recommendation from the store's plugin**,
So that **I can order the right size and avoid returns**.

**Acceptance Criteria:**

**Given** the endpoint `/api/v1/size-rec`
**When** a valid request is received with `image_url` and `height_cm`
**Then** the request is proxied to the FastAPI `/estimate-body` endpoint on the Python worker
**And** the size recommendation is returned in <1s (NFR2)

**Given** the proxy endpoint
**When** the FastAPI worker is unreachable or times out (5s limit)
**Then** a `503 Service Unavailable` response is returned: "Size recommendation temporarily unavailable"
**And** the error does not affect generation pipeline availability (NFR32 — graceful degradation)

**Given** size rec is requested
**When** the response is returned
**Then** no credits are deducted (size rec is free, zero cost)

### Story 5.2: Body Profile Database & API

As a **B2C user**,
I want **to save my body profile after the first measurement**,
So that **I get instant size recommendations without re-uploading every time**.

**Acceptance Criteria:**

**Given** a new Supabase migration
**When** applied
**Then** a `user_body_profiles` table is created with columns: `user_id`, `height_cm`, `weight_kg`, `body_type`, `fit_preference`, `gender`, `est_chest_cm`, `est_waist_cm`, `est_hip_cm`, `est_shoulder_cm`, `source`
**And** `user_id` has a unique constraint (one profile per user)

**Given** a tRPC endpoint for body profile
**When** a B2C user saves their body profile
**Then** the profile is stored in `user_body_profiles` and returned on subsequent requests

**Given** a returning B2C user
**When** they request a size recommendation
**Then** the saved body profile is used without requiring a new photo for measurements

### Story 5.3: Size Rec Display & Confidence

As a **shopper**,
I want **clear size recommendations with confidence indicators**,
So that **I understand how reliable the recommendation is**.

**Acceptance Criteria:**

**Given** the size rec response from the Python worker
**When** confidence is 80% or above
**Then** a definitive size is displayed: "Recommended: M"

**Given** the size rec response
**When** confidence is below 80%
**Then** a range is displayed: "Between M and L"
**And** the confidence percentage is shown to the user

**Given** any size recommendation
**When** displayed to the user
**Then** a disclaimer is shown: "This is a suggestion based on your measurements, not a guarantee"

### Story 5.4: MediaPipe Pose Estimation Service (wearon-worker)

As a **platform operator**,
I want **the Python worker to estimate body measurements from a single photo**,
So that **size recommendations are based on accurate AI pose estimation**.

**Acceptance Criteria:**

**Given** the FastAPI endpoint `POST /estimate-body` on the Python worker
**When** an image URL and height_cm are provided
**Then** MediaPipe BlazePose extracts 33 3D body landmarks
**And** measurements are estimated: shoulder width, chest, waist, hip, body type
**And** the response includes `recommended_size`, `measurements`, `confidence`, and `body_type`

**Given** the MediaPipe model
**When** the worker starts
**Then** the model loads once and stays warm in memory for subsequent requests

**Note:** This story is implemented in the **wearon-worker** repo.

---

## Epic 6: Resell Mode & Shopper Credits

Stores can sell try-on credits to shoppers via Shopify's existing checkout, turning try-on from a cost center into a revenue stream.

### Story 6.1: Billing Mode Configuration

As a **store owner**,
I want **to choose between absorb mode and resell mode**,
So that **I can either offer free try-ons or sell credits to shoppers for profit**.

**Acceptance Criteria:**

**Given** the merchant dashboard or App Bridge settings
**When** a store owner toggles billing mode to "resell"
**Then** the `stores.billing_mode` is updated to `resell_mode`
**And** the store owner is prompted to set a retail credit price

**Given** the store is in resell mode
**When** the store owner sets a retail price (e.g., $0.50/credit)
**Then** the price is stored in `stores.retail_credit_price`
**And** the plugin displays credit pricing to shoppers

**Given** the store switches from resell back to absorb mode
**When** the toggle is saved
**Then** `stores.billing_mode` is updated to `absorb_mode`
**And** any remaining shopper credits are still usable (not revoked)

### Story 6.2: Hidden Shopify Product Creation

As a **store owner in resell mode**,
I want **a "Try-On Credit" digital product auto-created in my Shopify catalog**,
So that **shoppers can purchase credits through my store's existing checkout**.

**Acceptance Criteria:**

**Given** a store enables resell mode
**When** the configuration is saved
**Then** a hidden digital product "Try-On Credit" is created via the Shopify Admin API
**And** the product is removed from the Online Store sales channel (not browsable)
**And** the variant price matches the store's configured retail credit price

**Given** the hidden product exists
**When** the plugin shows credit purchase options
**Then** it uses a direct cart link (`store.myshopify.com/cart/{variant_id}:{quantity}`) to open Shopify checkout in a new tab

**Given** the store owner changes the retail credit price
**When** the price is updated
**Then** the Shopify product variant price is updated via Admin API

### Story 6.3: Shopify Order Webhook Processing

As a **platform operator**,
I want **shopper credit purchases confirmed via Shopify order webhooks**,
So that **credits are added to shopper balances reliably and idempotently**.

**Acceptance Criteria:**

**Given** the webhook endpoint at `/api/v1/webhooks/shopify/orders`
**When** a Shopify `orders/create` webhook arrives
**Then** the HMAC-SHA256 signature is verified against the app secret
**And** invalid signatures are rejected with `401`

**Given** a valid order webhook for a "Try-On Credit" product
**When** the order is processed
**Then** N credits are deducted from the store's wholesale pool (`store_credits`)
**And** N credits are added to the shopper's balance (`store_shopper_credits` keyed by `store_id` + `shopper_email`)
**And** a record is created in `store_shopper_purchases` with `shopify_order_id`

**Given** a duplicate webhook with the same `shopify_order_id`
**When** processed
**Then** the operation is idempotent — no double-credit, no error
**And** the existing purchase record is returned

**Given** the store's wholesale pool has insufficient credits
**When** a shopper purchase webhook arrives
**Then** the credit transfer fails gracefully and the store owner is notified

### Story 6.4: Shopper Credit Balance & Plugin Flow (wearon-shopify)

As a **shopper on a resell-mode store**,
I want **to create an account, buy credits, and use them for try-ons**,
So that **I can pay for the try-on experience through the store's checkout**.

**Acceptance Criteria:**

**Given** a store is in resell mode
**When** a shopper taps "Try On"
**Then** they are prompted to log into their store account (email resolved server-side via Shopify customer context)

**Given** a logged-in shopper with 0 credits
**When** they want a try-on
**Then** credit purchase options are shown with the store's retail pricing
**And** checkout opens in a new tab via Shopify cart link

**Given** a shopper has purchased credits
**When** the plugin checks balance via WearOn API
**Then** the updated credit balance is displayed and try-on is enabled

**Note:** This story is implemented in the **wearon-shopify** repo (plugin UI) with API support from **wearon** (REST endpoints for shopper credit balance).

---

## Epic 7: Analytics, Admin & Insights

Store owners, B2C users, and platform admins can view relevant analytics dashboards with revenue, quality, and usage insights.

### Story 7.1: Store-Level Analytics API

As a **store owner**,
I want **to view my store's analytics (generation count, credit usage, conversions)**,
So that **I can track ROI and optimize my try-on investment**.

**Acceptance Criteria:**

**Given** the `/api/v1/stores/config` endpoint (or App Bridge dashboard)
**When** a store owner requests analytics
**Then** the response includes: total generations, credits used, credits remaining, success rate, and date-range filtering

**Given** the B2B analytics events
**When** a generation completes or fails
**Then** an event is logged in `store_analytics_events` with `store_id`, event type, and metadata

### Story 7.2: B2B Admin Analytics Dashboard

As a **platform admin**,
I want **to view aggregated B2B analytics with store-by-store breakdown**,
So that **I can monitor platform health and identify at-risk stores**.

**Acceptance Criteria:**

**Given** the existing admin panel at `/admin/`
**When** the admin views B2B analytics
**Then** they see: total active stores, total B2B generations, store-by-store breakdown, and credit consumption

**Given** the admin panel
**When** the admin manages stores
**Then** they can view store details, credit balances, subscription tiers, and generation history

### Story 7.3: Revenue & Quality Dashboard

As a **platform admin**,
I want **to view revenue and quality metrics across B2B and B2C**,
So that **I can track business health, margins, and generation quality**.

**Acceptance Criteria:**

**Given** the admin dashboard
**When** the admin views the revenue section
**Then** they see: B2B wholesale revenue, B2C credit pack revenue, total OpenAI costs, and margin percentage

**Given** the admin dashboard
**When** the admin views quality metrics
**Then** they see: generation success rate, moderation block count, refund count, and average generation time

### Story 7.4: Churn Detection & B2C Admin Analytics

As a **platform admin**,
I want **automatic churn risk flagging for stores and aggregated B2C analytics**,
So that **I can proactively retain stores and monitor the consumer app**.

**Acceptance Criteria:**

**Given** the churn detection system
**When** a store's generation count drops significantly (e.g., >50% decrease week-over-week)
**Then** the store is flagged as "churn risk" in the admin dashboard

**Given** the admin dashboard
**When** the admin views B2C analytics
**Then** they see: user growth, credit purchases, generation stats, and active user counts

**Given** existing B2C personal history (FR40)
**When** a B2C user views their generation history
**Then** it continues to work unchanged through existing tRPC endpoints

---

## Epic 8: Privacy, Compliance & Trust

The platform meets GDPR, CCPA, and COPPA requirements with privacy-first UX, legal templates, and age gating.

### Story 8.1: GDPR/CCPA Privacy Policy Templates

As a **store owner**,
I want **ready-to-use privacy policy templates for my store**,
So that **I can comply with data privacy regulations when offering try-on features**.

**Acceptance Criteria:**

**Given** the merchant dashboard or documentation
**When** a store owner accesses privacy resources
**Then** a GDPR-compliant privacy policy template is available covering photo processing, 6-hour deletion, and third-party (OpenAI) data handling
**And** a CCPA-compliant privacy disclosure template is available
**And** a 3-party data processing agreement template (store → WearOn → OpenAI) is available

### Story 8.2: COPPA Age Gating

As a **platform operator**,
I want **users under 13 blocked from try-on features**,
So that **the platform complies with COPPA requirements**.

**Acceptance Criteria:**

**Given** the try-on feature (both B2B plugin and B2C app)
**When** a user attempts to use camera-based features
**Then** an age verification gate is presented
**And** users who indicate they are under 13 are blocked from accessing try-on and size rec features
**And** no photo data is collected from users who fail the age gate

**Given** existing B2C authentication (FR49)
**When** B2C users sign up and authenticate
**Then** authentication continues to work unchanged through existing Supabase Auth