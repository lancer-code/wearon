# WearOn Virtual Try-On Platform - Setup Guide

This guide walks you through setting up the complete WearOn platform from scratch.

## Prerequisites

✅ Node.js 22+ installed
✅ Yarn 4.5.0 (automatically configured)
✅ Supabase account and project
✅ Upstash Redis account (or local Redis)
✅ Grok API key from x.ai
✅ Vercel account (for deployment)

## Step 1: Install Dependencies

```bash
# From project root
yarn install

# This will install all dependencies for:
# - packages/api (backend services)
# - packages/app (shared app logic)
# - packages/ui (UI components)
# - apps/next (Next.js web app)
# - apps/expo (Expo mobile app)
```

## Step 2: Configure Environment Variables

### Next.js (.env.local)

Create `apps/next/.env.local`:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# tRPC API URL
NEXT_PUBLIC_API_URL=http://localhost:3000/api/trpc

# Grok API (from x.ai)
GROK_API_KEY=xai-your-api-key-here

# Redis (Upstash)
REDIS_URL=rediss://one-clam-28781.upstash.io
UPSTASH_REDIS_REST_URL=https://one-clam-28781.upstash.io
UPSTASH_REDIS_REST_TOKEN=AXBtAAIncDI4YTQyZDQ5ODg0NDQwMzNhZWEzMjQzMWEwZTQ5YmI5cDIyODc4MQ

# Vercel Cron Security
CRON_SECRET=generate-a-random-secret-here
```

### Expo (.env)

Create `apps/expo/.env`:

```env
# Supabase Configuration
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here

# tRPC API URL (use your local IP for mobile testing)
EXPO_PUBLIC_API_URL=http://YOUR_LOCAL_IP:3000/api/trpc
# Example: EXPO_PUBLIC_API_URL=http://192.168.1.100:3000/api/trpc
```

**Finding Your Local IP:**
- macOS/Linux: `ifconfig | grep "inet "`
- Windows: `ipconfig`

## Step 3: Set Up Supabase

### 3.1 Run Database Migrations

**Option A: Using Supabase Dashboard**

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Run migrations in order:
   - Copy contents of `supabase/migrations/001_initial_schema.sql`
   - Click **RUN**
   - Copy contents of `supabase/migrations/002_rls_policies.sql`
   - Click **RUN**

**Option B: Using Supabase CLI**

```bash
# Link to your Supabase project
supabase link --project-ref YOUR_PROJECT_REF

# Push migrations
cd supabase
supabase db push
```

### 3.2 Create Storage Bucket

1. Go to **Storage** in Supabase dashboard
2. Click **New bucket**
3. Configure:
   - **Bucket name**: `virtual-tryon-images`
   - **Public**: ❌ Unchecked (private bucket)
   - **File size limit**: 10 MB
   - **Allowed MIME types**: `image/jpeg`, `image/png`, `image/webp`

### 3.3 Add Storage Policies

In **Storage > Policies**, add these policies:

```sql
-- Users can upload to their own folder
CREATE POLICY "Users can upload to own folder"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'virtual-tryon-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can read their own files
CREATE POLICY "Users can read own files"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'virtual-tryon-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can delete their own files
CREATE POLICY "Users can delete own files"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'virtual-tryon-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Service role has full access
CREATE POLICY "Service role has full storage access"
  ON storage.objects
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');
```

### 3.4 Enable Realtime

1. Go to **Database > Replication**
2. Find `generation_sessions` table
3. Toggle **Realtime** to ON

## Step 4: Verify Database Setup

Test that everything is working:

```sql
-- Check tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE';

-- Expected: users, user_credits, credit_transactions, generation_sessions, analytics_events
```

## Step 5: Get Grok API Key

1. Go to [x.ai](https://x.ai/api)
2. Sign up for an API account
3. Generate an API key
4. Add to your `.env.local` file

## Step 6: Start Development Servers

### Terminal 1: Next.js Backend + Frontend

```bash
yarn web
```

This starts the Next.js development server on `http://localhost:3000`

### Terminal 2: Background Worker

The worker processes generation jobs from the queue.

```bash
cd packages/api
node -r ts-node/register src/workers/generation.worker.ts
```

Or create a npm script in `packages/api/package.json`:

