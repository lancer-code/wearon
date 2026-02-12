# Story 4.2: Plugin Theme App Extension Core (wearon-shopify)

Status: ready-for-dev

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

- [ ] Task 1: Create theme app extension scaffold
  - [ ] 1.1 In wearon-shopify repo, create theme app extension under `extensions/wearon-tryon/`.
  - [ ] 1.2 Define app embed block in `blocks/tryon-block.liquid` — renders on product pages.
  - [ ] 1.3 Create `assets/tryon-widget.js` — main entry point using Preact or vanilla JS.

- [ ] Task 2: Implement sandboxed UI (AC: #2)
  - [ ] 2.1 Use Shadow DOM for CSS isolation — all widget styles scoped inside shadow root.
  - [ ] 2.2 Create minimal try-on button with loading state.
  - [ ] 2.3 Ensure no CSS leaks into or from the host store page.

- [ ] Task 3: "Powered by WearOn" badge (AC: #3)
  - [ ] 3.1 Add "Powered by WearOn" badge to the widget footer.

- [ ] Task 4: Bundle optimization (AC: #4)
  - [ ] 4.1 Use Preact (3KB) or vanilla JS — no React.
  - [ ] 4.2 Target <50KB gzipped total bundle.
  - [ ] 4.3 Test loading time on simulated 3G connection.

- [ ] Task 5: Write tests (AC: #1-4)
  - [ ] 5.1 Test widget renders inside shadow DOM.
  - [ ] 5.2 Test bundle size is under 50KB gzipped.

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

(to be filled by dev agent)

### Debug Log References

### Completion Notes List

### File List
