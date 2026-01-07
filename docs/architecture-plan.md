# Virtual Try-On Platform Architecture Plan

## Product Overview

**Platform**: Expo mobile app + Next.js backend for AI-powered virtual try-on
**AI Model**: Grok Image Generation v2 API (x.ai)
- Pricing: $0.07 per image
- Rate Limit: 5 requests/second (300 requests/minute)
- Input: Single image URL + text prompt
- Output: 1 high-resolution image (we only generate 1 per request)
- Format: **URLs only** (no base64 encoding)

**Core Challenge**: Users send multiple images (model photo, outfit, accessories) but Grok accepts only one image. Solution: Server-side image stitching into collage format.

**Why Queue System**: With 200+ concurrent users and Grok's 300 req/min rate limit, we need BullMQ to manage request throttling, prevent API errors, and ensure fair processing order.

## User-Selected Architecture Decisions

1. **Upload Mode**: Upload + Library (users can upload outfits AND select from curated library)
2. **Queue Strategy**: BullMQ + Redis (handles 300 req/min rate limit, fair job processing)
3. **Credit System**: Simple free credits (no payment integration in MVP)
4. **Image Processing**: Server-side using Sharp library
5. **Status Updates**: Supabase Realtime (primary) + polling fallback (10 sec timeout)
6. **Image Generation**: 1 image per request (not 10), URLs only (no base64)
7. **Mobile Development**: Expo Development Builds with native packages (expo-camera, expo-image-picker, expo-file-system)

## Research Findings

### Grok API (Source: x.ai docs)
- Endpoint: `POST https://api.x.ai/v1/images/generations`
- Authentication: Bearer token
- Rate Limit: 5 requests/second (300/minute) - **Queue system handles this**
- Pricing: $0.07 per image output
- Model: `grok-2-image`
- **We use**: URL input (upload images to Supabase, pass URLs to Grok)
- **We generate**: 1 image per request (set `n: 1` in API call)

### Image Processing (Source: Sharp.js)
- Library: `sharp` - High-performance Node.js image processing
- Features: Composite images, resize, optimize, maintain quality
- Production-ready: Used by major platforms
- Performance: Fastest image processing for Node.js

### Queue System (Source: BullMQ docs)
- BullMQ + Redis: Production-grade distributed job queue
- Built-in rate limiting (300 requests/minute for Grok API)
- Automatic retries with exponential backoff
- Job status tracking and monitoring
- Scales horizontally across multiple workers

### Storage Lifecycle (Source: Supabase discussions)
- Supabase Storage doesn't have native TTL/lifecycle policies
- Solution: Vercel Cron Jobs to delete files older than 6 hours
- Alternative: pg_cron scheduled function
- Implementation: Mark files with expiry metadata, cron job queries and deletes

## Architecture Overview

### Tech Stack Additions

**Backend (Next.js)**:
- **Image Processing**: `sharp` (collage creation, optimization)
- **Queue System**: `bullmq` + `ioredis` (job queue with rate limiting)
- **Redis**: Required for BullMQ (recommend Upstash for serverless)
- **Cron Jobs**: Vercel Cron for scheduled file cleanup
- **HTTP Client**: `axios` (already installed, for Grok API calls)

**Mobile (Expo)**:
- **Camera**: `expo-camera` (native camera access)
- **Image Picker**: `expo-image-picker` (gallery/camera selection)
- **File System**: `expo-file-system` (local image storage)
- **Image Manipulator**: `expo-image-manipulator` (resize before upload)
- **Media Library**: `expo-media-library` (save generated images)
- **Realtime**: Supabase Realtime subscriptions (status updates via WebSocket)
- **Auth**: `@supabase/supabase-js` with Expo-compatible storage (already configured)

### Database Schema (Supabase Postgres)

