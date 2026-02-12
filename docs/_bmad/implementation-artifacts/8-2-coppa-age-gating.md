# Story 8.2: COPPA Age Gating

Status: ready-for-dev

## Story

As a **platform operator**,
I want **users under 13 blocked from try-on features**,
so that **the platform complies with COPPA requirements**.

## Acceptance Criteria

1. **Given** the try-on feature (both B2B plugin and B2C app), **When** a user attempts to use camera-based features, **Then** an age verification gate is presented **And** users who indicate they are under 13 are blocked from accessing try-on and size rec features **And** no photo data is collected from users who fail the age gate.

2. **Given** existing B2C authentication (FR49), **When** B2C users sign up and authenticate, **Then** authentication continues to work unchanged through existing Supabase Auth.

## Tasks / Subtasks

- [ ] Task 1: Age gate component — B2C app (AC: #1)
  - [ ] 1.1 Create `packages/app/features/auth/age-gate.tsx` — date of birth input or "Are you 13 or older?" confirmation.
  - [ ] 1.2 Block access to try-on and size rec if user indicates under 13.
  - [ ] 1.3 Store age verification result in session storage (per-session, not persisted to database for privacy).
  - [ ] 1.4 Show once per session — don't re-ask after successful verification.

- [ ] Task 2: Age gate — B2B plugin (AC: #1)
  - [ ] 2.1 In wearon-shopify theme app extension, add age gate before camera access.
  - [ ] 2.2 Simple "I confirm I am 13 or older" checkbox or button.
  - [ ] 2.3 Store verification in session storage.
  - [ ] 2.4 If under 13: show message "This feature is not available for users under 13" and hide try-on/size rec buttons.

- [ ] Task 3: Server-side enforcement (AC: #1)
  - [ ] 3.1 Add `age_verified` boolean to generation create request payload (both tRPC and REST).
  - [ ] 3.2 Reject generation requests where `age_verified !== true` with 403: `{ data: null, error: { code: "AGE_VERIFICATION_REQUIRED", message: "Age verification is required to use this feature" } }`.
  - [ ] 3.3 Never collect or store date of birth — only store boolean confirmation.

- [ ] Task 4: Ensure B2C auth unchanged (AC: #2)
  - [ ] 4.1 Verify existing B2C signup/login flow works without modification.
  - [ ] 4.2 Age gate is separate from authentication — it's a feature gate, not an auth gate.

- [ ] Task 5: Write tests (AC: #1-2)
  - [ ] 5.1 Test age gate blocks under-13 users from try-on.
  - [ ] 5.2 Test age gate allows 13+ users to proceed.
  - [ ] 5.3 Test server rejects generation without age verification.
  - [ ] 5.4 Test no photo data collected before age verification.
  - [ ] 5.5 Verify B2C auth endpoints unchanged.

## Dev Notes

- **This story spans wearon (server-side enforcement + B2C app), wearon-shopify (plugin age gate).**
- **FR53**: Block users under 13 from try-on features (COPPA compliance).
- **Privacy-first**: Never collect or store date of birth. Only a boolean "13 or older" confirmation.
- Age gate is checked client-side before camera access AND server-side before generation processing.

### COPPA Compliance Notes

- COPPA applies to users under 13 — requires parental consent for data collection.
- Simplest compliant approach: block access entirely for users who indicate they're under 13.
- No personal data collected from minors — age gate happens before camera opens.
- Session-scoped — don't persist age data (minimizes data collection).

### Dependencies

- Story 4.3: Privacy disclosure (age gate shown before privacy disclosure, before camera).
- Story 4.1: Generation create endpoint (add `age_verified` check).
- Existing B2C generation router: add `age_verified` parameter.

### Flow Order

1. User taps "Try On"
2. **Age gate** → "I confirm I am 13 or older"
3. **Privacy disclosure** → "Your photo is deleted within 6 hours"
4. **Camera access** → Pose guidance overlay

### References

- [Source: epics.md#Story 8.2] — COPPA Age Gating
- [Source: architecture.md#Privacy & Compliance] — COPPA requirements

## Dev Agent Record

### Agent Model Used

(to be filled by dev agent)

### Debug Log References

### Completion Notes List

### File List
