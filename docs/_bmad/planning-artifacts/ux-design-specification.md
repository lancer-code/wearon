---
stepsCompleted: [1, 2, 3, 'wireframe-complete']
inputDocuments:
  - docs/_bmad/planning-artifacts/prd.md
  - docs/project-context.md
workflowStatus: complete
projectName: wearon
userName: Abaid
date: 2026-02-13
targetFeature: Landing Page (/) - Marketing Homepage
completionNote: 'Fast-tracked to wireframe in yolo mode. Full UX spec ready for implementation.'
---

# UX Design Specification - WearOn Landing Page

**Author:** Abaid
**Date:** 2026-02-13
**Feature:** Marketing Landing Page (/)

---

## Executive Summary

### Project Vision

WearOn is a dual-channel AI-powered virtual try-on platform that reduces online clothing returns through visual try-on and accurate size recommendations. The platform serves both direct consumers (B2C mobile app) and e-commerce merchants (B2B Shopify plugin), combining three capabilities that competitors offer separately: visual try-on, AI-powered size recommendations, and plug-and-play store integration.

The landing page (/) must explain both offerings clearly while building trust around privacy and AI transparency.

### Target Users

**Primary Audiences (Homepage):**

1. **Shoppers (B2C)** - Mobile-first consumers who want to see themselves in outfits before purchasing from any online store. Tech-savvy, ages 18-35, value convenience and privacy. Main motivation: avoid fit-related disappointment.

2. **Store Owners (B2B)** - Shopify merchants frustrated by high return rates (20-30%) and lost revenue. Looking for quick-install solutions that show ROI. Main motivation: reduce returns, increase conversion.

**Secondary Audience:**
- Platform visitors researching the technology (press, investors, competitors)

### Key Design Challenges

1. **Dual-Audience Navigation** - Homepage must clearly split paths for consumers ("Try it Now") vs merchants ("For Your Store") without confusion or cognitive overload.

2. **Trust Barrier for Photo Upload** - Users hesitant to upload personal photos to unknown service. Privacy messaging (6-hour auto-delete, COPPA compliance, no permanent storage) must be prominent and reassuring.

3. **Complexity vs Clarity** - Value proposition spans three features (try-on + size rec + plugin). Risk overwhelming visitors. Need simplified messaging that highlights unique combination without feature-listing.

4. **Mobile-First Constraints** - B2C users primarily on mobile. Hero section, CTAs, and demo must work flawlessly on small screens with touch targets.

### Design Opportunities

1. **Show, Don't Tell** - Visual-first hero with before/after try-on examples. Actual photo transformations convey value instantly better than text explanations.

2. **Zero-Friction Demo** - Embedded interactive size recommendation widget (no signup required) lets visitors experience value immediately. Lowers barrier to conversion.

3. **Dual Social Proof** - Separate testimonials/metrics for merchants ("reduced returns by 30%") and consumers ("perfect fit on first order"). Builds credibility for both audiences.

4. **Privacy as Feature** - Frame 6-hour auto-delete as a competitive advantage, not just compliance. "Your photos disappear - our AI remembers nothing."

5. **Platform Transparency** - Explicitly state "Powered by OpenAI GPT Image" and "MediaPipe pose detection" to build AI trust for tech-aware audience.

## Core User Experience

### Defining Experience

The landing page experience centers on **effortless path discovery**—visitors must instantly understand WearOn's dual value proposition (consumer app + merchant plugin) and confidently choose their path within seconds.

**Primary Experience Goal**: Transform first-time visitors into converted users (app download or Shopify install) through clarity, trust, and visual proof.

**Core Interaction Flow**:
1. Hero section conveys value instantly (visual try-on example)
2. Dual CTA buttons present clear choice (consumers vs merchants)
3. Feature sections build confidence through social proof
4. Privacy messaging establishes trust passively
5. Final CTA reinforces chosen path

### Platform Strategy

**Primary Platform**: Web (Next.js 16 + Tamagui)
- Universal landing page serving all devices and platforms
- Mobile-first responsive design (B2C users primarily mobile)
- Progressive enhancement for desktop (merchant research often desktop)
- <2s initial load time requirement (per PRD NFR)

