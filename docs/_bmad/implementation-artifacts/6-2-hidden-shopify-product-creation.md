# Story 6.2: Hidden Shopify Product Creation

Status: ready-for-dev

## Story

As a **store owner in resell mode**,
I want **a "Try-On Credit" digital product auto-created in my Shopify catalog**,
so that **shoppers can purchase credits through my store's existing checkout**.

## Acceptance Criteria

1. **Given** a store enables resell mode, **When** the configuration is saved, **Then** a hidden digital product "Try-On Credit" is created via the Shopify Admin API **And** the product is removed from the Online Store sales channel (not browsable) **And** the variant price matches the store's configured retail credit price.

2. **Given** the hidden product exists, **When** the plugin shows credit purchase options, **Then** it uses a direct cart link (`store.myshopify.com/cart/{variant_id}:{quantity}`) to open Shopify checkout in a new tab.

3. **Given** the store owner changes the retail credit price, **When** the price is updated, **Then** the Shopify product variant price is updated via Admin API.

## Tasks / Subtasks

- [ ] Task 1: Auto-create hidden Shopify product (AC: #1)
  - [ ] 1.1 In wearon platform, create service function to create Shopify product via Admin API using `@shopify/shopify-api`.
  - [ ] 1.2 Product details: title "Try-On Credit", type "digital", hidden from Online Store sales channel.
  - [ ] 1.3 Create variant with price matching `stores.retail_credit_price`.
  - [ ] 1.4 Store `shopify_product_id` and `shopify_variant_id` in `stores` table.
  - [ ] 1.5 Trigger product creation when billing mode switches to `resell_mode` (from Story 6.1 config endpoint).

- [ ] Task 2: Update product price on change (AC: #3)
  - [ ] 2.1 When `retail_credit_price` is updated via config endpoint, update Shopify variant price via Admin API.
  - [ ] 2.2 Use stored access token (AES-256 decrypted) to authenticate Shopify Admin API calls.

- [ ] Task 3: Cart link generation for plugin (AC: #2)
  - [ ] 3.1 Add endpoint or extend `/api/v1/stores/config` to return `shopify_variant_id` and `shop_domain`.
  - [ ] 3.2 Plugin constructs cart link: `https://{shop_domain}/cart/{variant_id}:{quantity}`.
  - [ ] 3.3 Cart link opens in new tab — shopper completes purchase via native Shopify checkout.

- [ ] Task 4: Write tests (AC: #1-3)
  - [ ] 4.1 Test enabling resell mode creates hidden Shopify product.
  - [ ] 4.2 Test product is hidden from Online Store sales channel.
  - [ ] 4.3 Test price update syncs to Shopify variant.
  - [ ] 4.4 Test cart link format is correct.

## Dev Notes

### Architecture Requirements

- **FR12**: System creates "Try-On Credit" digital product when resell mode enabled.
- **Resell Mode Architecture**: Hidden product, removed from Online Store sales channel, not browsable. [Source: architecture.md#Resell Mode Architecture]
- Access token stored as AES-256 encrypted in `stores.access_token`. Must decrypt before Shopify Admin API calls.

### Shopify Admin API

- Use `@shopify/shopify-api` (installed in Story 2.2) for Admin API calls.
- Product creation: `POST /admin/api/2024-01/products.json` (or GraphQL Admin API).
- Variant update: `PUT /admin/api/2024-01/variants/{variant_id}.json`.
- Remove from Online Store: update product publication to exclude Online Store channel.

### Dependencies

- Story 2.2: `@shopify/shopify-api` installed, Shopify OAuth (access tokens available).
- Story 6.1: Billing mode configuration (triggers product creation).
- Story 1.1: `stores` table with `shopify_product_id`, `shopify_variant_id` columns.

### References

- [Source: architecture.md#Resell Mode Architecture] — Credit Purchase UX, Credit Product Management
- [Source: architecture.md#ADR-5] — Free Connector App Pattern
- [Source: epics.md#Story 6.2] — Hidden Shopify Product Creation

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
