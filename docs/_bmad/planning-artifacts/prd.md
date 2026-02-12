---
stepsCompleted: ['step-01-init', 'step-02-discovery', 'step-03-success', 'step-04-journeys', 'step-05-domain', 'step-06-innovation', 'step-07-project-type', 'step-08-scoping', 'step-09-functional', 'step-10-nonfunctional', 'step-11-polish', 'step-12-complete']
workflowStatus: 'complete'
inputDocuments:
  - docs/_bmad/analysis/brainstorming-session-2026-02-07.md
  - docs/_bmad/analysis/brainstorming-session-2026-02-01.md
  - docs/project-documentation/index.md
  - docs/project-documentation/project-overview.md
  - docs/project-documentation/architecture-api.md
  - docs/project-documentation/api-contracts.md
  - docs/project-documentation/data-models.md
workflowType: 'prd'
documentCounts:
  briefs: 0
  research: 0
  brainstorming: 2
  projectDocs: 7
classification:
  projectType: 'E-commerce Plugin (Shopify App) + Internal REST API'
  domain: 'E-commerce / Retail Tech'
  complexity: 'Medium-High'
  projectContext: 'brownfield'
  distribution: 'Shopify App Store first, public API second'
  revenue: 'Usage-based credits (wholesale + resell) with subscription tiers'
  channels: 'Dual - B2C phone app (existing) + B2B plugin (new)'
  b2bBillingModes: 'Store absorbs cost OR store resells credits to shoppers'
  elicitationInsights:
    - 'Free size rec is retention moat (First Principles)'
    - 'Thin margins need volume, CAC unknown (Shark Tank)'
    - 'B2B funnel has two modes: free vs resell (Stakeholder Round Table)'
    - '3-step onboarding max, quality SLA required (Pre-mortem)'
    - 'This is a Shopify App, not traditional SaaS (Comparative Matrix)'
---

# Product Requirements Document - WearOn

**Author:** Abaid
**Date:** 2026-02-08

## Executive Summary

**Product:** WearOn — a virtual try-on and size recommendation platform serving two channels: a Shopify plugin for e-commerce stores (B2B) and a consumer mobile app (B2C).

**Vision:** Reduce online clothing returns by letting shoppers see themselves in outfits and get accurate size recommendations before purchasing — directly on the store's product page.

**Differentiator:** First product to combine visual try-on + size recommendation + plug-and-play Shopify install. Competitors offer one or two of these; none combine all three. Free size recommendation (zero cost to serve) acts as retention moat while paid try-on ($0.08/generation) drives revenue.

**Target Users:**
- **Store Owners (B2B):** Shopify merchants losing revenue to fit-related returns. Install plugin, buy credits, offer try-on to shoppers.
- **Shoppers (B2B Channel):** End consumers on merchant stores who use the embedded widget for size rec and try-on.
- **Consumers (B2C):** Mobile app users who upload outfit photos from any online store for personal try-on.
- **Platform Admin:** WearOn operator managing stores, monitoring quality, and tracking revenue.

**Business Model:** Wholesale credit system with subscription tiers ($49-$199/month) and pay-as-you-go ($0.18/credit). Stores can absorb credit cost (shoppers try free) or resell credits to shoppers at markup via store's existing Shopify checkout.

**Distribution:** Shopify App Store (MVP), WordPress/WooCommerce (Post-MVP). No public API or JS SDK.

## Success Criteria

### User Success

**Store Owner (B2B):**
- Measurable return rate reduction within 30 days of install
- New revenue stream from reselling credits to shoppers at markup
- Clear ROI tracking via merchant analytics dashboard
- Success moment: first month where credit revenue exceeds credit cost

**Shopper (End User):**
- Size recommendation accurate on first order
- Emotional connection with try-on ("that's me wearing this")
- Increased trust in store offering personalized experience

### Business Success

| Timeframe | Target |
|---|---|
| Month 1 | Plugin live on Shopify App Store, 5 beta stores |
| Month 3 | 20 stores installed, healthy generation volume |
| Month 6 | Positive unit economics, organic App Store growth |
| Month 12 | Max store reach, product refined, begin in-house AI model |

### Technical Success

- Size rec accuracy: 90%+ MVP, 95%+ production
- Widget load: <2s mobile, generation: <10s end-to-end
- 99.5%+ API uptime
- Separate B2B/B2C logic within monorepo (auth, billing, analytics, API routes)
- Shared generation worker serving both channels
- Three analytics tiers: merchant dashboard, user dashboard, platform admin

