# Supabase Setup Guide

This directory contains database migrations and configuration for the WearOn virtual try-on platform.

## Prerequisites

1. Supabase project created at [supabase.com](https://supabase.com)
2. Supabase CLI installed: `npm install -g supabase`
3. Project linked to Supabase: `supabase link --project-ref YOUR_PROJECT_REF`

## Database Migrations

### Running Migrations

**Option 1: Using Supabase Dashboard (Recommended for first-time setup)**

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy and paste the contents of each migration file in order:
   - `migrations/001_initial_schema.sql`
   - `migrations/002_rls_policies.sql`
4. Click **RUN** for each migration

**Option 2: Using Supabase CLI**

```bash
# From project root
cd supabase

# Apply all migrations
supabase db push

# Or apply specific migration
supabase db push --include-all
```

### Migration Files

1. **001_initial_schema.sql**
   - Creates `users`, `user_credits`, `credit_transactions`, `generation_sessions`, and `analytics_events` tables
   - Adds indexes for performance
   - Creates `handle_new_user()` trigger for automatic user profile and credit creation
   - Creates `deduct_credits()` and `refund_credits()` functions
   - Enables Realtime for `generation_sessions` table

2. **002_rls_policies.sql**
   - Enables Row Level Security on all tables
   - Creates policies for users to access their own data
   - Grants service role full access for background workers

## Storage Buckets

### Creating the Storage Bucket

1. Go to **Storage** in your Supabase dashboard
2. Click **New bucket**
3. **Bucket name**: `virtual-tryon-images`
4. **Public**: Unchecked (private bucket)
5. **File size limit**: 10 MB
6. **Allowed MIME types**: `image/jpeg`, `image/png`, `image/webp`

### Storage Policies

After creating the bucket, add these policies in **Storage > Policies**:

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

-- Service role has full access (for workers and cron jobs)
CREATE POLICY "Service role has full storage access"
  ON storage.objects
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');
```

## Realtime Setup

The `generation_sessions` table is configured for Realtime updates to push generation status to mobile clients.

### Enable Realtime (if not auto-enabled)

1. Go to **Database > Replication** in Supabase dashboard
2. Find `generation_sessions` table
3. Toggle **Realtime** to ON

## Environment Variables

Update your `.env` files with Supabase credentials:

### Next.js (`apps/next/.env.local`)

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

### Expo (`apps/expo/.env`)

```env
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
```

## Testing the Setup

### Verify Tables

```sql
-- Check all tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE';
```

### Test Signup Bonus

1. Sign up a new user via your app or Supabase Auth UI
2. Check if user record was created:

```sql
SELECT * FROM users WHERE email = 'test@example.com';
```

3. Verify credits were granted:

```sql
SELECT * FROM user_credits WHERE user_id = (
  SELECT id FROM users WHERE email = 'test@example.com'
);
```

4. Check transaction log:

```sql
SELECT * FROM credit_transactions WHERE user_id = (
  SELECT id FROM users WHERE email = 'test@example.com'
);
```

Expected result: User should have 10 credits with a "signup_bonus" transaction.

### Test Credit Deduction

```sql
-- Deduct 1 credit
SELECT deduct_credits(
  'user_id_here'::uuid,
  1,
  'Test image generation'
);

-- Should return true if successful
```

### Test Realtime

Subscribe to updates using the Supabase client:

```typescript
const channel = supabase
  .channel('test-realtime')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'generation_sessions'
  }, (payload) => {
    console.log('Change received!', payload)
  })
  .subscribe()
```

## Troubleshooting

### "relation does not exist"

- Make sure you ran the migrations in the correct order
- Check that you're connected to the right Supabase project

### RLS Policy Errors

- Verify you're using the correct Supabase client (authenticated vs service role)
- Check policies in **Database > Policies** in the dashboard

### Realtime Not Working

- Ensure Realtime is enabled for `generation_sessions` table
- Check that your subscription filter matches the table structure
- Verify network connection (WebSocket support)

## Next Steps

1. ✅ Run database migrations
2. ✅ Create storage bucket
3. ✅ Add storage policies
4. ✅ Enable Realtime
5. ✅ Update environment variables
6. ⏭️ Test signup flow
7. ⏭️ Implement generation API endpoints
