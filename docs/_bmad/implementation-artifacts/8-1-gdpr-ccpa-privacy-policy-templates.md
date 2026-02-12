# Story 8.1: GDPR/CCPA Privacy Policy Templates

Status: ready-for-dev

## Story

As a **store owner**,
I want **ready-to-use privacy policy templates for my store**,
so that **I can comply with data privacy regulations when offering try-on features**.

## Acceptance Criteria

1. **Given** the merchant dashboard or documentation, **When** a store owner accesses privacy resources, **Then** a GDPR-compliant privacy policy template is available covering photo processing, 6-hour deletion, and third-party (OpenAI) data handling **And** a CCPA-compliant privacy disclosure template is available **And** a 3-party data processing agreement template (store → WearOn → OpenAI) is available.

## Tasks / Subtasks

- [ ] Task 1: Create privacy policy templates (AC: #1)
  - [ ] 1.1 Create GDPR privacy policy template covering: photo data collection, purpose (virtual try-on), 6-hour auto-deletion, third-party processing (OpenAI), data subject rights (access, deletion, portability).
  - [ ] 1.2 Create CCPA privacy disclosure template covering: categories of personal information collected (biometric data — photos), purpose of collection, sale/sharing disclosure (not sold), right to delete, right to opt-out.
  - [ ] 1.3 Create 3-party data processing agreement (DPA) template: store (controller) → WearOn (processor) → OpenAI (sub-processor). Include data flow description, security measures, breach notification.

- [ ] Task 2: Privacy resource page — merchant dashboard (AC: #1)
  - [ ] 2.1 Create `packages/app/features/merchant/privacy-resources-screen.tsx` component.
  - [ ] 2.2 Display templates as downloadable/copyable text with store name auto-filled.
  - [ ] 2.3 Create `apps/next/app/(merchant)/privacy/page.tsx` route.

- [ ] Task 3: Privacy API endpoint for plugin (AC: #1)
  - [ ] 3.1 Create or extend `/api/v1/stores/config` to include privacy disclosure text.
  - [ ] 3.2 Return pre-formatted privacy disclosure text for the plugin's privacy modal.
  - [ ] 3.3 Include: "Your photo is processed by WearOn and deleted within 6 hours."

- [ ] Task 4: App Bridge privacy link (AC: #1)
  - [ ] 4.1 In wearon-shopify `app/routes/app.settings.tsx`, add link to WearOn platform privacy resources page.
  - [ ] 4.2 Alternatively, display templates directly in App Bridge using Polaris Card components.

- [ ] Task 5: Write tests (AC: #1)
  - [ ] 5.1 Test privacy resource page renders all three templates.
  - [ ] 5.2 Test config endpoint returns privacy disclosure text.
  - [ ] 5.3 Test store name auto-fills in templates.

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

(to be filled by dev agent)

### Debug Log References

### Completion Notes List

### File List
