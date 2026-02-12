# Story 4.4: Plugin Accessibility (wearon-shopify)

Status: ready-for-dev

## Story

As a **shopper with accessibility needs**,
I want **the plugin to be fully accessible**,
so that **I can use virtual try-on regardless of my abilities**.

## Acceptance Criteria

1. **Given** the plugin UI, **When** tested against WCAG 2.1 Level AA standards, **Then** all interactions support screen readers and keyboard navigation **And** all text elements meet minimum 4.5:1 contrast ratio **And** all touch targets are minimum 44x44px on mobile **And** pose guidance overlay has an audio alternative for visually impaired users.

## Tasks / Subtasks

- [ ] Task 1: Screen reader support (AC: #1)
  - [ ] 1.1 Add proper ARIA labels to all interactive elements.
  - [ ] 1.2 Add ARIA live regions for status updates (generation progress).
  - [ ] 1.3 Ensure logical tab order through widget.

- [ ] Task 2: Keyboard navigation (AC: #1)
  - [ ] 2.1 All widget interactions accessible via keyboard (no mouse-only actions).
  - [ ] 2.2 Visible focus indicators on all interactive elements.
  - [ ] 2.3 Escape key closes modals/overlays.

- [ ] Task 3: Visual accessibility (AC: #1)
  - [ ] 3.1 Audit all text for 4.5:1 minimum contrast ratio.
  - [ ] 3.2 Ensure all touch targets are minimum 44x44px.
  - [ ] 3.3 Support high contrast mode / forced-colors media query.

- [ ] Task 4: Pose guidance audio alternative (AC: #1)
  - [ ] 4.1 Add audio cues for pose guidance overlay (e.g., "Move left", "Center yourself").
  - [ ] 4.2 Provide option to toggle audio guidance on/off.

- [ ] Task 5: Write tests (AC: #1)
  - [ ] 5.1 Automated accessibility audit (axe-core or similar).
  - [ ] 5.2 Test keyboard-only navigation flow.
  - [ ] 5.3 Test screen reader announcements.

## Dev Notes

- **This story is implemented in the wearon-shopify repo.**
- **NFR18-NFR23**: WCAG 2.1 AA compliance requirements.
- Plugin must never break store accessibility — sandboxed widget doesn't affect host page.

### References

- [Source: architecture.md#NFR18-NFR23] — Accessibility requirements
- [Source: epics.md#Epic 4] — Accessibility NFRs

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