### Measurable Outcomes

| Metric | MVP Target | Growth Target |
|---|---|---|
| Stores installed | 20 | 200+ |
| Try-on → purchase conversion | Track baseline | 15%+ improvement |
| Size rec accuracy | 90% | 95%+ |
| Return rate reduction/store | Track baseline | 30%+ reduction |
| Store monthly churn | <20% | <10% |
| Generation quality | 95%+ acceptable | 98%+ acceptable |

## Product Scope

### MVP - Minimum Viable Product

- Size recommendation + virtual try-on (both day 1)
- Shopify plugin (embeddable widget)
- B2B REST API (API key auth, separate from B2C tRPC)
- Merchant dashboard (credits, usage, analytics)
- 3-step merchant onboarding
- Credit system (wholesale + optional resell to shoppers)
- B2B analytics (store-level) + B2C analytics (user-level)
- Platform admin analytics (aggregated B2B + B2C view)
- Separate B2B/B2C code paths in monorepo

### Growth Features (Post-MVP)

- WooCommerce plugin
- Advanced analytics (ROI calculator, A/B testing, return tracking)
- Store-branded widget customization
- Bulk credit discounts, quality gate automation

### Vision (Future)

- In-house AI try-on model (replace OpenAI dependency)
- BigCommerce, Magento plugins
- Accessories specialization (hats, watches, necklaces)
- Multi-language widget

## User Journeys

### Journey 1: Store Owner Priya (B2B - Shopify Merchant)

**Opening Scene:** Priya runs a mid-size women's clothing store on Shopify. 28% of orders get returned - mostly "didn't fit" and "looked different than expected." She spends $3,400/month on return shipping alone. She finds WearOn on the Shopify App Store.

**Rising Action:**
1. Clicks "Install" on Shopify App Store → OAuth flow → plugin installed (step 1)
2. Lands on WearOn merchant dashboard → adds payment method (step 2)
3. Buys Starter credit pack ($49/350 credits) → widget auto-appears on product pages (step 3)
4. She's live. Total setup: 4 minutes.

**Decision point - billing mode:**
- **Option A:** Absorbs cost (shoppers try free) → maximizes adoption, costs $0.14/try-on
- **Option B:** Resells at $0.50/try-on → shoppers pay, she profits $0.36/credit

**Climax:** After 2 weeks: 847 try-ons, 312 size recs used, conversion rate up 18%. Cost: $118. Estimated 23 fewer returns saved = ~$276 in return shipping. Net positive.

**Resolution:** Upgrades to Growth plan. Switches to resell mode. Leaves 5-star review on Shopify App Store.

**Error path:** Zero usage after week 1 → automated tip email: "Move Try On button above the fold" → adjusts → usage starts.

### Journey 2: Shopper on Store Website (B2B Channel - Maya)

**Opening Scene:** Maya, 26, browsing Priya's store on phone. Likes a green wrap dress ($68) but between sizes M/L. Sees "Try On" button.

**Free mode (store absorbs cost):**
1. Taps "Try On" → widget opens full-screen
2. Privacy message: "Your photo is deleted within 6 hours"
3. Takes selfie with pose guidance overlay
4. Size rec appears instantly (~1 sec), try-on image loads (3-5 sec)

**Resell mode (store charges):**
1. Taps "Try On" → quick signup (email/Google) on widget
2. Sees pricing: "1 try-on: $0.50" or "5 pack: $1.50"
3. Pays via store's checkout → gets credits → same experience

**Climax:** Size rec: "Recommended: M." Try-on: sees herself in the dress. "92% of similar body types chose M."

**Resolution:** Adds to cart (Size M). Receives order. It fits.

**Error path:** Bad generation → "Sorry, this didn't turn out right. Credit refunded. Try a different photo."

### Journey 3: Consumer on WearOn App (B2C - Alex)

**Opening Scene:** Alex, 30, sees WearOn ad on Instagram. Downloads app, signs up with Google. Gets 10 free credits.

**Rising Action:**
1. Takes full-body photo → body profile auto-fills from photo
2. Reviews measurements (height is only required field) → saves profile (one-time)
3. Uploads outfit screenshot from any online store
4. Taps "Try On" → 1 credit deducted → generation queued

**Climax:** 3 seconds later, sees himself in the jacket. Size rec says "L." Screenshots and sends to girlfriend.

**Resolution:** Uses 4 more credits that week. Buys 15-credit pack ($1.50) when free credits run out.

