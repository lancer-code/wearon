# WearOn B2B Brainstorming Session

---
stepsCompleted: [1, 2, 3, 4]
session_topic: "B2B Implementation for WearOn Virtual Try-On Platform"
session_goals: "Public API design, WordPress/Shopify plugins, bulk credit systems for businesses"
selected_approach: "AI-Recommended Techniques"
techniques_used: ["Role Playing", "Cross-Pollination", "Six Thinking Hats"]
ideas_generated: 62
session_active: false
workflow_completed: true
date: 2026-02-07
---

## Session Overview

**Topic:** B2B implementation for WearOn - extending virtual try-on beyond consumer mobile app to serve e-commerce businesses

**Goals:**
- Public API design for third-party integrations
- WordPress plugin architecture
- Shopify plugin architecture
- Bulk credit purchasing/billing for businesses

**Context:**
- Current B2C is implemented (auth, credits, generation, admin panel)
- RBAC system already in place
- tRPC API layer exists
- Unique differentiator: accessories support (hats, watches, necklaces)
- Current generation cost: $0.08 per image (OpenAI) + infrastructure

---

## Techniques Executed

### Phase 1: Role Playing
- **Store Owner (Priya):** Explored pricing psychology, technical fears, dashboard needs
- **End Shopper (Maya):** Full customer journey from curiosity to post-purchase

### Phase 2: Cross-Pollination
- Extracted patterns from Shopify App Store, Canva, Mailchimp, Intercom

### Phase 3: Six Thinking Hats
- **White Hat:** Facts, unit economics, market data
- **Black Hat:** Risks and mitigation strategies

---

## Complete Idea Inventory (62 Ideas)

### Theme 1: Pricing & Revenue Model

| ID | Idea | Description | Priority |
|----|------|-------------|----------|
| #70 | Dual Pricing Track | Pay-as-you-go ($0.18/credit) OR Subscription tiers | Core |
| #71 | Natural Upgrade Path | Usage-based prompts to move from PAYG → Subscription | Core |
| #72 | Annual Commitment Incentive | 2 months free on yearly plans | Core |
| #73 | Overage Protection | Auto-charge when subscription credits run out | Core |
| #68 | Margin-Protected Pricing | Never sell below $0.15 wholesale | Core |
| #69 | Cost Optimization Roadmap | Target $0.05 generation cost over time | Future |

**Subscription Tiers:**

| Plan | Monthly | Included Credits | Per-Credit | Overage |
|------|---------|------------------|------------|---------|
| Starter | $49 | 350 | $0.14 | $0.16 |
| Growth | $99 | 800 | $0.12 | $0.14 |
| Scale | $199 | 1,800 | $0.11 | $0.13 |
| Enterprise | Custom | 5,000+ | $0.10 | $0.12 |

---

### Theme 2: Store Dashboard & Credit Management

| ID | Idea | Description | Priority |
|----|------|-------------|----------|
| #20 | Wholesale Credit System | WearOn → Store → Customer pipeline | Core |
| #22 | Merchant Admin Panel | Balance, revenue, pricing controls, ROI metrics | Core |
| #25 | Store Collects Payment | Store owns Stripe, keeps full margin | Core |
| #27 | Auto-Recharge | Threshold-based automatic credit replenishment | Core |

**Dashboard Features:**
- Credit balance + usage tracking
- Revenue and profit reporting
- Pricing controls (set retail price, bundles)
- Performance metrics (conversions, returns prevented, ROI)
- Plan management (upgrade/downgrade)

---

### Theme 3: Shopper Freemium Funnel

| ID | Idea | Description | Priority |
|----|------|-------------|----------|
| #13 | Lead-First Freemium Funnel | Click try-on → Signup required → 1 free → Buy more | Core |
| #14 | Volume Discount Tiers | 5/$0.75, 15/$1.50, 50/$4.00 | Core |
| #15 | First-Purchase Discount | 50% off first credit pack | High |
| #16 | Credits with Purchase Reward | Buy dress → get 5 free try-ons | High |
| #17 | Urgency Trigger | "Credits expire in 24h" FOMO | Medium |
| #18 | Cart Abandonment Credit Offer | Recover carts with free try-ons | Medium |

