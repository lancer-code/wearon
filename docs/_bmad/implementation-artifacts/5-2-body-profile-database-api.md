# Story 5.2: Body Profile Database & API

Status: ready-for-dev

## Story

As a **B2C user**,
I want **to save my body profile after the first measurement**,
so that **I get instant size recommendations without re-uploading every time**.

## Acceptance Criteria

1. **Given** a new Supabase migration, **When** applied, **Then** a `user_body_profiles` table is created with columns: `user_id`, `height_cm`, `weight_kg`, `body_type`, `fit_preference`, `gender`, `est_chest_cm`, `est_waist_cm`, `est_hip_cm`, `est_shoulder_cm`, `source` **And** `user_id` has a unique constraint (one profile per user).

2. **Given** a tRPC endpoint for body profile, **When** a B2C user saves their body profile, **Then** the profile is stored in `user_body_profiles` and returned on subsequent requests.

3. **Given** a returning B2C user, **When** they request a size recommendation, **Then** the saved body profile is used without requiring a new photo for measurements.

## Tasks / Subtasks

- [ ] Task 1: Create Supabase migration for user_body_profiles (AC: #1)
  - [ ] 1.1 Create migration file `supabase/migrations/008_user_body_profiles.sql`.
  - [ ] 1.2 Define table with columns: `id` (uuid, PK), `user_id` (uuid, FK → auth.users, UNIQUE), `height_cm` (numeric, NOT NULL), `weight_kg` (numeric, nullable), `body_type` (text, nullable), `fit_preference` (text, nullable), `gender` (text, nullable), `est_chest_cm` (numeric, nullable), `est_waist_cm` (numeric, nullable), `est_hip_cm` (numeric, nullable), `est_shoulder_cm` (numeric, nullable), `source` (text, NOT NULL, default 'manual'), `created_at` (timestamptz), `updated_at` (timestamptz).
  - [ ] 1.3 Add `source` CHECK constraint: `manual`, `mediapipe`, `user_input`.
  - [ ] 1.4 Add RLS policy: users can only read/write their own profile.

- [ ] Task 2: Create tRPC body profile endpoints (AC: #2, #3)
  - [ ] 2.1 Create `packages/api/src/routers/body-profile.ts` with `protectedProcedure`.
  - [ ] 2.2 Implement `getProfile` query: fetch user's body profile, return null if not exists.
  - [ ] 2.3 Implement `saveProfile` mutation: upsert body profile (insert or update on conflict).
  - [ ] 2.4 Implement `updateFromSizeRec` mutation: update profile with measurements from size rec response (source: `mediapipe`).
  - [ ] 2.5 Register router in `packages/api/src/routers/_app.ts`.

- [ ] Task 3: Write tests (AC: #1-3)
  - [ ] 3.1 Test migration creates table with correct constraints.
  - [ ] 3.2 Test saveProfile creates new profile and returns it.
  - [ ] 3.3 Test saveProfile upserts on existing profile.
  - [ ] 3.4 Test getProfile returns null for new user.
  - [ ] 3.5 Test RLS prevents cross-user profile access.

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

(to be filled by dev agent)

### Debug Log References

### Completion Notes List

### File List
