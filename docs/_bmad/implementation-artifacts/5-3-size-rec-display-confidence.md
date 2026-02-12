# Story 5.3: Size Rec Display & Confidence

Status: ready-for-dev

## Story

As a **shopper**,
I want **clear size recommendations with confidence indicators**,
so that **I understand how reliable the recommendation is**.

## Acceptance Criteria

1. **Given** the size rec response from the Python worker, **When** confidence is 80% or above, **Then** a definitive size is displayed: "Recommended: M".

2. **Given** the size rec response, **When** confidence is below 80%, **Then** a range is displayed: "Between M and L" **And** the confidence percentage is shown to the user.

3. **Given** any size recommendation, **When** displayed to the user, **Then** a disclaimer is shown: "This is a suggestion based on your measurements, not a guarantee".

## Tasks / Subtasks

- [ ] Task 1: Size rec display component (AC: #1, #2) — wearon-shopify
  - [ ] 1.1 Create size recommendation display widget in theme app extension.
  - [ ] 1.2 Display definitive size when confidence >= 80%: "Recommended: {size}".
  - [ ] 1.3 Display range when confidence < 80%: "Between {size_lower} and {size_upper}" with confidence percentage.
  - [ ] 1.4 Style size display for mobile-first (44x44px touch targets per NFR22).

- [ ] Task 2: Size rec disclaimer (AC: #3)
  - [ ] 2.1 Add static disclaimer text below size recommendation: "This is a suggestion based on your measurements, not a guarantee".
  - [ ] 2.2 Ensure disclaimer meets 4.5:1 contrast ratio (NFR21).

- [ ] Task 3: B2C size rec display (AC: #1-3) — wearon app
  - [ ] 3.1 Create size recommendation display component in `packages/app/features/` for B2C mobile app.
  - [ ] 3.2 Apply same confidence logic (>=80% definitive, <80% range).
  - [ ] 3.3 Include disclaimer text.

- [ ] Task 4: Write tests (AC: #1-3)
  - [ ] 4.1 Test high confidence (>=80%) displays definitive size.
  - [ ] 4.2 Test low confidence (<80%) displays range with percentage.
  - [ ] 4.3 Test disclaimer is always visible.

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

## Dev Agent Record

### Agent Model Used

(to be filled by dev agent)

### Debug Log References

### Completion Notes List

### File List
