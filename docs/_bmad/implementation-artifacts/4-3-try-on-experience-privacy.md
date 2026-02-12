# Story 4.3: Try-On Experience & Privacy (wearon-shopify)

Status: review

## Story

As a **shopper**,
I want **guided camera capture with clear privacy disclosures**,
so that **I feel confident and safe using the try-on feature**.

## Acceptance Criteria

1. **Given** a shopper taps the try-on button, **When** the camera is about to be accessed, **Then** a privacy disclosure is shown: "Your photo is deleted within 6 hours" **And** the shopper must acknowledge before the camera opens.

2. **Given** the camera is active, **When** the shopper is positioning themselves, **Then** a pose guidance overlay helps them align correctly.

3. **Given** the store uses absorb mode, **When** a shopper accesses try-on, **Then** no account creation or login is required (zero-friction mode).

## Tasks / Subtasks

- [x] Task 1: Privacy disclosure UI (AC: #1)
  - [x] 1.1 Create privacy modal with "Your photo is deleted within 6 hours" messaging.
  - [x] 1.2 Require explicit "I Understand" acknowledgment before camera access.
  - [x] 1.3 Store acknowledgment in session storage (per-visit, not persistent).

- [x] Task 2: Camera capture with pose guidance (AC: #2)
  - [x] 2.1 Implement camera access via getUserMedia API.
  - [x] 2.2 Create pose guidance overlay (silhouette outline for alignment).
  - [x] 2.3 Capture photo on user action (tap/click).

- [x] Task 3: Absorb mode zero-friction flow (AC: #3)
  - [x] 3.1 Check store billing_mode from API config endpoint.
  - [x] 3.2 If absorb mode: skip login, proceed directly to try-on.
  - [x] 3.3 Shopper email resolved server-side via Shopify customer context (proxy handles this).

- [x] Task 4: Write tests (AC: #1-3)
  - [x] 4.1 Test privacy disclosure blocks camera until acknowledged.
  - [x] 4.2 Test absorb mode skips login flow.

## Dev Notes

- **This story is implemented in the wearon-shopify repo.**
- **FP-4**: Shopper login required for try-on (both modes). In absorb mode, email fetched server-side — shopper doesn't need to manually log in. [Source: architecture.md#FP-4]
- Shopper email resolved server-side via Shopify customer context. Never trusted from client payload.

### References

- [Source: architecture.md#FP-4] — Shopper Login Required
- [Source: architecture.md#ADR-3] — Plugin Architecture

### Database Types

- Use generated Supabase types from `packages/api/src/types/database.ts` for all database operations where applicable.
- Regenerate types after any migration: `npx supabase gen types typescript --project-id ljilupbgmrizblkzokfa > packages/api/src/types/database.ts`

### Workflow

- **Commit code after story completion.** Each completed story should be committed as a standalone commit before moving to the next story.

## Dev Agent Record

### Agent Model Used

Codex (GPT-5)

### Debug Log References

- Red phase: `node ../node_modules/vitest/vitest.mjs run` failed when `tryon-privacy-flow.js` did not exist
- Green phase: added privacy/camera/access modules and widget integration
- Validation: `node ../node_modules/vitest/vitest.mjs run` passed (`12/12` tests)
- Performance gate: widget bundle `2157` bytes gzipped; constrained 3G estimate `0.042s`

### Implementation Plan

- Enforce privacy acknowledgment before any camera access
- Persist privacy acknowledgment in `sessionStorage` for current visit only
- Add camera start, pose overlay, and capture action in widget flow
- Add billing mode config resolution helper to support absorb-mode zero-friction path
- Cover flow with unit-style tests for privacy, camera, capture, and absorb-mode behavior
### Completion Notes List

- Added `tryon-privacy-flow.js` helpers for:
  - Session-scoped privacy acknowledgment state
  - API config lookup (`billing_mode`) from config endpoint via injected HTTP client
  - Absorb vs resell login requirement resolution
  - `getUserMedia` camera access and frame capture helper
- Updated `tryon-widget.js` to:
  - Show required privacy disclosure text and explicit `I Understand` gate
  - Block camera start until acknowledgement
  - Start camera via `getUserMedia` on try-on action
  - Render pose guidance overlay
  - Capture image on explicit user action (`Capture Photo`)
- Preserved client-side privacy boundary: no shopper email capture in frontend code; shopper identity remains server-side via proxy context
- Added/updated tests for AC #1-#3 and performance budget checks
### File List

- `wearon-shopify/extensions/wearon-tryon/assets/tryon-privacy-flow.js` (created)
- `wearon-shopify/extensions/wearon-tryon/assets/tryon-widget.js` (modified)
- `wearon-shopify/__tests__/tryon-privacy-flow.test.js` (created)
- `wearon-shopify/__tests__/tryon-widget.test.js` (modified)

### Change Log

| Change | Reason |
|--------|--------|
| Added privacy flow module with session-based acknowledgment and billing mode helpers | Implement AC #1 and AC #3 with explicit gating and absorb-mode logic |
| Extended widget with camera start, pose overlay, and capture button | Implement AC #2 guided camera experience |
| Added dedicated privacy-flow tests and expanded widget tests | Validate AC #1-#3 and avoid regressions |
