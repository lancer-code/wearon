# Story 2.2: Shopify OAuth & Store Registration

Status: review

## Story

As a **store owner**,
I want **to install the WearOn plugin from the Shopify App Store with one click**,
so that **my store is registered on the WearOn platform and I can start configuring try-on features**.

## Acceptance Criteria

1. **Given** a store owner clicks "Install" on the Shopify App Store listing, **When** the OAuth flow completes via `@shopify/shopify-api`, **Then** a `stores` record is created with the shop domain, access token (AES-256 encrypted), and `active` status **And** a `store_api_keys` record is created with a generated API key in format `wk_` + 32-char hex (stored as SHA-256 hash) **And** a `store_credits` record is created with 0 balance.

2. **Given** a store owner has completed OAuth, **When** they access the WearOn merchant area, **Then** they are authenticated via their Shopify-linked WearOn account (Supabase Auth).

3. **Given** a store has been registered, **When** the store record is queried, **Then** the `access_token` field is encrypted (AES-256) and never stored in plaintext.

## Tasks / Subtasks

- [x]Task 1: Install @shopify/shopify-api (AC: #1)
  - [x]1.1 Add `@shopify/shopify-api` to `packages/api` dependencies.
  - [x]1.2 Create `packages/api/src/services/shopify.ts` — configure Shopify API client with `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`, `SHOPIFY_SCOPES`, `SHOPIFY_APP_URL` env vars.
  - [x]1.3 Export `createShopifyClient(shopDomain: string, accessToken: string)` for Admin API calls.

- [x]Task 2: Create OAuth callback route (AC: #1, #3)
  - [x]2.1 Create `apps/next/app/api/v1/auth/shopify/route.ts` — initiates OAuth: redirects to Shopify authorization URL with scopes.
  - [x]2.2 Create `apps/next/app/api/v1/auth/shopify/callback/route.ts` — handles OAuth callback: validates HMAC, exchanges code for access token.
  - [x]2.3 Encrypt access token with AES-256 before storing. Create `packages/api/src/utils/encryption.ts` — export `encrypt(plaintext: string): string` and `decrypt(ciphertext: string): string` using `crypto.createCipheriv` with `ENCRYPTION_KEY` env var.
  - [x]2.4 Create `stores` record: `{ shop_domain, access_token_encrypted, status: 'active', billing_mode: 'absorb_mode', onboarding_completed: false }`.
  - [x]2.5 Generate API key: `wk_` + `crypto.randomBytes(16).toString('hex')` (32 hex chars). Hash with SHA-256, store in `store_api_keys` with `allowed_domains: [shopDomain]`.
  - [x]2.6 `store_credits` row auto-created by database trigger (Story 1.1).

- [x]Task 3: Create Supabase Auth linkage (AC: #2)
  - [x]3.1 After OAuth success, create or link a Supabase Auth user for the store owner using their Shopify email. Store the `stores.id` ↔ Supabase user relationship.
  - [x]3.2 Redirect to `/(merchant)/onboarding` after successful registration.

- [x]Task 4: Handle re-installation (AC: #1)
  - [x]4.1 If `stores` record already exists for shop_domain, update access_token, set status to `active`, re-activate API keys.
  - [x]4.2 Do NOT create duplicate store records.

- [x]Task 5: Write tests (AC: #1-3)
  - [x]5.1 Create `packages/api/__tests__/services/shopify.test.ts` — test Shopify client creation.
  - [x]5.2 Create `packages/api/__tests__/utils/encryption.test.ts` — test encrypt/decrypt roundtrip, different inputs produce different ciphertext.
  - [x]5.3 Create `packages/api/__tests__/auth/shopify-oauth.test.ts` — test OAuth callback creates store + API key + credits.

## Dev Notes

### Architecture Requirements

- **ADR-5: Free Connector App Pattern** — Plugin is free on Shopify App Store. OAuth for installation. [Source: architecture.md#ADR-5]
- **FP-2: Application-Level Scoping** — B2B uses service role key, no RLS. [Source: architecture.md#FP-2]

### Existing Codebase Patterns

- OAuth callback at `apps/next/app/api/auth/` exists for Supabase (B2C). B2B OAuth goes under `/api/v1/auth/shopify/`.
- Store tables created in Story 1.1 (`stores`, `store_api_keys`, `store_credits`).
- Auto-credit trigger from Story 1.1 creates `store_credits` row when store is inserted.
- Use pino logger (Story 1.2), extractRequestId (Story 1.2) in OAuth routes.

### Security Notes

- **AES-256 encryption** for access tokens: use `crypto.createCipheriv('aes-256-cbc', key, iv)`. `ENCRYPTION_KEY` must be 32 bytes (hex-encoded in env). Store IV with ciphertext.
- **API key generation**: `wk_` + 32 hex chars. SHA-256 hash before storage. Return plaintext key to merchant ONCE (during registration), never again.
- **HMAC validation**: Validate Shopify's HMAC on the callback URL to prevent CSRF.

### Dependencies

- Story 1.1: `stores`, `store_api_keys`, `store_credits` tables
- Story 1.2: pino logger, extractRequestId
- Story 2.1: B2B response format utilities (optional — OAuth routes may use redirects not JSON)

### New Environment Variables

- `SHOPIFY_API_KEY` — Shopify app API key
- `SHOPIFY_API_SECRET` — Shopify app secret
- `SHOPIFY_SCOPES` — Required OAuth scopes (e.g., `read_products,write_products,read_orders`)
- `SHOPIFY_APP_URL` — App URL for OAuth redirect
- `ENCRYPTION_KEY` — 32-byte key for AES-256 (hex-encoded)

### References

- [Source: architecture.md#ADR-5] — Free Connector App Pattern
- [Source: architecture.md#Authentication & Security] — API key format, access token encryption
- [Source: architecture.md#Shopify OAuth] — OAuth flow details
- [Source: project-context.md#Security Rules] — API key format, AES-256 encryption

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- All 15 new tests pass (3 shopify service, 6 encryption, 6 oauth)
- 98/100 total tests pass; 3 pre-existing failures (b2b-schema env vars, Next.js build/dev tests)

### Completion Notes List

- Installed `@shopify/shopify-api@12.3.0` with web-api adapter for Next.js App Router compatibility
- Created `packages/api/src/services/shopify.ts` with lazy-initialized Shopify API client (ApiVersion.January26), `createShopifyClient()` for Admin GraphQL, `beginAuth()`/`completeAuth()` for OAuth flow, `getShopOwnerEmail()` for auth linkage
- Created `packages/api/src/utils/encryption.ts` with AES-256-CBC encrypt/decrypt (IV stored with ciphertext as `iv:encrypted`)
- Created OAuth initiation route at `/api/v1/auth/shopify/` — redirects to Shopify authorization
- Created OAuth callback route at `/api/v1/auth/shopify/callback/` — handles: store creation with encrypted access token, API key generation (`wk_` + 32 hex, SHA-256 hashed), Supabase Auth user linkage, and redirect to onboarding
- Re-installation handled in same callback — updates access token, re-activates API keys, no duplicate stores
- Supabase Auth linkage: fetches shop owner email via Shopify Admin API, creates or links Supabase Auth user, stores `owner_user_id` on store record
- All 3 acceptance criteria satisfied

### Change Log

- 2026-02-12: Implemented Story 2.2 — Shopify OAuth, store registration, API key generation, encryption utility, Supabase Auth linkage

### File List

New files:
- packages/api/src/services/shopify.ts
- packages/api/src/utils/encryption.ts
- apps/next/app/api/v1/auth/shopify/route.ts
- apps/next/app/api/v1/auth/shopify/callback/route.ts
- packages/api/__tests__/services/shopify.test.ts
- packages/api/__tests__/utils/encryption.test.ts
- packages/api/__tests__/auth/shopify-oauth.test.ts

Modified files:
- packages/api/package.json (added @shopify/shopify-api dependency)