**Platform Considerations**:
- Touch-first interaction design (44px minimum touch targets)
- Gesture-friendly CTAs (large, thumb-zone positioned)
- No device-specific capabilities required (pure informational page)
- Cross-browser compatibility (Safari iOS, Chrome Android priority)

### Effortless Interactions

**Zero-Friction Clarity**:
- **3-Second Rule**: Hero section answers "What is this?" without scrolling
- **Visual Hierarchy**: Dual CTAs use color/size to guide path selection (no thinking required)
- **Scannable Content**: Short paragraphs, bullet lists, visual breaks for mobile readers

**Trust Without Barriers**:
- Privacy messaging visible in hero (not buried in footer)
- "Powered by OpenAI" badge builds AI credibility
- No email/signup required to learn about product

**Competitive Advantage**:
- Eliminate "contact sales" friction (self-serve for both audiences)
- No feature comparison tables (show value through visuals instead)
- Instant access to both paths (no account creation to explore)

### Critical Success Moments

**Moment 1: First Impression (0-3 seconds)**
- **Success**: Visitor immediately understands "AI try-on for clothes"
- **Failure Point**: Confused by dual audience or unclear value prop
- **Design Focus**: Hero visual must show before/after try-on transformation

**Moment 2: Path Selection (3-10 seconds)**
- **Success**: Visitor identifies their path (consumer or merchant) and clicks correct CTA
- **Failure Point**: Confused which CTA applies to them, analysis paralysis
- **Design Focus**: Clear labeling ("For Shoppers" vs "For Store Owners"), visual distinction

**Moment 3: Trust Establishment (10-30 seconds)**
- **Success**: Visitor feels confident WearOn is legitimate and privacy-respecting
- **Failure Point**: Skepticism about photo upload security or AI quality
- **Design Focus**: Privacy badge, 6-hour delete messaging, OpenAI/MediaPipe transparency

**Moment 4: Value Recognition (30-60 seconds)**
- **Success**: Visitor thinks "this solves my exact problem" and clicks final CTA
- **Failure Point**: Feature list doesn't resonate, no emotional connection
- **Design Focus**: Problem-solution framing, relatable user testimonials

### Experience Principles

1. **Clarity Over Completeness** - Explain one value prop well rather than listing every feature. Visitors need to "get it" in 3 seconds, not read a manual.

2. **Show, Don't Tell** - Visual proof (before/after try-on examples, merchant metrics) builds trust faster than feature descriptions. Every claim backed by visual evidence.

3. **Dual Paths, Zero Confusion** - Serve both audiences without mixing messages. Clear separation between consumer and merchant content prevents cognitive overload.

4. **Privacy as Advantage** - Frame 6-hour auto-delete as a feature, not compliance. "Your photos disappear" is a selling point for privacy-conscious users.

5. **Mobile-First, Desktop-Enhanced** - Design for thumb, enhance for cursor. B2C users are mobile-native; merchant research often happens on desktop.

6. **Trust Through Transparency** - Explicitly state AI providers (OpenAI, MediaPipe) and data practices. Tech-aware audience appreciates honesty over marketing speak.

## Landing Page Structure & Wireframe

### Page Sections (Top to Bottom)

#### 1. Hero Section (Above Fold)
**Layout**: Full-viewport height, centered content with background gradient