**Error path:** Blurry photo → "Please upload a clearer photo" → retries → works. Credit not deducted for failed attempt.

### Journey 4: Platform Admin (Abaid - WearOn Owner)

**Opening Scene:** Monday morning. Opens admin panel to check weekend performance.

**Rising Action:**
1. Platform overview: B2B generations (12,400), B2C generations (3,200), active stores (18), active app users (890)
2. B2B analytics tab: store-by-store breakdown, credits consumed, churn risk flags
3. B2C analytics tab: user growth, credit purchases, generation success rate
4. Revenue dashboard: $2,100 B2B wholesale + $480 B2C credit packs = $2,580. Cost: $1,248 (OpenAI). Margin: 52%.
5. Quality metrics: 96.8% success rate, 2 moderation blocks, 14 refunds

**Climax:** Spots store #847 at 0 generations in 5 days (was 200/week). Churn risk. Sends check-in. Also catches B2C cost spike from 4K photo uploads.

**Resolution:** Fixes image processing edge case. Reaches out to at-risk store. Platform healthy.

### Journey 5: API Developer (Custom Integration) — DEFERRED TO VISION SCOPE

> **Note:** This journey is deferred to Phase 3 (Expansion). B2B is plugins-only for MVP and Growth. Included here for long-term vision reference.

**Opening Scene:** Dev team at a fashion brand wants WearOn try-on in their custom React storefront (not Shopify).

**Rising Action:**
1. Signs up for merchant account → gets API key
2. Reads REST API docs: `POST /api/v1/size-recommend` and `POST /api/v1/generation/create`
3. Tests with curl → both work
4. Builds custom widget using the two endpoints
5. Buys Growth plan ($99/800 credits)

**Climax:** Custom integration goes live. Full UI control, WearOn handles AI processing. Same merchant dashboard as Shopify stores.

**Error path:** 429 rate limit → checks docs → implements backoff → resolved.

### Journey Requirements Summary

| Capability | Journeys |
|---|---|
| Shopify OAuth install | 1 |
| Merchant dashboard + analytics | 1, 4, ~~5~~ (Vision) |
| Credit purchase (wholesale) | 1, ~~5~~ (Vision) |
| Billing mode config (absorb/resell) | 1, 2 |
| Mobile-first widget | 2 |
| Camera + pose guidance | 2, 3 |
| Privacy messaging + 6hr auto-delete | 2 |
| Instant size rec | 2, 3 |
| Queued try-on generation | 2, 3, ~~5~~ (Vision) |
| Shopper accounts (resell mode) | 2 |
| B2C auth + free credits | 3 |
| Body profile auto-fill | 3 |
| B2B analytics dashboard | 1, 4 |
| B2C analytics dashboard | 4 |
| Platform admin aggregated view | 4 |
| Churn detection | 4 |
| Public REST API + docs | ~~5~~ (Vision) |
| Rate limiting + headers | ~~5~~ (Vision) |
| Quality gate + auto-refund | 2, 3 |

## Domain-Specific Requirements

### Platform Compliance

- Shopify App Store review checklist (billing disclosure, data handling, uninstall cleanup)
- Shopify CSP-compatible widget loading (approved CDN, no inline scripts)
- Uninstall hook that clears all store data from WearOn's systems

### Data Privacy & Legal

- GDPR + CCPA privacy policy template for stores to embed
- 3-party data processing agreement template (store → WearOn → OpenAI)
- Age gate or block under-13 users (COPPA compliance)
- 6-hour auto-delete prominently displayed to shoppers before camera opens
- Size recommendation disclaimer: "Suggestion, not a guarantee" (liability protection)

### API Security

- Domain-restricted API keys (only work from registered store domain, prevents key theft)
- CORS whitelisting per store domain
- OAuth 2.0 with scopes planned for post-MVP (granular permissions for enterprise stores)

### Widget Safety

- Shadow DOM or iframe sandboxing (prevent CSS conflicts with store themes)
- Accessibility: screen reader support, keyboard navigation, proper contrast ratios
- "Powered by WearOn" badge for brand trust building

### Risk Mitigation

- Size rec confidence scores: if <80% confident, show range ("Between M and L") instead of definitive answer
- Moderation block rate monitoring per store (alert if spikes)
- Quality gate: auto-refund credits on bad generation quality

### Trust & UX

- Privacy-first screen before camera opens (photo deletion policy)
- Zero-friction free mode: no account required, no email asked
- Resell mode: widget styled to feel like store's checkout, not WearOn's