**Funnel Flow:**
```
Click "Try On" → Signup (email/Google) → 1 FREE try-on → Upsell credit packs
```

---

### Theme 4: Shopper Experience

| ID | Idea | Description | Priority |
|----|------|-------------|----------|
| #45 | No App Required | Works in browser, instant | Core |
| #46 | Trust Signal Before Camera | Privacy message upfront | Core |
| #47 | Confidence-Boosting Guidance | Friendly pose tips | High |
| #49 | Side-by-Side Comparison | Try-on vs. product photo | Medium |
| #50 | Multiple Angles | Front, turn, sitting poses | Future |
| #51 | Social Proof | "1,247 people tried this, 89% added to cart" | Medium |
| #52 | Share With Friends | Get opinions before buying | Medium |
| #53 | Save to Wishlist | Personalized with try-on image | Medium |
| #54 | Post-Purchase Feedback | "Did it match preview?" | High |
| #55 | Loyalty Credit Reward | Feedback = free try-ons | Medium |

---

### Theme 5: Mobile & Privacy (Technical)

| ID | Idea | Description | Priority |
|----|------|-------------|----------|
| #40 | Mobile-First Widget | Thumb-nav, full-screen, swipe | Core |
| #41 | Native Camera Integration | Direct capture, pose overlay | Core |
| #42 | Auto-Delete 6 Hours | No long-term storage | Core (Done) |
| #43 | Privacy Policy Template | Copy-paste legal text for stores | High |
| #44 | GDPR/CCPA Compliance Badge | Trust signal for B2B buyers | High |

---

### Theme 6: Go-to-Market & Growth

| ID | Idea | Description | Priority |
|----|------|-------------|----------|
| #56 | App Store Presence | Native Shopify/WordPress listings | Core |
| #57 | Transparent Pricing on Listing | No "contact sales" | Core |
| #58 | Review Generation Engine | Prompt happy merchants at 30 days | High |
| #59 | "Wow" First Experience | First try-on free, instant, amazing | Core |
| #60 | Visual Upgrade Prompts | Show locked premium features | Medium |
| #61 | Growth-Aligned Pricing | Small pays little, big pays more | Core |
| #62 | Friendly Limit Warnings | Celebrate usage, positive upgrade prompts | High |
| #63 | Guided Activation Checklist | Step-by-step onboarding | High |
| #64 | Contextual Success Tips | "Stores with try-on see 23% more conversions" | Medium |

---

### Theme 7: Risk Mitigation

| ID | Idea | Description | Priority |
|----|------|-------------|----------|
| #74 | Price Protection Clause | 30-day notice if AI costs rise | High |
| #75 | Quality SLA with Refund | Bad generation = automatic credit refund | High |
| #76 | Multi-Provider Fallback | Backup AI for 99.9% uptime | Future |
| #78 | Multi-Platform Insurance | Shopify + WooCommerce + BigCommerce | High |
| #79 | Self-Serve First Culture | Videos, KB, chatbot before human support | High |
| #80 | Prepaid Only + Fraud Detection | No invoicing, flag suspicious patterns | Core |

---

### Theme 8: Validation & Research

| ID | Idea | Description | Priority |
|----|------|-------------|----------|
| #65 | Competitive Pricing Intelligence | Research Vue.ai, Tangiblee pricing | Immediate |
| #66 | Merchant Willingness-to-Pay Survey | 50 store owners | Immediate |
| #67 | Shopper Trust Benchmark | A/B test adoption rates by category | Immediate |

---

## Prioritization Summary

| Tier | Count | Description |
|------|-------|-------------|
| Tier 0 - Immediate | 3 | Research before building |
| Tier 1 - Core (MVP) | 20 | Must have for launch |
| Tier 2 - High | 15 | Launch soon after MVP |
| Tier 3 - Medium | 10 | Growth phase features |
| Tier 4 - Future | 3 | Roadmap items |

---

## Key Decisions Made

1. **Pricing Model:** Dual track - Pay-as-you-go ($0.18) + Subscription tiers
2. **Freemium Flow:** Signup required BEFORE free try-on (lead capture first)
3. **Payment Model:** Store collects from customers, keeps margin (wholesale model)
4. **Technical Focus:** Mobile-first, no app download required
5. **Validation First:** Research competitors and merchant interest before building

