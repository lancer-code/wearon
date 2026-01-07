# Quick Start Guide

Get WearOn running in 5 minutes!

## Prerequisites

- ✅ Redis credentials configured in `.env.local` (already done)
- ⚠️ Need to add Grok API key to `.env.local`
- ⚠️ Need to run Supabase migrations

## Step 1: Run Supabase Migrations

Go to your Supabase dashboard SQL Editor and run these files in order:

1. `supabase/migrations/001_initial_schema.sql`
2. `supabase/migrations/002_rls_policies.sql`

## Step 2: Create Storage Bucket

In Supabase Dashboard:
1. Go to **Storage**
2. Create bucket: `virtual-tryon-images` (private)
3. Add storage policies (see `supabase/migrations/002_rls_policies.sql` comments)

## Step 3: Add Grok API Key

Edit `apps/next/.env.local` and replace:
```
GROK_API_KEY=xai-your-api-key-here
```

Get your key from: https://x.ai/api

## Step 4: Start Development

Open 2 terminals:

### Terminal 1: Next.js (Frontend + API)
```bash
yarn web
```

### Terminal 2: Worker (Background Jobs)
```bash
cd packages/api
yarn worker
```

If `yarn worker` doesn't work, use:
```bash
node --require ts-node/register src/workers/generation.worker.ts
```

## Step 5: Test It

1. Open http://localhost:3000
2. Sign up for an account
3. You should get 10 free credits automatically!

## Verify Setup

### Check Database
```sql
-- In Supabase SQL Editor
SELECT * FROM users LIMIT 5;
SELECT * FROM user_credits LIMIT 5;
```

### Check Redis
The worker should log on startup:
```
[Worker] Image generation worker started
```

### Check API
Visit: http://localhost:3000/api/trpc/credits.getBalance

You should see your tRPC API is working!

## Common Issues

**Worker won't start:**
- Check Redis URL in `.env.local`
- Ensure Supabase service role key is set

**No credits after signup:**
- Run the migrations again
- Check the `handle_new_user()` trigger exists

**Images not uploading:**
- Create the storage bucket in Supabase
- Add storage policies

## Next: Mobile App

To run the Expo app:

1. Add your local IP to `apps/expo/.env`
2. Run: `yarn native`
3. Scan QR code with Expo Go

---

Full documentation: [SETUP.md](SETUP.md)
