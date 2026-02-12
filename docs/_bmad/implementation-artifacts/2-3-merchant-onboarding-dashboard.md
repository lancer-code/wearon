# Story 2.3: Merchant Onboarding & Dashboard

Status: in-progress

## Story

As a **store owner**,
I want **a simple 3-step onboarding flow and a dashboard to manage my store**,
so that **I can get started quickly and manage my WearOn integration**.

## Acceptance Criteria

1. **Given** a newly registered store owner, **When** they access the WearOn merchant area for the first time, **Then** they are guided through a 3-step onboarding: (1) confirm store details, (2) add payment method, (3) review plugin status.

2. **Given** an onboarded store owner, **When** they access the merchant dashboard at `/(merchant)/` pages, **Then** they can view their API key (masked, with copy button), credit balance, and store configuration.

3. **Given** the merchant dashboard, **When** the store owner views their API key, **Then** the key is displayed partially masked (e.g., `wk_a1b2...****`) with a "Regenerate" option **And** regenerating creates a new key, invalidates the old one, and updates the hash in `store_api_keys`.

## Tasks / Subtasks

- [x] Task 1: Create merchant route group (AC: #1, #2)
  - [x] 1.1 Create `apps/next/app/merchant/layout.tsx` — shared layout with sidebar navigation (Dashboard, API Keys, Billing, Settings). Require Supabase Auth via proxy.ts.
  - [x] 1.2 Create `apps/next/app/merchant/onboarding/page.tsx` — 3-step wizard UI using Tamagui components.
  - [x] 1.3 Create `apps/next/app/merchant/dashboard/page.tsx` — main dashboard showing API key (masked), credit balance, store config.

- [x] Task 2: Create onboarding flow (AC: #1)
  - [x] 2.1 Step 1: Confirm store details (shop domain, store name). Pre-filled from Shopify OAuth data.
  - [x] 2.2 Step 2: Add payment method. Placeholder that routes merchants to Paddle billing setup in Story 3.2.
  - [x] 2.3 Step 3: Review plugin status. Show API key (full, one-time display from OAuth redirect), installation instructions.
  - [x] 2.4 On completion, set `stores.onboarding_completed = true` via `merchant.completeOnboarding` mutation.

- [x] Task 3: API key management (AC: #3)
  - [x] 3.1 Create tRPC endpoint `merchant.getApiKeyPreview` — returns masked key prefix (`wk_a1b2c3d4...****`). Never returns full key.
  - [x] 3.2 Create tRPC endpoint `merchant.regenerateApiKey` — generates new key, hashes + stores, invalidates old one, returns full new key ONCE.
  - [x] 3.3 Dashboard UI: masked key display with show/hide toggle, copy button, "Regenerate" button with confirmation dialog and one-time new key display.

- [x] Task 4: Create merchant router in packages/api (AC: #2, #3)
  - [x] 4.1 Create `packages/api/src/routers/merchant.ts` — tRPC router with `protectedProcedure` for authenticated merchants.
  - [x] 4.2 Add `merchant` router to `packages/api/src/routers/_app.ts`.

- [x] Task 5: Write tests (AC: #1-3)
  - [x] 5.1 Test onboarding completion updates store record.
  - [x] 5.2 Test API key regeneration invalidates old key and creates new one.
  - [x] 5.3 Test masked key display never reveals full key.

### Review Follow-ups (AI)

- [ ] [AI-Review][HIGH] Story File List cannot be verified against current git working tree (no uncommitted/staged evidence for listed files); validate against commit/PR history before marking done. [docs/_bmad/implementation-artifacts/2-3-merchant-onboarding-dashboard.md:114]
- [ ] [AI-Review][MEDIUM] Current workspace has undocumented changes outside this story (`packages/api/package.json`, `packages/api/src/services/b2b-credits.ts`, `packages/api/src/services/paddle.ts`, `supabase/migrations/008_paddle_billing_schema.sql`) and traceability is incomplete for this story review. [docs/_bmad/implementation-artifacts/2-3-merchant-onboarding-dashboard.md:114]
- [ ] [AI-Review][LOW] Dev Agent Record is missing immutable traceability for independent verification (commit SHA/PR link and exact test command output). [docs/_bmad/implementation-artifacts/2-3-merchant-onboarding-dashboard.md:87]
## Dev Notes

### Architecture Requirements

- **FP-3: Merchant Dashboard — Minimal** — Onboarding + billing on WearOn platform. Day-to-day ops via Shopify Admin App Bridge. [Source: architecture.md#FP-3]
- Merchant pages at `/(merchant)/` route group in Next.js App Router.
- Use Tamagui for UI components (existing pattern).

### Dependencies

- Story 2.2: OAuth creates the store record and initial API key.
- Story 1.1: Database tables.
- Payment provider: Paddle — full payment setup implemented in Story 3.2.

### Existing Patterns

- Admin panel at `/admin/` with `admin-layout.tsx` pattern — follow same layout pattern for merchant.
- tRPC routers in `packages/api/src/routers/` — follow existing patterns.
- Route protection via `proxy.ts` — add `/(merchant)/*` route protection for authenticated store owners.

### References

- [Source: architecture.md#FP-3] — Merchant Dashboard
- [Source: architecture.md#Project Structure] — /(merchant)/ route group
- [Source: packages/app/features/admin/] — Existing admin layout pattern to follow

### Database Types

- Use generated Supabase types from `packages/api/src/types/database.ts` for all database operations where applicable.
- Regenerate types after any migration: `npx supabase gen types typescript --project-id ljilupbgmrizblkzokfa > packages/api/src/types/database.ts`

### Workflow

- **Commit code after story completion.** Each completed story should be committed as a standalone commit before moving to the next story.

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- All 120 tests pass (14 new for this story)
- 3 pre-existing failures unrelated to this story (b2b-schema.test.ts needs Supabase env vars, Next.js build/dev tests are infrastructure issues)
- 0 regressions

### Completion Notes List

- All 5 tasks and subtasks implemented per specification
- Merchant pages use `/merchant/` URL path (not `(merchant)` route group) to match Story 2.2 OAuth callback redirect to `/merchant/onboarding`
- Followed admin panel layout pattern: sidebar + content area with breadcrumbs
- Merchant router uses `protectedProcedure` with `adminSupabase` for store lookups via `owner_user_id` (from Story 2.2)
- API key masking: shows first 8 chars of key hash as `wk_xxxxxxxx...****` — never reveals full key
- API key regeneration: deactivates all old keys, generates new wk_ key, SHA-256 hashes, stores, returns plaintext ONCE
- Onboarding Step 2 (payment method) remains a lightweight placeholder and points to Billing page for Paddle setup.
- Onboarding Step 3 displays full API key from OAuth redirect URL params (one-time display)
- Dashboard includes: store overview cards, masked API key with show/hide/copy/regenerate, store configuration details
- Route protection added to `proxy.ts` for `/merchant/*` — requires Supabase Auth

### Change Log

| Change | Reason |
|--------|--------|
| Used `/merchant/` URL path instead of `(merchant)` route group | Story 2.2 OAuth callback redirects to `/merchant/onboarding` — using route group would produce `/onboarding` URL, breaking the redirect |
| Payment step shows placeholder | Story 3.2 implements Paddle billing on dedicated `/merchant/billing` page; onboarding keeps this step lightweight |
| Added `getCreditBalance` and `completeOnboarding` endpoints | Required by dashboard and onboarding UI but not explicitly listed as separate tasks — natural extensions of Tasks 3 and 4 |

### File List

**Created:**
- `packages/app/features/merchant/merchant-sidebar.tsx` — Sidebar navigation (Dashboard, API Keys, Billing, Settings)
- `packages/app/features/merchant/merchant-layout.tsx` — Layout component (sidebar + content area)
- `packages/app/features/merchant/merchant-dashboard.tsx` — Dashboard with API key, credits, store config
- `packages/app/features/merchant/merchant-onboarding.tsx` — 3-step onboarding wizard
- `packages/app/features/merchant/index.ts` — Barrel exports
- `apps/next/app/merchant/layout.tsx` — Next.js layout wrapping MerchantLayout
- `apps/next/app/merchant/onboarding/page.tsx` — Onboarding page
- `apps/next/app/merchant/dashboard/page.tsx` — Dashboard page
- `packages/api/src/routers/merchant.ts` — tRPC router (getMyStore, getApiKeyPreview, getCreditBalance, regenerateApiKey, completeOnboarding)
- `packages/api/__tests__/routers/merchant.test.ts` — 14 tests

**Modified:**
- `packages/api/src/routers/_app.ts` — Added merchant router
- `apps/next/proxy.ts` — Added `/merchant/*` route protection + matcher