---

## Unit Economics

| Metric | Value |
|--------|-------|
| Generation cost (OpenAI) | $0.08 |
| Infrastructure cost | ~$0.01-0.02 |
| Total cost per try-on | ~$0.10 |
| Wholesale price floor | $0.15 |
| Your margin (PAYG) | 80% at $0.18 |
| Your margin (Subscription) | 10-40% depending on tier |

---

## Risk Analysis

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| OpenAI price increase | Medium | High | Price protection clause, cost optimization |
| Low shopper adoption | Medium | Critical | Lead-first funnel, quality focus |
| Platform builds native | Low | Critical | Multi-platform presence |
| Support overwhelm | High | Medium | Self-serve first culture |

---

## Immediate Action Plan (This Week)

### Action #1: Validate Before Building
- [ ] Research Vue.ai, Tangiblee, Sizebay pricing (Day 2)
- [ ] Post in 2 Shopify merchant communities (Day 3)
- [ ] Talk to 5 store owners about willingness to pay (Day 5)

**Output:** Validation summary with pricing benchmarks + merchant feedback

### Action #2: Lock Pricing Model
- [ ] Calculate true cost per generation (Day 1)
- [ ] Set wholesale floor price $0.15+ (Day 2)
- [ ] Draft 4 subscription tiers (Day 3)
- [ ] Confirm store-collects-payment model (Day 3)

**Output:** One-page B2B pricing sheet

### Action #3: Define MVP Scope
- [ ] List all potential features (Day 4)
- [ ] Mark each as IN / OUT / LATER (Day 4)
- [ ] Get trusted person to challenge scope (Day 5)
- [ ] Lock list - no additions (Day 5)

**Output:** MVP feature checklist (signed off)

---

## MVP Feature Scope (Draft)

| Feature | Status |
|---------|--------|
| Lead-first signup flow | IN |
| Merchant dashboard | IN |
| Mobile-first widget | IN |
| Auto-delete 6hr | DONE |
| Shopify plugin | IN |
| Credit bundles | IN |
| WooCommerce plugin | LATER |
| Multiple angles | OUT |
| Share with friends | LATER |

---

## Post-Session Validation Findings

### Reddit Merchant Feedback

**Source:** Posts in r/shopify, r/ecommerce, r/entrepreneur

**Key Findings:**
- 3 comments opposing the idea, 1 DM supportive
- **Critical insight:** Most returns are due to **misfit (wrong size)**, not styling
- Virtual try-on solves styling doubt (20-25% of returns) but NOT size issues (52-60% of returns)
- Merchants confirmed return rates are painful but want size solutions more than visual try-on

**Returns Breakdown (Industry Data):**

| Return Reason | % of Returns | What Solves It |
|---------------|-------------|----------------|
| Wrong size/fit | 52-60% | Size recommendation |
| Didn't look as expected | 20-25% | Virtual try-on |
| Color/fabric different | 10-15% | Better product photos |
| Changed mind | 5-10% | Nothing |

**Implication:** WearOn should combine virtual try-on + size recommendation to address 70-80% of returns.

---

## Competitive Analysis: Sizebay

### How Sizebay Works

Sizebay uses anthropometric algorithms to estimate up to 9 body measurements from 3 user inputs (height, weight, age). It cross-references these measurements against brand-specific size charts to recommend the right size.

**Tech Stack:**
- Anthropometric model estimates: chest, waist, hip, shoulder width, arm length, inseam, torso, bust/underbust, neck
- Brand-specific size chart database (manually mapped)
- 3D Feel avatar with skin tone customization
- Fit preference adjustment (regular/slim/loose)

**Business Model:**
- 1,000+ customers in 60+ countries
- Custom pricing (contact sales required)
- Platforms: Shopify, WooCommerce, Magento, VTEX, Nuvemshop
- Onboarding requires Sizebay team to map size charts per product

### Sizebay Weaknesses (WearOn Opportunities)