```sql
-- Users table (extends Supabase auth.users)
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  email TEXT NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  gender TEXT CHECK (gender IN ('male', 'female', 'other')),
  age INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Credits table
CREATE TABLE user_credits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  balance INTEGER NOT NULL DEFAULT 10, -- Free credits on signup
  total_earned INTEGER DEFAULT 10,
  total_spent INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Credit transactions log
CREATE TABLE credit_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL, -- Negative for spending, positive for earning
  type TEXT NOT NULL CHECK (type IN ('signup_bonus', 'generation', 'refund')),
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Generation sessions (history)
CREATE TABLE generation_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed')),

  -- Input images (URLs expire in 6 hours)
  model_image_url TEXT NOT NULL,
  outfit_image_url TEXT,
  accessories JSONB, -- Array of {type: 'hat', url: '...'}

  -- Processing
  stitched_image_url TEXT, -- Collage created by Sharp
  prompt_system TEXT NOT NULL,
  prompt_user TEXT,

  -- Results (URLs expire in 6 hours)
  generated_image_url TEXT, -- Single generated image URL
  credits_used INTEGER DEFAULT 1,

  -- Metadata
  error_message TEXT,
  processing_time_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Analytics
CREATE TABLE analytics_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_type TEXT NOT NULL, -- 'generation_started', 'generation_completed', etc.
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_generation_sessions_user_id ON generation_sessions(user_id);
CREATE INDEX idx_generation_sessions_created_at ON generation_sessions(created_at DESC);
CREATE INDEX idx_credit_transactions_user_id ON credit_transactions(user_id);
CREATE INDEX idx_analytics_events_type_created ON analytics_events(event_type, created_at);
```

### Supabase Storage Buckets

```
virtual-tryon-images/
├── user-uploads/          # User-uploaded photos (model, outfits)
│   └── {user_id}/
│       └── {timestamp}_{filename}
├── stitched/              # Server-generated collages
│   └── {session_id}.jpg
└── generated/             # AI-generated results
    └── {session_id}.jpg   # Single generated image per session
```

**Storage Policy**: All files tagged with `expires_at` timestamp, cron job deletes files older than 6 hours.

## System Architecture

### Request Flow

```
1. User (Mobile App) → Uploads images → Supabase Storage (URLs returned)
2. Mobile App → tRPC mutation `generation.create()` → Next.js API
3. Next.js API → Validates credits → Deducts 1 credit
4. Next.js API → Creates generation_session record (status: pending)
5. Next.js API → Adds job to BullMQ queue → Returns session_id
6. Mobile App → Subscribes to Supabase Realtime on generation_session row
7. Mobile App → Fallback polling every 2 seconds (10 sec timeout if no updates)

Background Processing:
8. BullMQ Worker → Picks job from queue (respects 300 req/min rate limit)
9. Worker → Downloads images from Supabase Storage URLs
10. Worker → Sharp: Stitch images into single collage (2048x2048, high quality)
11. Worker → Uploads collage to Supabase Storage → Gets public URL
12. Worker → Updates generation_session (status: processing, stitched_image_url)
13. Worker → Calls Grok API with collage URL + prompts (n: 1)
14. Worker → Receives 1 generated image URL from Grok
15. Worker → Stores image URL in generation_session
16. Worker → Updates generation_session (status: completed, generated_image_url)
17. Supabase Realtime → Pushes update to Mobile App (WebSocket)
18. Mobile App → Displays result immediately

Cleanup:
19. Vercel Cron (runs every 6 hours) → Deletes expired files from Supabase Storage
```

### API Endpoints (tRPC)

**New Routers**:

1. **`credits.ts`** (Protected)
   - `getBalance`: Get user credit balance
   - `getTransactions`: Get credit history (paginated)

2. **`generation.ts`** (Protected)
   - `create`: Start new generation (deducts credit, queues job, returns session_id)
   - `subscribe`: Enable Supabase Realtime subscription to session updates (handled client-side)
   - `getHistory`: List user's generation history (paginated)
   - `getById`: Get specific generation details (with fallback polling)

3. **`clothing.ts`** (Protected)
   - `listLibrary`: Get curated clothing library
   - `uploadOutfit`: Upload custom outfit image

