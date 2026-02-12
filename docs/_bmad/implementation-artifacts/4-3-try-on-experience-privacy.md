# Story 4.3: Try-On Experience & Privacy (wearon-shopify)

Status: ready-for-dev

## Story

As a **shopper**,
I want **guided camera capture with clear privacy disclosures**,
so that **I feel confident and safe using the try-on feature**.

## Acceptance Criteria

1. **Given** a shopper taps the try-on button, **When** the camera is about to be accessed, **Then** a privacy disclosure is shown: "Your photo is deleted within 6 hours" **And** the shopper must acknowledge before the camera opens.

2. **Given** the camera is active, **When** the shopper is positioning themselves, **Then** a pose guidance overlay helps them align correctly.

3. **Given** the store uses absorb mode, **When** a shopper accesses try-on, **Then** no account creation or login is required (zero-friction mode).

## Tasks / Subtasks

- [ ] Task 1: Privacy disclosure UI (AC: #1)
  - [ ] 1.1 Create privacy modal with "Your photo is deleted within 6 hours" messaging.
  - [ ] 1.2 Require explicit "I Understand" acknowledgment before camera access.
  - [ ] 1.3 Store acknowledgment in session storage (per-visit, not persistent).

- [ ] Task 2: Camera capture with pose guidance (AC: #2)
  - [ ] 2.1 Implement camera access via getUserMedia API.
  - [ ] 2.2 Create pose guidance overlay (silhouette outline for alignment).
  - [ ] 2.3 Capture photo on user action (tap/click).

- [ ] Task 3: Absorb mode zero-friction flow (AC: #3)
  - [ ] 3.1 Check store billing_mode from API config endpoint.
  - [ ] 3.2 If absorb mode: skip login, proceed directly to try-on.
  - [ ] 3.3 Shopper email resolved server-side via Shopify customer context (proxy handles this).

- [ ] Task 4: Write tests (AC: #1-3)
  - [ ] 4.1 Test privacy disclosure blocks camera until acknowledged.
  - [ ] 4.2 Test absorb mode skips login flow.

## Dev Notes

- **This story is implemented in the wearon-shopify repo.**
- **FP-4**: Shopper login required for try-on (both modes). In absorb mode, email fetched server-side — shopper doesn't need to manually log in. [Source: architecture.md#FP-4]
- Shopper email resolved server-side via Shopify customer context. Never trusted from client payload.

### References

- [Source: architecture.md#FP-4] — Shopper Login Required
- [Source: architecture.md#ADR-3] — Plugin Architecture

## Dev Agent Record

### Agent Model Used

(to be filled by dev agent)

### Debug Log References

### Completion Notes List

### File List
