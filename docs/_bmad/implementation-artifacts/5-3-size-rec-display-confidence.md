# Story 5.3: Size Rec Display & Confidence

Status: review

## Story

As a **shopper**,
I want **clear size recommendations with confidence indicators**,
so that **I understand how reliable the recommendation is**.

## Acceptance Criteria

1. **Given** the size rec response from the Python worker, **When** confidence is 80% or above, **Then** a definitive size is displayed: "Recommended: M".

2. **Given** the size rec response, **When** confidence is below 80%, **Then** a range is displayed: "Between M and L" **And** the confidence percentage is shown to the user.

3. **Given** any size recommendation, **When** displayed to the user, **Then** a disclaimer is shown: "This is a suggestion based on your measurements, not a guarantee".

## Tasks / Subtasks

- [x] Task 1: Size rec display component (AC: #1, #2) — wearon-shopify
  - [x] 1.1 Create size recommendation display widget in theme app extension.
  - [x] 1.2 Display definitive size when confidence >= 80%: "Recommended: {size}".
  - [x] 1.3 Display range when confidence < 80%: "Between {size_lower} and {size_upper}" with confidence percentage.
  - [x] 1.4 Style size display for mobile-first (44x44px touch targets per NFR22).

- [x] Task 2: Size rec disclaimer (AC: #3)
  - [x] 2.1 Add static disclaimer text below size recommendation: "This is a suggestion based on your measurements, not a guarantee".
  - [x] 2.2 Ensure disclaimer meets 4.5:1 contrast ratio (NFR21).

- [x] Task 3: B2C size rec display (AC: #1-3) — wearon app
  - [x] 3.1 Create size recommendation display component in `packages/app/features/` for B2C mobile app.
  - [x] 3.2 Apply same confidence logic (>=80% definitive, <80% range).
  - [x] 3.3 Include disclaimer text.

- [x] Task 4: Write tests (AC: #1-3)
  - [x] 4.1 Test high confidence (>=80%) displays definitive size.
  - [x] 4.2 Test low confidence (<80%) displays range with percentage.
  - [x] 4.3 Test disclaimer is always visible.

## Dev Notes

- **This story spans both wearon-shopify (plugin) and wearon (B2C app).**
- **FR27**: Confidence range display when below threshold.
- **FR30**: Size rec disclaimer required on all recommendations.
- Plugin side: Preact/vanilla JS, lightweight, follows bundle <50KB constraint.
- B2C side: Tamagui component in `packages/app/features/`.

### Dependencies

- Story 5.1: Size rec proxy endpoint returns `confidence` and `recommended_size` fields.
- Story 5.4: MediaPipe service provides the confidence value.
- Story 4.2: Plugin theme app extension scaffold (for plugin-side display).

### Confidence Threshold

- **80%** is the threshold. This value should be a constant, not hardcoded in multiple places.
- Python worker returns: `{ "recommended_size": "M", "confidence": 0.85, "size_range": { "lower": "M", "upper": "L" } }`.

### References

- [Source: epics.md#Story 5.3] — Size Rec Display & Confidence
- [Source: architecture.md#NFR21-NFR22] — Contrast and touch target requirements

### Database Types

- Use generated Supabase types from `packages/api/src/types/database.ts` for all database operations where applicable.
- Regenerate types after any migration: `npx supabase gen types typescript --project-id ljilupbgmrizblkzokfa > packages/api/src/types/database.ts`

### Workflow

- **Commit code after story completion.** Each completed story should be committed as a standalone commit before moving to the next story.

## Dev Agent Record

### Agent Model Used

Codex (GPT-5)

### Debug Log References

- Red phase failures confirmed for both plugin and B2C display tests before implementation:
  - missing `size-rec-display.js`
  - missing B2C presentation module
- Green phase completed with new plugin display module and B2C feature component + presentation helper
- Targeted tests pass:
  - `wearon-shopify/__tests__/size-rec-display.test.js` (`5/5`)
  - `packages/app/__tests__/features/size-recommendation-display.test.ts` (`3/3`)
- Full regression run: no new story-related failures; only pre-existing infra/env failures remain (`packages/api/__tests__/migrations/b2b-schema.test.ts`, `apps/next/__tests__/build.test.ts`, `apps/next/__tests__/dev.test.ts`)

### Implementation Plan

- Add shared confidence-threshold constant for plugin display logic (single constant per module)
- Implement plugin size-rec presentation logic for definitive vs range outcomes
- Add always-visible disclaimer with verified contrast and mobile touch target rules
- Implement parallel B2C display component with the same confidence/disclaimer behavior
- Add focused tests for high/low confidence and disclaimer presence in both plugin and B2C contexts
### Completion Notes List

- Implemented plugin size recommendation display module:
  - `wearon-shopify/extensions/wearon-tryon/assets/size-rec-display.js`
  - uses `CONFIDENCE_THRESHOLD = 0.8` constant
  - confidence >= 80%: `Recommended: {size}`
  - confidence < 80%: `Between {lower} and {upper}` + `Confidence: {percent}%`
  - includes required disclaimer text and mobile-first touch-target metadata (44x44)
- Added plugin tests validating:
  - definitive display for high confidence
  - range + confidence for low confidence
  - disclaimer visibility
  - touch-target minimum sizing
  - disclaimer contrast ratio >= 4.5:1
- Implemented B2C display feature:
  - `packages/app/features/size-rec/size-recommendation-presentation.ts` (shared presentation logic + constants)
  - `packages/app/features/size-rec/size-recommendation-display.tsx` (Tamagui UI component)
  - `packages/app/features/size-rec/index.ts` exports
- Added B2C tests validating the same threshold logic and disclaimer behavior
### File List

- `wearon-shopify/extensions/wearon-tryon/assets/size-rec-display.js` (created)
- `wearon-shopify/__tests__/size-rec-display.test.js` (created)
- `packages/app/features/size-rec/size-recommendation-presentation.ts` (created)
- `packages/app/features/size-rec/size-recommendation-display.tsx` (created)
- `packages/app/features/size-rec/index.ts` (created)
- `packages/app/__tests__/features/size-recommendation-display.test.ts` (created)

### Change Log

| Change | Reason |
|--------|--------|
| Added plugin size-rec presentation module with 80% confidence threshold | Fulfill AC #1/#2 for storefront confidence-based display behavior |
| Added always-visible disclaimer with contrast-validated palette | Fulfill AC #3 and NFR21 |
| Added B2C Tamagui size recommendation display and shared presentation logic | Fulfill cross-platform requirement for consistent confidence/disclaimer logic |
| Added plugin + B2C focused test suites for threshold and disclaimer behavior | Validate AC #1-#3 and prevent logic regressions |