4. **`analytics.ts`** (Protected - Admin only in future)
   - `getTotalGenerations`: Count of all generations
   - `getDailyStats`: Daily generation stats

**Existing Routers to Extend**:
- `user.ts`: Add fields for gender, age, profile updates
- `storage.ts`: Add TTL metadata to uploads

## File Structure

```
packages/
├── api/
│   ├── src/
│   │   ├── routers/
│   │   │   ├── credits.ts          [NEW]
│   │   │   ├── generation.ts       [NEW]
│   │   │   ├── clothing.ts         [NEW]
│   │   │   ├── analytics.ts        [NEW]
│   │   │   ├── user.ts             [MODIFY]
│   │   │   └── _app.ts             [MODIFY]
│   │   ├── services/
│   │   │   ├── queue.ts            [NEW] - BullMQ setup
│   │   │   ├── grok.ts             [NEW] - Grok API client
│   │   │   ├── image-processor.ts  [NEW] - Sharp collage creation
│   │   │   └── storage-cleanup.ts  [NEW] - File expiry logic
│   │   └── workers/
│   │       └── generation.worker.ts [NEW] - BullMQ job processor
│   └── package.json                [MODIFY] - Add sharp, bullmq, ioredis
│
├── app/
│   ├── features/
│   │   ├── try-on/
│   │   │   ├── screen.tsx          [NEW] - Main try-on screen
│   │   │   ├── camera-capture.tsx  [NEW] - Photo capture
│   │   │   ├── image-selector.tsx  [NEW] - Multi-image selection
│   │   │   ├── result-gallery.tsx  [NEW] - Generated results
│   │   │   └── hooks/
│   │   │       └── useTryOn.ts     [NEW] - Generation logic
│   │   ├── history/
│   │   │   ├── screen.tsx          [NEW] - Generation history
│   │   │   └── history-item.tsx    [NEW] - History list item
│   │   ├── profile/
│   │   │   ├── screen.tsx          [NEW] - User profile
│   │   │   └── credit-display.tsx  [NEW] - Credit balance widget
│   │   └── clothing/
│   │       ├── library-screen.tsx  [NEW] - Browse clothing library
│   │       └── upload-screen.tsx   [NEW] - Upload custom outfit
│   └── utils/
│       └── constants.ts            [NEW] - System/user prompts
│
└── apps/
    ├── next/
    │   ├── app/api/
    │   │   └── cron/
    │   │       └── cleanup/
    │   │           └── route.ts    [NEW] - Vercel Cron handler
    │   └── .env.local              [MODIFY] - Add Grok API key, Redis URL
    └── expo/
        └── .env                    [MODIFY] - Same as above
```

## Implementation Phases

### Phase 1: Database & Auth Setup
- [ ] Create Supabase tables (users, credits, sessions, analytics)
- [ ] Set up RLS policies
- [ ] Extend user router with profile fields
- [ ] Create credits router (balance, transactions)
- [ ] Add signup bonus (10 free credits)

### Phase 2: Storage & Image Processing
- [ ] Install `sharp` library
- [ ] Create Supabase storage buckets
- [ ] Implement image-processor service (collage stitching)
- [ ] Add TTL metadata to storage uploads
- [ ] Create storage cleanup service

### Phase 3: Queue System & Grok Integration
- [ ] Install BullMQ + ioredis
- [ ] Set up Redis (Upstash recommended)
- [ ] Create queue service with rate limiting (300 req/min)
- [ ] Implement Grok API client with axios
- [ ] Create generation worker (BullMQ processor)

### Phase 4: Generation API
- [ ] Create generation router (create, getStatus, getHistory)
- [ ] Implement credit deduction logic
- [ ] Add job queueing on generation request
- [ ] Implement status polling endpoint
- [ ] Add error handling & retry logic

