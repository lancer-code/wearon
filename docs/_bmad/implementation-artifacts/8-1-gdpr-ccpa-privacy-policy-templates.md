# Story 8.1: GDPR/CCPA Privacy Policy Templates

Status: review

## Story

As a **store owner**,
I want **ready-to-use privacy policy templates for my store**,
so that **I can comply with data privacy regulations when offering try-on features**.

## Acceptance Criteria

1. **Given** the merchant dashboard or documentation, **When** a store owner accesses privacy resources, **Then** a GDPR-compliant privacy policy template is available covering photo processing, 6-hour deletion, and third-party (OpenAI) data handling **And** a CCPA-compliant privacy disclosure template is available **And** a 3-party data processing agreement template (store → WearOn → OpenAI) is available.

## Tasks / Subtasks

- [x] Task 1: Create privacy policy templates (AC: #1)
  - [x] 1.1 Create GDPR privacy policy template covering: photo data collection, purpose (virtual try-on), 6-hour auto-deletion, third-party processing (OpenAI), data subject rights (access, deletion, portability).
  - [x] 1.2 Create CCPA privacy disclosure template covering: categories of personal information collected (biometric data — photos), purpose of collection, sale/sharing disclosure (not sold), right to delete, right to opt-out.
  - [x] 1.3 Create 3-party data processing agreement (DPA) template: store (controller) → WearOn (processor) → OpenAI (sub-processor). Include data flow description, security measures, breach notification.

- [x] Task 2: Privacy resource page — merchant dashboard (AC: #1)
  - [x] 2.1 Create `packages/app/features/merchant/privacy-resources-screen.tsx` component.
  - [x] 2.2 Display templates as downloadable/copyable text with store name auto-filled.
  - [x] 2.3 Create `apps/next/app/merchant/privacy/page.tsx` route.

- [x] Task 3: Privacy API endpoint for plugin (AC: #1)
  - [x] 3.1 Extended `/api/v1/stores/config` GET response to include `privacy_disclosure` field.
  - [x] 3.2 Returns pre-formatted privacy disclosure text for the plugin's privacy modal.
  - [x] 3.3 Include: "Your photo is processed by WearOn and deleted within 6 hours."

- [ ] Task 4: App Bridge privacy link (AC: #1) — BLOCKED: wearon-shopify repo not available locally
  - [ ] 4.1 In wearon-shopify `app/routes/app.settings.tsx`, add link to WearOn platform privacy resources page.
  - [ ] 4.2 Alternatively, display templates directly in App Bridge using Polaris Card components.

- [x] Task 5: Write tests (AC: #1)
  - [x] 5.1 Test privacy templates render all three templates with correct content.
  - [x] 5.2 Test config endpoint returns privacy disclosure text.
  - [x] 5.3 Test store name auto-fills in templates.

## Dev Notes

### Architecture Requirements

- **FR52**: GDPR/CCPA privacy policy templates for stores.
- **NFR9**: User photos never stored beyond 6-hour auto-delete window.
- Templates are static content with store-name placeholders — not generated dynamically.

### Privacy Compliance Key Points

- **Photo data**: Collected for virtual try-on processing only. Deleted within 6 hours.
- **Third-party**: OpenAI processes images for generation. OpenAI's data handling policies apply.
- **No long-term storage**: Generated images saved only to user's device after the 6-hour window.
- **Shopper email (resell mode)**: Used for credit balance tracking. Disclosed in privacy policy.

### Dependencies

- Story 2.3: Merchant dashboard (provides the page context).
- Story 4.3: Privacy disclosure in plugin (uses the disclosure text from this story).
- No database changes required — templates are static content.

### References

- [Source: architecture.md#Privacy & Compliance] — GDPR/CCPA, 6-hour auto-delete
- [Source: epics.md#Story 8.1] — GDPR/CCPA Privacy Policy Templates

### Database Types

- Use generated Supabase types from `packages/api/src/types/database.ts` for all database operations where applicable.
- Regenerate types after any migration: `npx supabase gen types typescript --project-id ljilupbgmrizblkzokfa > packages/api/src/types/database.ts`

### Workflow

- **Commit code after story completion.** Each completed story should be committed as a standalone commit before moving to the next story.

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- No debug issues encountered during implementation.

### Completion Notes List

- Created `packages/api/src/templates/privacy-policy.ts` with three template functions (`getGdprTemplate`, `getCcpaTemplate`, `getDpaTemplate`) and a `PLUGIN_PRIVACY_DISCLOSURE` constant.
- All templates accept an optional `storeName` parameter; defaults to `{{STORE_NAME}}` placeholder.
- GDPR template covers: data controller, data collected (photos, measurements, email), purpose, 6-hour retention, third-party processing (WearOn + OpenAI), all data subject rights (access, rectification, erasure, restriction, portability, objection, withdraw consent), international transfers, security measures.
- CCPA template covers: biometric data category, purpose, no-sale disclosure, 6-hour retention, right to know/delete/opt-out/non-discrimination/correct.
- DPA template covers: 3-party data flow (Controller → Processor → Sub-Processor), data categories, 6-hour retention, processor obligations, sub-processor terms (OpenAI), security measures (TLS, AES-256), 72-hour breach notification, audit rights.
- Created `privacy-resources-screen.tsx` merchant dashboard component with expandable/copyable template cards, store name auto-fill from `trpc.merchant.getMyStore`, and usage instructions.
- Created `/merchant/privacy` page route and added "Privacy" nav link with Shield icon in merchant sidebar.
- Extended `/api/v1/stores/config` GET response to include `privacyDisclosure` field (snake_cased to `privacy_disclosure` by `successResponse`).
- Updated existing `stores-config.route.test.ts` to expect `privacy_disclosure` in GET response.
- Task 4 (App Bridge privacy link) is BLOCKED — requires `wearon-shopify` repo.
- 19 template tests + 5 stores-config tests = 24 tests all passing.

### File List

- `packages/api/src/templates/privacy-policy.ts` — NEW: GDPR, CCPA, DPA templates and plugin disclosure constant
- `packages/app/features/merchant/privacy-resources-screen.tsx` — NEW: Privacy resources merchant page component
- `apps/next/app/merchant/privacy/page.tsx` — NEW: Merchant privacy page route
- `packages/app/features/merchant/merchant-sidebar.tsx` — MODIFIED: Added Shield import and Privacy nav item
- `packages/app/features/merchant/index.ts` — MODIFIED: Exported PrivacyResourcesScreen
- `apps/next/app/api/v1/stores/config/route.ts` — MODIFIED: Added PLUGIN_PRIVACY_DISCLOSURE import and privacyDisclosure field in GET response
- `apps/next/__tests__/stores-config.route.test.ts` — MODIFIED: Updated GET test to expect privacy_disclosure field
- `packages/api/__tests__/templates/privacy-policy.test.ts` — NEW: 19 tests for template content and store name auto-fill

## Change Log

- 2026-02-12: Implemented Tasks 1, 2, 3, 5 (templates, merchant page, API endpoint, tests). Task 4 blocked on wearon-shopify repo availability.
