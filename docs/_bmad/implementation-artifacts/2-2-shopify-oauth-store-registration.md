# Story 2.2: Shopify Managed Installation & Store Registration

Status: complete

## Story

As a **store owner**,
I want **to install the WearOn plugin from the Shopify App Store with one click**,
so that **my store is registered on the WearOn platform and I can start configuring try-on features**.

## Acceptance Criteria

1. **Given** a store owner clicks "Install" on the Shopify App Store listing, **When** they open the app for the first time in Shopify Admin, **Then** a `stores` record is auto-provisioned with the shop domain, access token (AES-256 encrypted), and `active` status **And** a `store_api_keys` record is created with a generated API key in format `wk_` + 32-char hex (stored as SHA-256 hash) **And** a `store_credits` record is created with 0 balance.

2. **Given** a store has been registered, **When** the store record is queried, **Then** the `access_token` field is encrypted (AES-256) and never stored in plaintext.

## Authentication Flow

### Managed Installation (use_legacy_install_flow = false)

With Shopify managed installation, the traditional OAuth callback flow is **not used**. Shopify handles app installation automatically without calling any redirect URL on the app.

**How it works:**

1. Merchant clicks "Install" → Shopify manages consent and installation internally
2. Shopify loads `application_url` (`/shopify`) in an iframe within Shopify Admin
3. App Bridge provides a **session token** (JWT) to the embedded app
4. Frontend sends session token via `Authorization: Bearer <token>` header
5. **Session middleware** (`packages/api/src/middleware/shopify-session.ts`) verifies the JWT
6. If no store exists for the shop domain, middleware performs **auto-provisioning**:
   - Calls `shopify.auth.tokenExchange()` to swap session token for an offline access token
   - Creates `stores` record with encrypted access token
   - Generates `store_api_keys` record
   - `store_credits` row auto-created by database trigger (Story 1.1)
7. Subsequent requests find the store in the DB and proceed normally

### Token Exchange

The `exchangeTokenForOfflineAccess()` function in `packages/api/src/services/shopify.ts` uses the `@shopify/shopify-api` library's `auth.tokenExchange()` method with `RequestedTokenType.OfflineAccessToken` to obtain a persistent access token from Shopify.

## Tasks / Subtasks

- [x] Task 1: Install @shopify/shopify-api (AC: #1)
  - [x] 1.1 Add `@shopify/shopify-api` to `packages/api` dependencies
  - [x] 1.2 Create `packages/api/src/services/shopify.ts` — Shopify API client, `createShopifyClient()`, `exchangeTokenForOfflineAccess()`
  - [x] 1.3 Create `packages/api/src/utils/encryption.ts` — AES-256-CBC encrypt/decrypt

- [x] Task 2: Auto-provisioning in session middleware (AC: #1, #2)
  - [x] 2.1 Update `packages/api/src/middleware/shopify-session.ts` — when store not found, call token exchange and provision store
  - [x] 2.2 Encrypt access token with AES-256 before storing
  - [x] 2.3 Create `stores` record: `{ shop_domain, access_token_encrypted, status: 'active', billing_mode: 'absorb_mode', onboarding_completed: false }`
  - [x] 2.4 Generate API key: `wk_` + 32-char hex, SHA-256 hashed, store in `store_api_keys`
  - [x] 2.5 `store_credits` row auto-created by database trigger (Story 1.1)

- [x] Task 3: Remove old OAuth callback flow
  - [x] 3.1 Delete `apps/next/app/api/v1/auth/shopify/route.ts` (OAuth begin)
  - [x] 3.2 Delete `apps/next/app/api/v1/auth/shopify/callback/route.ts` (OAuth callback)
  - [x] 3.3 Remove `beginAuth`, `completeAuth`, `validateHmac`, `getShopOwnerEmail` from shopify.ts

## Dev Notes

### Architecture

- **Managed installation** (`use_legacy_install_flow = false` in `shopify.app.toml`) — Shopify handles install consent automatically
- **Token exchange** replaces OAuth callback — session token → offline access token via `shopify.auth.tokenExchange()`
- **Auto-provisioning** in session middleware — store created on first authenticated API request, not during install
- **No OAuth routes needed** — the `/api/v1/auth/shopify/` and `/api/v1/auth/shopify/callback/` routes are removed

### Security Notes

- **AES-256 encryption** for access tokens: `crypto.createCipheriv('aes-256-cbc', key, iv)`. IV stored with ciphertext.
- **API key generation**: `wk_` + 32 hex chars. SHA-256 hash before storage.
- **Session token verification**: JWT signature verified with HMAC-SHA256 using Shopify client secret. Audience, expiry, and not-before claims validated.

### Dependencies

- Story 1.1: `stores`, `store_api_keys`, `store_credits` tables + auto-credit trigger
- Story 1.2: pino logger

### Environment Variables

- `NEXT_PUBLIC_SHOPIFY_CLIENT_ID` — Shopify app client ID
- `SHOPIFY_CLIENT_SECRET` — Shopify app secret (JWT verification + token exchange)
- `SHOPIFY_SCOPES` — Required scopes (e.g., `read_products,write_products,read_orders`)
- `SHOPIFY_APP_URL` — App URL
- `ENCRYPTION_KEY` — 32-byte key for AES-256 (hex-encoded)

### File List

Active files:
- `packages/api/src/services/shopify.ts` — Shopify API client, token exchange, GraphQL client
- `packages/api/src/middleware/shopify-session.ts` — JWT verification, auto-provisioning
- `packages/api/src/utils/encryption.ts` — AES-256-CBC encrypt/decrypt

Deleted files (old OAuth flow):
- `apps/next/app/api/v1/auth/shopify/route.ts`
- `apps/next/app/api/v1/auth/shopify/callback/route.ts`

### Change Log

- 2026-02-12: Initial implementation with OAuth callback flow
- 2026-02-13: Replaced OAuth callback with token exchange + auto-provisioning (managed installation)