**Components**:
- **Logo** (top-left): "WearOn" wordmark + icon
- **Navigation** (top-right): Login | Sign Up (minimal, don't distract from CTAs)
- **Headline** (center): "See Yourself in Any Outfit, Instantly"
  - Subheadline: "AI-powered virtual try-on and size recommendations in seconds"
- **Visual Proof** (center): Before/After slider showing person → person wearing outfit
  - Mobile: Stacked vertical comparison
  - Desktop: Side-by-side with interactive slider
- **Dual CTAs** (center, below visual):
  - Primary: "Try the App" (larger, gradient button) → /signup
  - Secondary: "For Store Owners" (outlined button) → /merchant/onboarding
- **Trust Badge** (bottom): "🔒 Your photos delete in 6 hours • Powered by OpenAI"

**Design Notes**:
- Background: Subtle gradient (light → lighter, not distracting)
- Typography: Large headline (48px mobile, 72px desktop), bold weight
- Spacing: Generous padding (80px top/bottom on desktop)
- Mobile: Stack all elements vertically, maintain 44px touch targets

---

#### 2. Social Proof Strip
**Layout**: Horizontal scroll on mobile, grid on desktop

**Components**:
- **Metrics** (3 cards):
  - "500K+ Try-Ons Generated"
  - "95% Size Accuracy"
  - "30% Fewer Returns for Merchants"
- **Logos** (if available): "As seen in" or partner stores

**Design Notes**:
- Light background (contrast with hero)
- Compact height (120px)
- Icons + numbers + labels

---

#### 3. How It Works (For Shoppers)
**Layout**: 3-column grid (desktop), stacked (mobile)

**Headline**: "Three Steps to Your Perfect Fit"

**Steps**:
1. **Upload Photo**
   - Icon: Camera/Upload
   - Text: "Take a quick selfie or upload a photo"
2. **Get Recommendations**
   - Icon: Ruler/Measurements
   - Text: "Instant size recommendation from AI pose detection"
3. **See Yourself**
   - Icon: Sparkles/Magic
   - Text: "View yourself wearing the outfit in seconds"

**CTA**: "Start Trying On" → /signup

**Design Notes**:
- Visual hierarchy: Icon → Number badge → Heading → Description
- Icons: Large (64px), colorful, consistent style
- Numbers: Circular badges (1, 2, 3)

---

#### 4. For Merchants Section
**Layout**: Split layout - content left, visual right (reverse on mobile)

**Headline**: "Add Virtual Try-On to Your Shopify Store in 4 Minutes"

**Benefits** (bulleted list):
- ✓ Reduce returns by up to 30%
- ✓ Increase conversion with visual confidence
- ✓ No technical setup - auto-installs on product pages
- ✓ Choose absorb mode (free for shoppers) or resell mode (new revenue)

**Visual**: Screenshot of Shopify dashboard showing plugin or widget on product page

**CTA**: "Install on Shopify" → Shopify App Store link

**Design Notes**:
- Darker background section (visual separation)
- Checkmarks in brand color
- Screenshot has subtle shadow/border

---

#### 5. Privacy & Trust Section
**Layout**: Centered content, icon grid

**Headline**: "Your Privacy, Our Priority"

**Trust Points** (4-column grid):
1. **6-Hour Auto-Delete**
   - Icon: Clock/Timer
   - "Photos automatically deleted after processing"
2. **No Permanent Storage**
   - Icon: Shield/Lock
   - "We don't keep your images, period"
3. **COPPA Compliant**
   - Icon: Check/Badge
   - "Safe for ages 13+ with proper safeguards"
4. **AI Transparency**
   - Icon: Robot/Brain
   - "Powered by OpenAI GPT Image & MediaPipe"

**Design Notes**:
- Light background
- Icons: Outlined style, subtle color
- Short, scannable text

---

#### 6. Testimonials (Optional - if available)
**Layout**: Carousel (mobile), 3-card grid (desktop)

**Types**:
- **Shopper testimonial**: "Perfect fit on first order!"
- **Merchant testimonial**: "Returns down 28% in first month"
- **Tech testimonial**: "Best virtual try-on I've tried"

**Design Notes**:
- Card format with quote + avatar + name + role
- Star ratings if applicable

---

#### 7. Final CTA Section
**Layout**: Full-width, centered, gradient background

**Headline**: "Ready to See the Difference?"

**Dual CTAs** (repeat from hero):
- "Try the App" (primary)
- "For Store Owners" (secondary)

**Design Notes**:
- High contrast with page (dark gradient or brand color)
- Large buttons (60px height)
- Subtle animation on hover

---

#### 8. Footer
**Layout**: 4-column grid (desktop), stacked (mobile)

**Columns**:
1. **Product**
   - Consumer App
   - Shopify Plugin
   - Pricing
2. **Resources**
   - Documentation
   - Privacy Policy
   - Terms of Service
3. **Company**
   - About
   - Contact
   - Careers
4. **Social**
   - Twitter/X
   - Instagram
   - LinkedIn

**Design Notes**:
- Minimal, clean
- Dark background, light text
- Logo + copyright at bottom

---

### Mobile-Specific Considerations

**Touch Targets**: Minimum 44x44px for all interactive elements

**Scroll Behavior**:
- Smooth scroll to anchor links
- Sticky header (logo + CTAs) on scroll

**Performance**:
- Lazy load images below fold
- Optimize hero image (WebP, multiple sizes)
- Preload critical fonts

**Gestures**:
- Before/after slider swipeable on mobile
- Testimonial carousel swipeable

---

### Component Specifications (Tamagui)

#### Buttons
```typescript
// Primary CTA
<Button
  size="$6"
  backgroundColor="$blue10"
  color="$white"
  fontSize="$6"
  paddingHorizontal="$8"
  borderRadius="$4"
  pressStyle={{ backgroundColor: "$blue11" }}
>
  Try the App
</Button>

// Secondary CTA
<Button
  size="$6"
  variant="outlined"
  borderColor="$blue10"
  color="$blue10"
  fontSize="$6"
  paddingHorizontal="$8"
  borderRadius="$4"
>
  For Store Owners
</Button>
```

#### Typography Hierarchy
```typescript
// Headline
<H1 fontSize={72} fontWeight="800" lineHeight={1.1} textAlign="center">
  See Yourself in Any Outfit, Instantly
</H1>

// Subheadline
<Paragraph fontSize={24} color="$color10" textAlign="center" maxWidth={600}>
  AI-powered virtual try-on and size recommendations in seconds
</Paragraph>

// Section Heading
<H2 fontSize={48} fontWeight="700" marginBottom="$6">
  How It Works
</H2>

// Body Text
<Paragraph fontSize={18} lineHeight={1.6} color="$color11">
  Take a quick selfie or upload a photo
</Paragraph>
```

#### Spacing System
- Section padding: `$10` (mobile), `$16` (desktop)
- Card gaps: `$4` (mobile), `$6` (desktop)
- Element margins: `$2`, `$4`, `$6` scale

#### Color Palette
- **Primary**: `$blue10` (CTAs, links)
- **Success**: `$green10` (checkmarks, trust indicators)
- **Neutral**: `$color1` - `$color12` (text, backgrounds)
- **Gradients**: `linear-gradient(to bottom, $color1, $color2)` for hero

---

### Implementation Priority

**Phase 1 - MVP Landing Page**:
1. Hero Section (critical)
2. How It Works (critical)
3. For Merchants Section (critical)
4. Privacy Section (critical)
5. Footer (critical)

**Phase 2 - Enhancement**:
6. Social Proof Strip
7. Testimonials
8. Final CTA Section
9. Animations & interactions

---

### File Structure (Next.js + Tamagui)

```
packages/app/features/home/
├── landing-hero.tsx          # Hero section component
├── landing-how-it-works.tsx  # Steps component
├── landing-merchants.tsx     # Merchant section
├── landing-privacy.tsx       # Privacy/trust section
├── landing-footer.tsx        # Footer component
└── screen.tsx                # Main landing page (imports all sections)

apps/next/app/page.tsx         # Route → imports HomeScreen
```

### Next Steps for Implementation

1. **Create component files** in `packages/app/features/home/`
2. **Replace current `screen.tsx`** with new landing page structure
3. **Add hero images** (before/after examples - use stock photos initially)
4. **Implement responsive breakpoints** using Tamagui's `$sm`, `$md`, `$lg` props
5. **Add navigation** links (Login, Sign Up in header)
6. **Test mobile experience** thoroughly (primary use case)
7. **Optimize performance** (lazy loading, image optimization)