### Phase 5: Mobile Features (Expo Native)
- [ ] Install Expo native packages (camera, image-picker, file-system, image-manipulator, media-library)
- [ ] Configure expo-camera permissions (iOS/Android)
- [ ] Create try-on screen with native camera integration
- [ ] Implement multi-image selection with expo-image-picker
- [ ] Add image preview and cropping with expo-image-manipulator
- [ ] Create upload flow with progress indicator
- [ ] Implement result gallery with save-to-device (expo-media-library)
- [ ] Add generation history screen
- [ ] Create profile screen with credit display
- [ ] Build development build: `eas build --profile development`

### Phase 6: Clothing Library
- [ ] Create clothing router
- [ ] Seed initial clothing library
- [ ] Implement library browse screen
- [ ] Add custom outfit upload

### Phase 7: Cleanup & Monitoring
- [ ] Create Vercel Cron route for file cleanup
- [ ] Configure cron schedule (every 6 hours)
- [ ] Implement analytics router
- [ ] Add generation metrics tracking

### Phase 8: Testing & Optimization
- [ ] Load testing (200+ concurrent users)
- [ ] Queue performance testing
- [ ] Image quality verification
- [ ] Error handling edge cases

## Critical Implementation Details

### Rate Limiting (BullMQ)
```typescript
// services/queue.ts
const generationQueue = new Queue('image-generation', {
  connection: redis,
  limiter: {
    max: 300,        // 300 requests
    duration: 60000  // per minute
  }
})
```

### Image Stitching (Sharp)
```typescript
// services/image-processor.ts
async function createCollage(images: Buffer[]): Promise<Buffer> {
  const composites = images.map((img, idx) => ({
    input: img,
    top: calculatePosition(idx),
    left: calculatePosition(idx)
  }))

  return sharp({
    create: {
      width: 2048,
      height: 2048,
      channels: 3,
      background: { r: 255, g: 255, b: 255 }
    }
  })
  .composite(composites)
  .jpeg({ quality: 95 }) // High quality
  .toBuffer()
}
```

### Grok API Call (URLs Only, 1 Image)
```typescript
// services/grok.ts
import axios from 'axios'

async function generateImage(imageUrl: string, systemPrompt: string, userPrompt?: string) {
  const response = await axios.post(
    'https://api.x.ai/v1/images/generations',
    {
      model: 'grok-2-image',
      image: imageUrl,            // Supabase Storage URL (not base64)
      prompt: `${systemPrompt}\n${userPrompt || ''}`,
      n: 1                        // Generate only 1 image
    },
    {
      headers: {
        'Authorization': `Bearer ${process.env.GROK_API_KEY}`,
        'Content-Type': 'application/json'
      }
    }
  )

  // Response contains single image URL
  return response.data.data[0].url // Return the generated image URL
}
```

