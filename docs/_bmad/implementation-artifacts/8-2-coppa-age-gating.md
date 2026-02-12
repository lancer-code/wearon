# Story 8.2: COPPA Age Gating

Status: done

## Story

As a **platform operator**,
I want **users under 13 blocked from try-on features**,
so that **the platform complies with COPPA requirements**.

## Acceptance Criteria

1. **Given** the try-on feature (both B2B plugin and B2C app), **When** a user attempts to use camera-based features, **Then** an age verification gate is presented **And** users who indicate they are under 13 are blocked from accessing try-on and size rec features **And** no photo data is collected from users who fail the age gate.

2. **Given** existing B2C authentication (FR49), **When** B2C users sign up and authenticate, **Then** authentication continues to work unchanged through existing Supabase Auth.

## Tasks / Subtasks

- [x] Task 1: Age gate component — B2C app (AC: #1)
  - [x] 1.1 Create `packages/app/features/auth/age-gate.tsx` — date of birth input or "Are you 13 or older?" confirmation.
  - [x] 1.2 Block access to try-on and size rec if user indicates under 13.
  - [x] 1.3 Store age verification result in session storage (per-session, not persisted to database for privacy).
  - [x] 1.4 Show once per session — don't re-ask after successful verification.

- [x] Task 2: Age gate — B2B plugin (AC: #1)
  - [x] 2.1 In wearon-shopify theme app extension, add age gate before camera access.
  - [x] 2.2 Simple "I confirm I am 13 or older" checkbox or button.
  - [x] 2.3 Store verification in session storage.
  - [x] 2.4 If under 13: show message "This feature is not available for users under 13" and hide try-on/size rec buttons.

- [x] Task 3: Server-side enforcement (AC: #1)
  - [x] 3.1 Add `age_verified` boolean to generation create request payload (both tRPC and REST).
  - [x] 3.2 Reject generation requests where `age_verified !== true` with 403: `{ data: null, error: { code: "AGE_VERIFICATION_REQUIRED", message: "Age verification is required to use this feature" } }`.
  - [x] 3.3 Never collect or store date of birth — only store boolean confirmation.

- [x] Task 4: Ensure B2C auth unchanged (AC: #2)
  - [x] 4.1 Verify existing B2C signup/login flow works without modification.
  - [x] 4.2 Age gate is separate from authentication — it's a feature gate, not an auth gate.

- [x] Task 5: Write tests (AC: #1-2)
  - [x] 5.1 Test age gate blocks under-13 users from try-on.
  - [x] 5.2 Test age gate allows 13+ users to proceed.
  - [x] 5.3 Test server rejects generation without age verification.
  - [x] 5.4 Test no photo data collected before age verification.
  - [x] 5.5 Verify B2C auth endpoints unchanged.

### Review Follow-ups (AI)

- [x] [AI-Review][INFO] Implementation is comprehensive and COPPA-compliant. Age gate component uses privacy-first approach (session storage only, no DOB persistence). Server-side enforcement properly validates `age_verified`/`ageVerified` BEFORE credit deduction in both B2C tRPC (generation.ts:46-51) and B2B REST (create/route.ts:128-134). Flow order enforced: Age Gate → Privacy Disclosure → Camera Access. B2C auth files completely untouched per git diff. All 15 tests passing. **VERIFIED 2026-02-13**: No issues found. Story complete.

### Re-Review 2 Follow-ups (2026-02-13)

- [x] [AI-Review][MEDIUM] Missing analytics logging for age verification failures: No server-side logging when users fail age verification (indicate under 13 or missing verification). Critical for COPPA compliance auditing - platform should track minor access attempts and blocks. [packages/api/src/routers/generation.ts:47-52, apps/next/app/api/v1/generation/create/route.ts:128-134] **FIXED 2026-02-13**: Added logger.warn() for age verification failures in both B2C tRPC (event: 'age_verification_failed_b2c') and B2B REST (event: 'age_verification_failed_b2b') endpoints, logging userId/storeId and ageVerified value for compliance auditing.
- [x] [AI-Review][MEDIUM] Session storage lacks timestamp/expiry validation: Age verification stored indefinitely in session storage with no timestamp. Verification timestamp could be tampered with or remain valid beyond intended duration. [packages/app/features/auth/age-gate.tsx:16-22, wearon-shopify/.../tryon-privacy-flow.js:91-98] **FIXED 2026-02-13**: Added timestamp validation in both B2C and B2B implementations. Created AGE_VERIFIED_TIMESTAMP_KEY with 24-hour expiry (MAX_AGE_VERIFICATION_DURATION_MS). isAgeVerified() now validates timestamp exists, is valid number, is not in future (tamper detection), and is within 24-hour window. Added 7 tests covering invalid/missing/future/expired timestamps.
- [x] [AI-Review][LOW] Race condition in useAgeGate hook: Initial state (line 37) and useEffect (lines 40-42) both read session storage, causing potential component flicker between verified/not-verified states on mount. [packages/app/features/auth/age-gate.tsx:37-42] **FIXED 2026-02-13**: Removed redundant useEffect that was re-reading session storage after mount. Now only reads once during useState initialization, preventing race condition and component flicker.
- [x] [AI-Review][LOW] Generic error message for age verification failures: Server returns generic "Age verification is required to use this feature" message. Should provide more specific COPPA compliance context for better user understanding. [packages/api/src/routers/generation.ts:50, apps/next/app/api/v1/generation/create/route.ts:131] **FIXED 2026-02-13**: Updated error messages to include COPPA context: "You must be 13 or older to use this feature. Age verification is required for COPPA compliance." Provides clearer guidance to users about age requirement and compliance reason.

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

### Database Types

- Use generated Supabase types from `packages/api/src/types/database.ts` for all database operations where applicable.
- Regenerate types after any migration: `npx supabase gen types typescript --project-id ljilupbgmrizblkzokfa > packages/api/src/types/database.ts`

### Workflow

- **Commit code after story completion.** Each completed story should be committed as a standalone commit before moving to the next story.

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

None required — all 15 tests passed on first run, no regressions in 34 existing tests.

### Completion Notes List

- Created B2C age gate component with `useAgeGate` hook, `AgeGate` wrapper component, and session storage helpers (`isAgeVerified`, `setAgeVerified`)
- Added age gate to B2B Shopify plugin: `isAgeVerified`/`setAgeVerified` in tryon-privacy-flow.js, age gate UI elements in tryon-widget.js (confirm button, deny button, blocked message)
- Flow order enforced: Age Gate → Privacy Disclosure → Camera Access (matches story spec)
- B2C tRPC: Added `ageVerified: z.boolean()` to generation.create input, throws FORBIDDEN if not true
- B2B REST: Added `age_verified` check to generation create route, returns 403 with AGE_VERIFICATION_REQUIRED error code
- Privacy-first: Only a boolean `true` stored in session storage — no DOB, no age data persisted to database
- B2C auth files (login-screen, signup-screen, google-sign-in-button, auth-form-container) completely untouched — AC #2 verified via git diff

### File List

- `packages/app/features/auth/age-gate.tsx` (new) — B2C age gate component + useAgeGate hook + session storage helpers
- `packages/api/src/routers/generation.ts` (modified) — added ageVerified to create input schema, FORBIDDEN check
- `apps/next/app/api/v1/generation/create/route.ts` (modified) — added age_verified check with AGE_VERIFICATION_REQUIRED error
- `wearon-shopify/extensions/wearon-tryon/assets/tryon-privacy-flow.js` (modified) — added isAgeVerified, setAgeVerified functions
- `wearon-shopify/extensions/wearon-tryon/assets/tryon-widget.js` (modified) — added age gate UI before privacy flow
- `packages/api/__tests__/services/age-gate.test.ts` (new) — 15 tests covering all ACs