## Innovation & Novel Patterns

### Detected Innovation Areas

1. **First-of-kind combination:** Visual try-on + Size recommendation + Plug-and-play setup. No competitor combines all three.
2. **Dual free/paid product:** Size rec (free, instant, zero cost) hooks retention; try-on (paid, $0.08) generates revenue. Free feature prevents uninstalls.
3. **Single-photo body estimation:** MoveNet/MediaPipe from one selfie + height input. No body scanner, no two-photo requirement.
4. **Accessories virtual try-on:** Hats, watches, necklaces - unique differentiator no competitor offers.

### Market Context & Competitive Landscape

| Innovation | Who's Tried | Why WearOn Is Different |
|---|---|---|
| Visual try-on plugin | Vue.ai ($500+/mo, enterprise) | Self-serve, $49 starter |
| Size recommendation | Sizebay (manual onboarding, contact sales) | Plug-and-play, no human touch |
| Combined size + try-on | Nobody | WearOn is first |
| Phone-based body estimation | 3DLOOK (2 photos required) | 1 photo + height only |
| Accessories try-on | Nobody in plugin space | Unique differentiator |

### Validation Approach

- Beta test with 5 friendly stores
- Track: does free size rec prevent uninstalls? (retention hypothesis)
- Track: do stores with try-on see higher conversion vs size-rec-only?
- A/B test: combined widget vs size-rec-only vs try-on-only

### Innovation Risk Mitigation

| Risk | Fallback |
|---|---|
| MoveNet accuracy too low | Fall back to manual form input |
| Try-on quality inconsistent | Lean on size rec as primary value |
| Stores don't see value in combination | Offer size-rec-only mode (free) to prove value |
| OpenAI changes pricing/API | In-house model on 12-month roadmap |

## E-commerce Plugin + API Specific Requirements

### Project-Type Overview

WearOn B2B is delivered exclusively through **platform plugins** (Shopify, WordPress/WooCommerce). No standalone JS widget or public SDK. The REST API is internal, consumed by WearOn-built plugins only.

### Multi-Tenancy Model

- **Isolation:** Path-based separation within shared Supabase storage bucket
- **Pattern:** `/stores/{store_id}/uploads/`, `/stores/{store_id}/generated/`
- **Data access:** Each store can only access its own path via API key scoping
- **Database:** Store-scoped queries on all tables (generations, credits, analytics)

### API Architecture

- **Versioning:** URL-based (`/api/v1/size-recommend`, `/api/v1/generation/create`)
- **Auth:** API key per store (domain-restricted)
- **Consumers:** WearOn Shopify plugin + WearOn WordPress plugin (internal only)
- **Rate limits:** Per store, based on subscription tier
- **Data format:** JSON request/response

### Plugin Distribution

| Platform | Priority | Status |
|---|---|---|
| Shopify | MVP | First plugin |
| WordPress/WooCommerce | Post-MVP | Second plugin |
| BigCommerce | Vision | Future |
| Custom JS SDK | Out of scope | No plans |

### Subscription Tiers

| Plan | Monthly | Credits | Per-Credit | Overage |
|---|---|---|---|---|
| Starter | $49 | 350 | $0.14 | $0.16 |
| Growth | $99 | 800 | $0.12 | $0.14 |
| Scale | $199 | 1,800 | $0.11 | $0.13 |
| Enterprise | Custom | 5,000+ | $0.10 | $0.12 |

Plus pay-as-you-go at $0.18/credit.

### Error Codes (Standardized)

| Code | Meaning |
|---|---|
| `INSUFFICIENT_CREDITS` | Store balance too low |
| `RATE_LIMIT_EXCEEDED` | Too many requests for tier |
| `MODERATION_BLOCKED` | OpenAI safety filter triggered |
| `GENERATION_FAILED` | Processing error (credit auto-refunded) |
| `INVALID_API_KEY` | Bad or expired key |
| `DOMAIN_MISMATCH` | API key used from wrong domain |

### Journey 5 Update

API Developer journey (custom integration via raw REST API) moved to **Vision/Future** scope. B2B is plugins-only for MVP and Growth phases.

## Project Scoping & Phased Development

### MVP Strategy

**Approach:** Complete product MVP with full billing model
**Resource:** Solo developer (Abaid)
**Billing:** Subscription tiers + PAYG + resell mode all in MVP

### Resell Mode (Simplified)