| Factor | Sizebay | WearOn |
|--------|---------|--------|
| **Pricing** | Hidden (contact sales) | Transparent (self-serve) |
| **Setup** | Manual - needs their team to map size charts | Plug and play - install and go |
| **New products** | Manual mapping per product | Automatic (AI reads any product image) |
| **Onboarding time** | Days to weeks | Minutes |
| **Scalability** | Limited by team size for onboarding | Unlimited (no human touch needed) |
| **Output** | "You're a Medium" (text) | "Here's you wearing it" (visual) |
| **Customer relationship** | Sizebay involved in setup | Store owns everything |
| **Works on any product** | No (needs measurement data entered) | Yes (AI handles it) |

### Competitor Landscape

| Tool | What It Does | Pricing | Key Weakness |
|------|-------------|---------|--------------|
| Sizebay | Size rec from height/weight/age | Custom (contact sales) | No visual try-on, manual onboarding |
| True Fit | Size rec from purchase history | Enterprise | Needs purchase data history |
| Virtusize | Compare garment to clothes you own | Enterprise ($$$) | Complex setup |
| 3DLOOK | Body scan from 2 photos | Custom | Requires 2 full-body photos |
| Fit Analytics (Snap) | ML-based size rec | Enterprise | Acquired, less accessible |
| Vue.ai | Enterprise virtual try-on | $500+/month | Enterprise only, expensive |

### WearOn's Unique Position

**Nobody in the market combines visual try-on + size recommendation + plug-and-play setup.**

```
SIZEBAY:   "You're a Medium"              (text, manual setup)
WEARON:    "You're a Medium AND            (visual + size, plug and play)
            here's how it looks on you"
```

**Three competitive advantages:**
1. **Plug and play** - no sales calls, no manual onboarding, no waiting
2. **Dual solution** - size recommendation + visual try-on (addresses 70-80% of returns)
3. **Accessories support** - hats, watches, necklaces (nobody else does this)

---

## Updated Strategic Positioning

**Old:** "See yourself in the outfit"

**New:** "Know your size. See your look. Buy with confidence."

| Feature | Solves | % of Returns |
|---------|--------|-------------|
| Size recommendation | Misfit | 52-60% |
| Virtual try-on | Styling doubt | 20-25% |
| **Combined** | **Both** | **70-80%** |

---

## Session Insights

**Creative Breakthroughs:**
- Lead-first funnel captures email before spending credit (no wasted generations)
- Dual pricing track serves both testing stores and committed stores
- Store-owns-payment model turns try-on from cost center to profit center

**Key Realization:**
- At $0.08 generation cost, you CANNOT sell wholesale at $0.08 - margins require $0.15+ floor

**Post-Validation Pivot:**
- Virtual try-on alone solves only 20-25% of returns (styling)
- Adding size recommendation addresses 52-60% more (misfit)
- Combined approach = strongest market position, no competitor does both
- Plug-and-play setup is a major differentiator vs. Sizebay's manual onboarding

