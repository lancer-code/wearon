# Story 5.2: Body Profile Database & API

Status: review

## Story

As a **B2C user**,
I want **to save my body profile after the first measurement**,
so that **I get instant size recommendations without re-uploading every time**.

## Acceptance Criteria

1. **Given** a new Supabase migration, **When** applied, **Then** a `user_body_profiles` table is created with columns: `user_id`, `height_cm`, `weight_kg`, `body_type`, `fit_preference`, `gender`, `est_chest_cm`, `est_waist_cm`, `est_hip_cm`, `est_shoulder_cm`, `source` **And** `user_id` has a unique constraint (one profile per user).

2. **Given** a tRPC endpoint for body profile, **When** a B2C user saves their body profile, **Then** the profile is stored in `user_body_profiles` and returned on subsequent requests.

3. **Given** a returning B2C user, **When** they request a size recommendation, **Then** the saved body profile is used without requiring a new photo for measurements.

## Tasks / Subtasks

- [x] Task 1: Create Supabase migration for user_body_profiles (AC: #1)
  - [x] 1.1 Create migration file `supabase/migrations/008_user_body_profiles.sql`.
  - [x] 1.2 Define table with columns: `id` (uuid, PK), `user_id` (uuid, FK → auth.users, UNIQUE), `height_cm` (numeric, NOT NULL), `weight_kg` (numeric, nullable), `body_type` (text, nullable), `fit_preference` (text, nullable), `gender` (text, nullable), `est_chest_cm` (numeric, nullable), `est_waist_cm` (numeric, nullable), `est_hip_cm` (numeric, nullable), `est_shoulder_cm` (numeric, nullable), `source` (text, NOT NULL, default 'manual'), `created_at` (timestamptz), `updated_at` (timestamptz).
  - [x] 1.3 Add `source` CHECK constraint: `manual`, `mediapipe`, `user_input`.
  - [x] 1.4 Add RLS policy: users can only read/write their own profile.

- [x] Task 2: Create tRPC body profile endpoints (AC: #2, #3)
  - [x] 2.1 Create `packages/api/src/routers/body-profile.ts` with `protectedProcedure`.
  - [x] 2.2 Implement `getProfile` query: fetch user's body profile, return null if not exists.
  - [x] 2.3 Implement `saveProfile` mutation: upsert body profile (insert or update on conflict).
  - [x] 2.4 Implement `updateFromSizeRec` mutation: update profile with measurements from size rec response (source: `mediapipe`).
  - [x] 2.5 Register router in `packages/api/src/routers/_app.ts`.

- [x] Task 3: Write tests (AC: #1-3)
  - [x] 3.1 Test migration creates table with correct constraints.
  - [x] 3.2 Test saveProfile creates new profile and returns it.
  - [x] 3.3 Test saveProfile upserts on existing profile.
  - [x] 3.4 Test getProfile returns null for new user.
  - [x] 3.5 Test RLS prevents cross-user profile access.

## Dev Notes

### Architecture Requirements

- **BR9**: Size rec from single photo + height input, auto-filled body profile form (first time only). [Source: architecture.md]
- **ADR-2**: This is a B2C table — uses standard Supabase RLS (not B2B application-level scoping).
- B2C table: `user_body_profiles` follows existing B2C pattern (`users`, `user_credits`).

### Dependencies

- Story 5.1: Size rec proxy endpoint (provides measurements to save).
- Story 5.4: MediaPipe service (generates the measurements).
- No B2B dependencies — this is B2C-only.

### Migration Numbering

- Check existing migration count. Next available number after all B2B migrations (005, 006, 007).
- Migration 008 assumed — verify before creating.

### References

- [Source: architecture.md#ADR-2] — Full Data Separation (B2C tables use RLS)
- [Source: epics.md#Story 5.2] — Body Profile Database & API
- [Source: architecture.md#Data Architecture] — Migration approach

### Database Types

- Use generated Supabase types from `packages/api/src/types/database.ts` for all database operations where applicable.
- Regenerate types after any migration: `npx supabase gen types typescript --project-id ljilupbgmrizblkzokfa > packages/api/src/types/database.ts`

### Workflow

- **Commit code after story completion.** Each completed story should be committed as a standalone commit before moving to the next story.

## Dev Agent Record

### Agent Model Used

Codex (GPT-5)

### Debug Log References

- Red phase: migration/router tests failed initially (missing `008_user_body_profiles.sql` and missing `body-profile` router registration)
- Green phase: implemented migration + router + app router registration and reran targeted tests
- Targeted tests passing:
  - `packages/api/__tests__/migrations/user-body-profiles-migration.test.ts` (`2/2`)
  - `packages/api/__tests__/routers/body-profile.test.ts` (`4/4`)
- Full regression run: no new story-related failures; remaining failures are pre-existing environment/infrastructure tests (`packages/api/__tests__/migrations/b2b-schema.test.ts`, `apps/next/__tests__/build.test.ts`, `apps/next/__tests__/dev.test.ts`)
- Biome checks: format/check passed for all Story 5.2 touched code files

### Implementation Plan

- Add B2C `user_body_profiles` table migration with constraints and RLS ownership policies
- Implement protected tRPC router for profile get/save/upsert-from-size-rec
- Ensure router is registered under app router for client availability
- Add tests validating migration contract and user-scoped router behavior
### Completion Notes List

- Added `supabase/migrations/008_user_body_profiles.sql` with:
  - `user_body_profiles` table and required columns
  - `UNIQUE(user_id)` one-profile-per-user constraint
  - `source` check constraint (`manual`, `mediapipe`, `user_input`)
  - RLS enabled with own-profile SELECT/INSERT/UPDATE policies
  - `updated_at` trigger using existing `update_updated_at_column()`
- Implemented `packages/api/src/routers/body-profile.ts`:
  - `getProfile`: returns current user's profile or `null` when absent
  - `saveProfile`: upserts manual/user-input body profile on `user_id`
  - `updateFromSizeRec`: upserts profile measurements from size rec with `source: 'mediapipe'`
  - Router uses `protectedProcedure` and always scopes writes/reads by `ctx.user.id`
- Registered router in `packages/api/src/routers/_app.ts` as `bodyProfile`
- Added tests for migration contract and router behavior, including user scoping and upsert flows
### File List

- `supabase/migrations/008_user_body_profiles.sql` (created)
- `packages/api/src/routers/body-profile.ts` (created)
- `packages/api/src/routers/_app.ts` (modified)
- `packages/api/__tests__/migrations/user-body-profiles-migration.test.ts` (created)
- `packages/api/__tests__/routers/body-profile.test.ts` (created)

### Change Log

| Change | Reason |
|--------|--------|
| Added `user_body_profiles` migration with RLS ownership policies | Fulfill AC #1 and enforce one-profile-per-user security model |
| Added `body-profile` tRPC router with get/save/updateFromSizeRec | Fulfill AC #2/#3 for persistent B2C body profile flow |
| Added migration/router tests for constraints, upsert behavior, and user scoping | Validate AC #1-#3 and prevent regressions |