No external payment gateway needed for resell mode. Store already has payment processing via Shopify. Flow:
1. Store configures resell mode + retail price in WearOn dashboard
2. Plugin creates "Try-On Credit" as digital product in store's Shopify catalog
3. Shopper purchases through store's normal Shopify checkout
4. Shopify order webhook → plugin confirms payment → calls WearOn API
5. 1 credit deducted from store's pool → generation runs
6. Store keeps 100% of shopper payment. WearOn already paid via wholesale credits.

### Phase 1: MVP

**Journeys:** Store Owner (1), Shopper on Store (2), Platform Admin (4 - basic)

| Feature | Effort |
|---|---|
| Shopify plugin (OAuth install + widget) | High |
| Virtual try-on via widget | Medium (reuse B2C) |
| Size rec via widget (MoveNet) | Low |
| B2B REST API (internal, versioned) | Medium |
| Merchant dashboard (credits, usage, billing config) | Medium |
| Subscription tiers (Starter/Growth/Scale) | Medium |
| Pay-as-you-go credit packs | Low |
| Absorb mode (store pays, shopper free) | Low |
| Resell mode (Shopify checkout + webhook) | Medium |
| Privacy screen + 6hr auto-delete | Low (exists) |
| Domain-restricted API keys | Medium |
| Widget sandboxing (iframe) | Medium |
| Basic platform admin view | Low (extend existing) |
| Uninstall cleanup hook | Low |

### Phase 2: Growth

| Feature |
|---|
| WordPress/WooCommerce plugin |
| Enterprise tier + custom pricing |
| Advanced merchant analytics (ROI, A/B, conversion) |
| Store-branded widget customization |
| Auto-recharge credits |
| Churn detection + automated emails |
| Body profile save (returning shopper skips form) |

### Phase 3: Expansion

| Feature |
|---|
| In-house AI try-on model (replace OpenAI) |
| BigCommerce plugin |
| Accessories specialization |
| OAuth 2.0 with scopes |
| Multi-language widget |

### Risk Mitigation

| Risk | Mitigation |
|---|---|
| Shopify app review rejection | Follow checklist, submit early |
| Widget breaks store theme | Iframe sandboxing, test 10+ themes |
| Stores don't install | Get 5 beta stores before listing |
| Shoppers don't click Try On | Default above-fold placement |
| Solo dev burnout | Reuse B2C generation pipeline, lean dashboard |

## Functional Requirements

### Store Onboarding & Lifecycle

- FR1: Store owner can install WearOn via Shopify App Store with OAuth authorization
- FR2: Store owner can complete merchant onboarding in 3 steps or fewer
- FR3: Store owner can configure billing mode (absorb cost or resell credits to shoppers)
- FR4: Store owner can set retail credit price when resell mode is enabled
- FR5: Store owner can access and manage their merchant dashboard
- FR6: System can remove all store data when plugin is uninstalled

### Credit & Billing Management

- FR7: Store owner can subscribe to a credit plan (Starter, Growth, Scale, or Enterprise)
- FR8: Store owner can purchase pay-as-you-go credit packs without a subscription
- FR9: Store owner can upgrade or downgrade their subscription tier
- FR10: System can deduct credits automatically per generation request
- FR11: System can refund credits automatically when a generation fails or is blocked
- FR12: System can create a "Try-On Credit" digital product in the store's Shopify catalog when resell mode is enabled
- FR13: System can process Shopify order webhooks to confirm shopper credit purchases in resell mode
- FR14: B2C user can purchase credit packs within the mobile app
- FR15: B2C user can receive free starter credits on signup
- FR16: System can charge overage rates when a store exceeds subscription credit allocation

### Virtual Try-On Generation

- FR17: Shopper can request a virtual try-on through the store widget
- FR18: B2C user can request a virtual try-on through the mobile app
- FR19: B2C user can upload an outfit image from any source for try-on
- FR20: System can queue generation jobs with per-store rate limiting
- FR21: System can process generation jobs via background worker
- FR22: System can notify users of generation completion in real-time
- FR23: System can detect moderation blocks and display user-friendly messaging
- FR24: System can auto-delete all uploaded and generated images after 6 hours

### Size Recommendation

- FR25: Shopper can receive a size recommendation from a single photo and height input
- FR26: System can estimate body measurements from a single photo using pose detection
- FR27: System can display a confidence range when size confidence is below threshold
- FR28: B2C user can save a body profile for reuse across future try-ons
- FR29: System can provide size recommendations without queuing (real-time response)
- FR30: System can display a size recommendation disclaimer