**Strategic Positioning:**
- No-code plugin (no developer needed)
- Plug and play (vs. Sizebay's contact-sales-and-wait model)
- Privacy-first (6-hour auto-delete already built)
- Dual solution: size rec + visual try-on
- Accessories support as differentiator (hats, watches, necklaces)

---

## Next Steps After This Week

1. **Week 2:** Build Shopify plugin MVP based on locked scope
2. **Week 3:** Beta test with 3-5 friendly stores
3. **Week 4:** Iterate based on feedback, prepare app store listing
4. **Month 2:** Public launch on Shopify App Store

---

## Size Recommendation System (Decision: Hybrid - Pose Estimation + Auto-Fill Form)

### Approach: Photo Analysis + One-Time Review Form

Combines pose estimation body landmark detection with an auto-filled form that users review once and save permanently.

### Two-Phase Tech Strategy

| Phase | Model | Runtime | Where | Why |
|-------|-------|---------|-------|-----|
| **MVP** | MoveNet Lightning (TF.js) | Node.js | Existing BullMQ worker | Native Node.js, 17 keypoints, ~15ms/image, $0 cost |
| **Production** | MediaPipe BlazePose (Python) | Python | Google Cloud Function or FastAPI microservice | 33 keypoints, better waist accuracy, mid-torso landmarks |

**Why two phases:**
- MoveNet: Native `@tensorflow/tfjs-node`, no hacks, 17 keypoints, 90%+ accuracy for S/M/L/XL buckets
- MediaPipe Python: 33 keypoints (includes mid-torso for waist), better for exact cm measurements, but needs separate Python service
- Supabase Edge Functions run Deno (JS/TS only) - cannot run Python MediaPipe directly

**MVP packages:**
```
@tensorflow/tfjs-node       # TF runtime for Node.js
@tensorflow-models/pose-detection  # MoveNet model
```

**Architecture: Decoupled Independent Endpoints**

Size recommendation and virtual try-on are separate, independent services. Not coupled in the same flow.

```
ENDPOINT 1: Size Recommendation (Independent, FREE, instant)
  POST /api/size-recommend
  Input: { userImageUrl, heightCm, productSizeChart? }
  Output: { recommendedSize: "M", measurements: {...}, bodyType: "regular" }
  Cost: $0
  Speed: ~15ms (MVP) / ~60ms (Production)

ENDPOINT 2: Virtual Try-On (Independent, $0.08, queued)
  POST /api/generation/create
  Input: { userImageUrl, outfitImageUrl }
  Output: { sessionId, tryOnImageUrl }
  Cost: $0.08
  Speed: 3-5 sec (queued via BullMQ)
```

**Frontend can call them independently or together:**
```
Scenario A: Size rec only → FREE, instant
Scenario B: Try-on only  → 1 credit, 3-5 sec
Scenario C: Both         → 1 credit, parallel calls
                            Size appears instantly
                            Try-on image appears 3-5 sec later
```

**This enables a new B2B product tier:**

| Tier | Features | Price | Your Cost |
|------|----------|-------|-----------|
| Size Only | Size recommendation widget (no try-on) | $19/mo or free tier | $0 |
| Try-On + Size | Both features combined | $49+/mo | $0.08/try-on |

**Production (Python MediaPipe):**
```
POST /estimate-body to Python microservice (Google Cloud Function)
  → MediaPipe BlazePose processes image (~60ms)
  → Returns 33 landmarks + measurements
```

### MoveNet vs MediaPipe Accuracy for Sizing

| Factor | MoveNet (MVP) | BlazePose (Production) |
|--------|---------------|------------------------|
| Keypoints | 17 (joints only) | 33 (joints + mid-torso) |
| Shoulder width | Accurate | Accurate |
| Hip width | Accurate | Accurate |
| Waist | Interpolated (~80%) | Direct landmark (~90%) |
| S/M/L/XL accuracy | ~90%+ | ~95%+ |
| Speed (CPU) | ~15ms | ~60-100ms |
| Cost per request | $0 | ~$0.0001 (Cloud Function) |

**For S/M/L/XL buckets both give same result 90%+ of the time.** Difference only matters at exact size boundaries.

### User Flow

**First-time user:**
```
Upload photo (existing flow) → MediaPipe processes (<2 sec, free)
    → Auto-fills body profile form → User reviews/adjusts → Save to DB
    → Size recommendation + AI try-on generated
```

**Returning user:**
```
Upload photo → Body profile already saved (skip form)
    → Instant size recommendation + AI try-on
```

### Auto-Filled Review Form (First Time Only)

```
"We estimated your measurements from your photo. Quick review?"

Height:       [170 cm]  ← MUST confirm (only critical input)
Weight:       [65 kg]   ← auto-estimated, editable
Body type:    [Regular]  ← auto-detected (slim/regular/athletic/curvy), editable
Fit pref:     [Regular]  ← default (tight/regular/loose), editable

[✓ Save for future try-ons]
[Looks right →]     saves + size rec + try-on
[Skip, just try on →]  no size rec, just visual try-on
```

**Key design decisions:**
- Height is the only critical field (converts pixel ratios to real cm)
- "Skip" option preserves zero-friction for users who just want try-on
- Data saved once, never asked again
- User can update measurements anytime in profile

### What MediaPipe Estimates From Photo

| Measurement | How | Accuracy |
|-------------|-----|----------|
| Body type | Shoulder-to-hip ratio analysis | High |
| Shoulder width | Landmark distance + height scale | Good |
| Torso-to-leg ratio | Landmark positions | High |
| Approximate weight | Body proportions + height | Medium |
| Chest estimate | Shoulder width + body type | Good (with height) |
| Waist estimate | Torso narrowest point ratio | Good (with height) |
| Hip estimate | Hip landmark width + height | Good (with height) |

**Height is the key** - it converts all pixel-based ratios into real centimeters.

### Size Matching Logic

```
User measurements → Compare against size chart:

            S        M        L        XL
Chest:    84-88    88-92    92-96    96-100 cm
Waist:    68-72    72-76    76-80    80-84 cm
Hip:      90-94    94-98    98-102   102-106 cm

Best match = smallest size where ALL measurements fit
Between sizes → fit_preference adjusts:
  tight  → recommend smaller
  loose  → recommend larger
  regular → recommend larger (safe bet)
```

Stores can optionally upload custom size charts. Default = standard international sizing.

### Database Schema

```sql
CREATE TABLE user_body_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  height_cm NUMERIC,
  weight_kg NUMERIC,
  body_type TEXT CHECK (body_type IN ('slim', 'regular', 'athletic', 'curvy')),
  fit_preference TEXT CHECK (fit_preference IN ('tight', 'regular', 'loose')),
  gender TEXT CHECK (gender IN ('male', 'female', 'unisex')),
  est_chest_cm NUMERIC,
  est_waist_cm NUMERIC,
  est_hip_cm NUMERIC,
  est_shoulder_cm NUMERIC,
  source TEXT CHECK (source IN ('mediapipe_auto', 'user_manual', 'hybrid')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);
```

### Tech Stack (No OpenAI - Zero Cost)

**MVP:**

| Component | Technology | Cost |
|-----------|-----------|------|
| Body landmark detection | MoveNet Lightning (`@tensorflow/tfjs-node`) | Free |
| Measurement estimation | Custom algorithm (ratios + height) | Free |
| Size chart matching | Comparison logic | Free |
| Storage | Supabase (existing) | Existing |
| Processing | Existing BullMQ worker (adds ~15ms per job) | $0 |

**Production:**

| Component | Technology | Cost |
|-----------|-----------|------|
| Body landmark detection | MediaPipe BlazePose (Python `mediapipe` package) | Free |
| Hosting | Google Cloud Function or FastAPI on Hetzner ($4.50/mo) | ~$0.0001/req |
| Measurement estimation | Custom algorithm (33 landmarks + height) | Free |
| Size chart matching | Comparison logic | Free |
| Storage | Supabase (existing) | Existing |

**Additional cost per size recommendation: $0.00 (MVP) / ~$0.0001 (Production)**

### Combined Output to Customer

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  📏 Recommended size: M                    ← FREE       │
│     "Based on your body profile, Medium    │
│      is the best fit for this item"        │
│                                                         │
│  👗 [AI Try-On Image]                      ← $0.08      │
│     "Here's how it looks on you"           │
│                                                         │
│  ✅ 92% of similar body types chose M      ← bonus      │
│                                                         │
│  [Add to Cart - Size M]                                 │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Why This Beats All Competitors

| Feature | Sizebay | 3DLOOK | WearOn |
|---------|---------|--------|--------|
| Size recommendation | Yes | Yes | Yes |
| Visual try-on | No | No | Yes |
| Setup | Manual (weeks) | Manual | Plug and play (minutes) |
| User input needed | 3 fields always | 2 photos | 1 field once (height) |
| Cost to store | Contact sales | Contact sales | Transparent pricing |
| AI cost per use | N/A | N/A | $0.08 (try-on only, size rec free) |

---

## Next Steps After This Week

1. **Week 2:** Build Shopify plugin MVP based on locked scope
2. **Week 3:** Beta test with 3-5 friendly stores
3. **Week 4:** Iterate based on feedback, prepare app store listing
4. **Month 2:** Public launch on Shopify App Store

---

*Session completed: 2026-02-07*
*Updated with validation findings + sizing system decision + tech stack: 2026-02-08*
*Facilitated using BMAD Brainstorming Workflow*
*Techniques: Role Playing, Cross-Pollination, Six Thinking Hats*