```json
{
  "scripts": {
    "worker": "ts-node src/workers/generation.worker.ts"
  }
}
```

Then run:
```bash
cd packages/api
yarn worker
```

### Terminal 3: Expo Mobile App (Optional)

```bash
yarn native
```

Then scan the QR code with Expo Go app on your phone.

## Step 7: Test the Setup

### Test 1: Database Functions

```sql
-- Test signup bonus trigger
-- Sign up a new user via your app or Supabase Auth UI
-- Then check:
SELECT * FROM users WHERE email = 'test@example.com';
SELECT * FROM user_credits WHERE user_id = (SELECT id FROM users WHERE email = 'test@example.com');
```

Expected: User has 10 credits

### Test 2: Credits API

```typescript
// Use tRPC client
const { data } = await trpc.credits.getBalance.useQuery()
// Should return { balance: 10, total_earned: 10, total_spent: 0 }
```

### Test 3: Queue System

Check Redis connection:

```bash
# If using Upstash, test with their REST API
curl https://one-clam-28781.upstash.io/ping \
  -H "Authorization: Bearer AXBtAAIncDI4YTQyZDQ5ODg0NDQwMzNhZWEzMjQzMWEwZTQ5YmI5cDIyODc4MQ"

# Expected: "+PONG"
```

### Test 4: Worker Health Check

The worker should log on startup:

```
[Worker] Image generation worker started
```

## Step 8: Production Deployment

### 8.1 Deploy to Vercel

```bash
cd apps/next
vercel --prod
```

**Environment Variables in Vercel:**
1. Go to Project Settings > Environment Variables
2. Add all variables from `.env.local`
3. Set `NODE_ENV=production`

**Important:** The worker needs to run separately (see Worker Deployment below)

### 8.2 Worker Deployment

The BullMQ worker needs to run as a separate long-running process.

**Option A: Vercel Background Functions (Recommended)**
- Deploy worker as a Vercel Background Function
- See: https://vercel.com/docs/functions/background-functions

**Option B: Railway/Render**
- Deploy worker as a separate service
- Use the same environment variables
- Command: `node -r ts-node/register packages/api/src/workers/generation.worker.ts`

**Option C: Docker Container**
- Containerize the worker
- Deploy to AWS ECS, Google Cloud Run, or DigitalOcean App Platform

### 8.3 Expo Build

```bash
cd apps/expo

# Build development build
eas build --profile development --platform ios
eas build --profile development --platform android

# Build production
eas build --profile production --platform ios
eas build --profile production --platform android
```

## Troubleshooting

### Issue: "Cannot connect to Redis"

**Solution:**
- Check `REDIS_URL` is correct in `.env.local`
- Verify Upstash credentials
- Test connection with curl

### Issue: "Supabase auth error"

**Solution:**
- Verify `NEXT_PUBLIC_SUPABASE_URL` and keys
- Check RLS policies are created
- Ensure service role key is set for worker

### Issue: "Generation jobs stuck in queue"

**Solution:**
- Check worker is running (`yarn worker`)
- Verify Grok API key is valid
- Check worker logs for errors

### Issue: "Images not uploading"

**Solution:**
- Verify storage bucket exists
- Check storage policies are created
- Ensure file size < 10MB

### Issue: "Realtime not working"

**Solution:**
- Enable Realtime for `generation_sessions` table
- Check WebSocket connection in browser console
- Verify Supabase connection in mobile app

## Monitoring & Logs

### Queue Metrics

Check queue health:

```typescript
import { getQueueMetrics } from './packages/api/src/services/queue'

const metrics = await getQueueMetrics()
console.log(metrics)
// { waiting, active, completed, failed, delayed }
```

### View Logs

**Next.js logs:**
```bash
vercel logs
```

**Worker logs:**
Check your worker deployment platform logs

**Supabase logs:**
Go to Supabase Dashboard > Logs

## Next Steps

✅ Backend setup complete
⏭️ Implement mobile UI (camera, upload, results)
⏭️ Add analytics dashboard
⏭️ Implement subscription plans
⏭️ Add clothing library

## Support

- **Database Issues**: Check `supabase/README.md`
- **API Issues**: Review tRPC router logs
- **Queue Issues**: Check BullMQ dashboard or Redis logs
- **Deployment**: See Vercel/Expo documentation

---

Built with Claude Code 🤖