### Embeddable Widget

- FR31: Widget can load automatically on store product pages after plugin installation
- FR32: Widget can operate in sandboxed mode without conflicting with store CSS or theme
- FR33: Widget can guide the user through camera capture with pose overlay
- FR34: Widget can display privacy disclosure before accessing the camera
- FR35: Widget can operate in zero-friction mode (no account required) when store absorbs cost
- FR36: Widget can collect shopper account creation when store uses resell mode
- FR37: Widget can display "Powered by WearOn" badge
- FR38: Widget can support screen readers, keyboard navigation, and proper contrast ratios

### Analytics & Insights

- FR39: Store owner can view store-level analytics (generation count, credit usage, conversion tracking)
- FR40: B2C user can view personal generation history and statistics
- FR41: Platform admin can view aggregated B2B analytics with store-by-store breakdown
- FR42: Platform admin can view aggregated B2C analytics (user growth, credit purchases, generation stats)
- FR43: Platform admin can view revenue dashboard (B2B wholesale + B2C credit packs, costs, margin)
- FR44: Platform admin can view quality metrics (success rate, moderation blocks, refunds)
- FR45: System can flag stores with sudden usage drops as churn risk

### Account & Access Management

- FR46: Store owner can authenticate via Shopify OAuth
- FR47: System can issue domain-restricted API keys per store
- FR48: System can enforce CORS whitelisting per store domain
- FR49: B2C user can sign up and authenticate via email or Google OAuth
- FR50: Platform admin can manage stores, users, and roles via admin panel
- FR51: System can enforce rate limits per store based on subscription tier

### Privacy & Compliance

- FR52: System can provide GDPR/CCPA privacy policy template for stores to embed
- FR53: System can block users under 13 from using try-on features (COPPA compliance)

## Non-Functional Requirements

### Performance

| Metric | Target | Rationale |
|---|---|---|
| Widget initial load | <2s on 3G mobile | Shoppers abandon slow widgets; store owner blame |
| Size rec response | <1s (real-time) | FR29 requires no queuing; competitive differentiator |
| Try-on generation | <10s end-to-end | Includes queue + processing + notification |
| B2B API response (non-generation) | <500ms | Dashboard and credit endpoints must feel instant |
| Merchant dashboard page load | <3s | Store owners expect fast analytics |

### Security

- All data encrypted at rest and in transit (TLS 1.2+)
- API keys are domain-restricted and rotatable by store owner
- Store data isolation enforced at query level (no cross-tenant data access)
- User photos encrypted in transit, never stored beyond 6-hour auto-delete window
- OWASP Top 10 compliance across all endpoints
- Webhook payloads validated with HMAC signature verification (Shopify webhooks)
- Rate limiting enforced per API key based on subscription tier

### Scalability

| Scenario | Target |
|---|---|
| Concurrent active stores | 200 (Growth phase) |
| Concurrent generation requests | 100 across all stores |
| Queue buffer capacity | 10x normal load during spikes |
| Worker scaling | Horizontal scaling via additional worker instances |
| Storage | Path-based isolation supports unlimited stores without migration |

### Accessibility

- WCAG 2.1 Level AA compliance for the embeddable widget
- Screen reader support for all widget interactions
- Full keyboard navigation (no mouse-only actions)
- Minimum 4.5:1 contrast ratio for all text elements
- Touch targets minimum 44x44px on mobile
- Pose guidance overlay must have audio alternative for visually impaired users

### Integration

| System | Reliability Requirement |
|---|---|
| Shopify API | Version pinned with deprecation monitoring; graceful handling of API changes |
| OpenAI GPT Image 1.5 | Retry on 429 (rate limit) only; immediate fail + refund on all other errors |
| Shopify Webhooks | Delivery confirmation with idempotent processing; handle duplicate deliveries |
| Supabase Realtime | Primary notification channel; auto-fallback to polling after 10s timeout |
| Redis/BullMQ | Persistent queue; jobs survive worker restart without loss |

### Reliability

- 99.5% API uptime (excluding planned maintenance windows)
- Widget failure must never break the host store page (sandboxed isolation)
- Automatic credit refund on any generation failure within 30 seconds
- Graceful degradation: if generation service is down, size recommendation still functions independently
- Zero data loss on worker restart (pending jobs cleaned and refunded on startup)
- Uninstall hook completes full data cleanup within 60 seconds