### Supabase Realtime Subscription (Mobile)
```typescript
// packages/app/features/try-on/hooks/useTryOn.ts
import { useEffect, useState } from 'react'
import { useSupabase } from 'app/provider/SupabaseProvider'
import type { RealtimeChannel } from '@supabase/supabase-js'

function useTryOnStatus(sessionId: string) {
  const { supabase } = useSupabase()
  const [status, setStatus] = useState<'pending' | 'processing' | 'completed' | 'failed'>('pending')
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null)

  useEffect(() => {
    let channel: RealtimeChannel
    let pollTimeout: NodeJS.Timeout
    let pollCount = 0
    const maxPolls = 5 // 10 seconds (2 sec intervals)

    // Subscribe to Realtime updates (primary method)
    channel = supabase
      .channel(`generation:${sessionId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'generation_sessions',
        filter: `id=eq.${sessionId}`
      }, (payload) => {
        setStatus(payload.new.status)
        setGeneratedImageUrl(payload.new.generated_image_url)
        clearTimeout(pollTimeout) // Cancel polling if realtime works
      })
      .subscribe()

    // Fallback polling (if no realtime update after 10 seconds)
    const poll = async () => {
      if (pollCount >= maxPolls) return // Timeout after 10 seconds

      const { data } = await supabase
        .from('generation_sessions')
        .select('status, generated_image_url')
        .eq('id', sessionId)
        .single()

      if (data) {
        setStatus(data.status)
        setGeneratedImageUrl(data.generated_image_url)

        if (data.status === 'completed' || data.status === 'failed') {
          clearTimeout(pollTimeout)
          return
        }
      }

      pollCount++
      pollTimeout = setTimeout(poll, 2000) // Poll every 2 seconds
    }

    // Start fallback polling after 2 seconds
    pollTimeout = setTimeout(poll, 2000)

    return () => {
      channel.unsubscribe()
      clearTimeout(pollTimeout)
    }
  }, [sessionId, supabase])

  return { status, generatedImageUrl }
}
```

### Storage Cleanup (Vercel Cron)
```typescript
// apps/next/app/api/cron/cleanup/route.ts
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000)

  // Delete expired files from all buckets
  await deleteExpiredFiles('user-uploads', sixHoursAgo)
  await deleteExpiredFiles('stitched', sixHoursAgo)
  await deleteExpiredFiles('generated', sixHoursAgo)

  return Response.json({ success: true })
}
```

### Standardized API Response
```typescript
// All tRPC procedures return consistent structure
type ApiResponse<T> = {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
  }
}
```

### Error Handling
```typescript
// Standard error codes
enum ErrorCode {
  INSUFFICIENT_CREDITS = 'INSUFFICIENT_CREDITS',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  GENERATION_FAILED = 'GENERATION_FAILED',
  INVALID_IMAGE = 'INVALID_IMAGE',
}
```

## Privacy Considerations

1. **No Long-term Storage**: Files deleted after 6 hours
2. **Local Device Storage**: Generated images saved to user's device
3. **Metadata Only**: Database stores URLs (which expire), not images
4. **User Consent**: Clear privacy policy about temporary storage
5. **RLS Policies**: Users can only access their own data

## Monitoring & Analytics

Track:
- Total generations per day/week/month
- Average processing time
- Queue depth and wait time
- Credit usage patterns
- Error rates (by type)
- API costs (Grok usage)

## Dependencies to Install

```bash
# Backend (packages/api)
cd packages/api
yarn add sharp bullmq ioredis
cd ../..

# Expo Native Packages (apps/expo)
cd apps/expo
yarn add expo-camera expo-image-picker expo-file-system expo-image-manipulator expo-media-library
cd ../..

# Root dev dependencies
yarn add -D @types/sharp

# After adding expo native packages, rebuild development build
eas build --profile development --platform ios
eas build --profile development --platform android
```

## Expo Configuration

**app.json / app.config.js** (apps/expo):
```json
{
  "expo": {
    "plugins": [
      [
        "expo-camera",
        {
          "cameraPermission": "Allow WearOn to access your camera to capture photos for virtual try-on."
        }
      ],
      [
        "expo-image-picker",
        {
          "photosPermission": "Allow WearOn to access your photos to select outfits and accessories."
        }
      ],
      [
        "expo-media-library",
        {
          "photosPermission": "Allow WearOn to save generated try-on images to your device.",
          "savePhotosPermission": "Allow WearOn to save generated try-on images to your photo library."
        }
      ]
    ]
  }
}
```

**Note**: After updating app.json, you MUST create a new development build with `eas build --profile development` for permissions to take effect.

## Environment Variables

```env
# Grok API
GROK_API_KEY=xai-...

# Redis (Upstash recommended)
REDIS_URL=rediss://...
REDIS_TOKEN=...

# Vercel Cron Security
CRON_SECRET=random_secret_here

# Existing (already configured)
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

## Next Steps

After user approval:
1. Set up Supabase database schema
2. Configure Redis instance (Upstash)
3. Install dependencies
4. Implement Phase 1 (Database & Auth)
5. Continue through phases sequentially

---

**Sources**:
- [Grok API Pricing](https://docs.x.ai/docs/models)
- [BullMQ Rate Limiting](https://docs.bullmq.io/guide/rate-limiting)
- [Sharp Image Processing](https://sharp.pixelplumbing.com/)
- [Supabase Storage Lifecycle](https://github.com/orgs/supabase/discussions/20171)
