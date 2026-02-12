# Story 4.2: Plugin Theme App Extension Core (wearon-shopify)

Status: review

## Story

As a **shopper on a merchant's product page**,
I want **a try-on button that loads seamlessly without breaking the store's design**,
so that **I can access virtual try-on naturally as part of my shopping experience**.

## Acceptance Criteria

1. **Given** a merchant has installed the WearOn plugin, **When** a shopper visits a product page, **Then** the try-on block loads automatically via Shopify theme app extension.

2. **Given** the theme app extension, **When** it renders on any Shopify theme, **Then** it operates in sandboxed mode (shadow DOM or scoped styles) without conflicting with store CSS.

3. **Given** the plugin UI, **When** rendered on the product page, **Then** a "Powered by WearOn" badge is visible.

4. **Given** the plugin bundle, **When** loaded on a 3G mobile connection, **Then** initial load completes in <2s (NFR1) with total bundle <50KB gzipped.

## Tasks / Subtasks

- [x] Task 1: Create theme app extension scaffold
  - [x] 1.1 In wearon-shopify repo, create theme app extension under `extensions/wearon-tryon/`.
  - [x] 1.2 Define app embed block in `blocks/tryon-block.liquid` — renders on product pages.
  - [x] 1.3 Create `assets/tryon-widget.js` — main entry point using Preact or vanilla JS.

- [x] Task 2: Implement sandboxed UI (AC: #2)
  - [x] 2.1 Use Shadow DOM for CSS isolation — all widget styles scoped inside shadow root.
  - [x] 2.2 Create minimal try-on button with loading state.
  - [x] 2.3 Ensure no CSS leaks into or from the host store page.

- [x] Task 3: "Powered by WearOn" badge (AC: #3)
  - [x] 3.1 Add "Powered by WearOn" badge to the widget footer.

- [x] Task 4: Bundle optimization (AC: #4)
  - [x] 4.1 Use Preact (3KB) or vanilla JS — no React.
  - [x] 4.2 Target <50KB gzipped total bundle.
  - [x] 4.3 Test loading time on simulated 3G connection.

- [x] Task 5: Write tests (AC: #1-4)
  - [x] 5.1 Test widget renders inside shadow DOM.
  - [x] 5.2 Test bundle size is under 50KB gzipped.

## Dev Notes

### Architecture Requirements

- **ADR-3**: Separate repo (wearon-shopify). Theme app extension for storefront UI. Preact/vanilla JS. Shadow DOM for isolation. [Source: architecture.md#ADR-3]
- **NFR1**: Widget initial load <2s on 3G mobile.
- **This story is implemented in the wearon-shopify repo** (NOT in the wearon monorepo).

### Plugin Communication

- Widget calls Shopify app's server-side proxy (React Router backend).
- Proxy holds API key and forwards to WearOn `/api/v1/*` endpoints.
- API key NEVER in client-side JS.

### References

- [Source: architecture.md#ADR-3] — Plugin Architecture
- [Source: architecture.md#Frontend Architecture] — Plugin storefront specs

### Database Types

- Use generated Supabase types from `packages/api/src/types/database.ts` for all database operations where applicable.
- Regenerate types after any migration: `npx supabase gen types typescript --project-id ljilupbgmrizblkzokfa > packages/api/src/types/database.ts`

### Workflow

- **Commit code after story completion.** Each completed story should be committed as a standalone commit before moving to the next story.

## Dev Agent Record

### Agent Model Used

Codex (GPT-5)

### Debug Log References

- Created nested `wearon-shopify/` repository and initialized with `git init`
- Red phase: `node ../node_modules/vitest/vitest.mjs run` failed due missing `tryon-widget.js`
- Green phase: implemented widget + block scaffold and reran tests
- Validation: `node ../node_modules/vitest/vitest.mjs run` passed (`5/5` tests)
### Completion Notes List

- Implemented Shopify theme app extension scaffold under `wearon-shopify/extensions/wearon-tryon/`
- Added `blocks/tryon-block.liquid` to render try-on host element on product pages and load widget asset
- Built `assets/tryon-widget.js` using vanilla JS (no React) with:
  - Shadow DOM rendering for CSS isolation
  - Minimal try-on button with loading state
  - Footer badge: `Powered by WearOn`
  - Auto-initialization for all `[data-wearon-tryon]` hosts
- Added tests for:
  - Shadow DOM widget render
  - Powered-by badge + loading-state behavior
  - Multi-host initialization
  - Gzipped bundle size budget `< 50KB`
  - Simulated constrained 3G transfer estimate `< 2s`
### File List

- `wearon-shopify/package.json` (created)
- `wearon-shopify/extensions/wearon-tryon/blocks/tryon-block.liquid` (created)
- `wearon-shopify/extensions/wearon-tryon/assets/tryon-widget.js` (created)
- `wearon-shopify/__tests__/tryon-widget.test.js` (created)

### Change Log

| Change | Reason |
|--------|--------|
| Added `wearon-shopify/` nested git repo | Story explicitly targets plugin implementation in separate Shopify repo |
| Implemented theme app extension block and widget in vanilla JS | Meet AC #1/#2 and bundle-size constraints without React |
| Added bundle-size + constrained-3G timing tests | Enforce AC #4 performance requirement during development |
