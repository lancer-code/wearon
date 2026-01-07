# Credits System & Analytics

## Credit System Overview

### How Credits Work

**Initial Credits:**
- Every new user gets **10 free credits** on signup
- Automatically granted by the `handle_new_user()` database trigger
- Logged in `credit_transactions` table as `signup_bonus`

**Credit Deduction:**
- **1 credit** is deducted when user creates a generation request
- Happens **before** the job is queued (in `generation.create()`)
- Uses atomic `deduct_credits()` function to prevent race conditions

**Credit Refund (Automatic):**
- If generation **fails**, the 1 credit is **automatically refunded**
- Handled in the worker's error handler
- Does NOT refund on rate limit errors (429) - job will retry instead
- Logged in `credit_transactions` as `refund`

### Credit Flow

```
1. User creates generation
   ↓
2. Check balance >= 1 credit
   ↓
3. Deduct 1 credit (atomic operation)
   ↓
4. Queue job
   ↓
5. Worker processes job
   ↓
   ├─ SUCCESS → Credit stays deducted ✅
   └─ FAILURE → Credit refunded automatically 🔄
```

### Database Tables

**`user_credits`**
```sql
- user_id: UUID (unique)
- balance: INTEGER (current credits)
- total_earned: INTEGER (lifetime earned)
- total_spent: INTEGER (lifetime spent)
- updated_at: TIMESTAMPTZ
```

**`credit_transactions`** (Audit Trail)
```sql
- user_id: UUID
- amount: INTEGER (negative for spending, positive for earning)
- type: 'signup_bonus' | 'generation' | 'refund'
- description: TEXT
- created_at: TIMESTAMPTZ
```

### API Endpoints

**Get Balance:**
```typescript
const { data } = await trpc.credits.getBalance.useQuery()
// Returns: { balance, total_earned, total_spent, updated_at }
```

**Get Transaction History:**
```typescript
const { data } = await trpc.credits.getTransactions.useQuery({
  limit: 50,
  offset: 0
})
// Returns: Array of transactions
```

## Analytics System

### What We Track

**1. Generation Sessions** (`generation_sessions` table)
Every try-on generation is recorded with:
- `status`: 'pending' | 'processing' | 'completed' | 'failed'
- `processing_time_ms`: How long it took
- `credits_used`: Always 1 (or 0 if refunded)
- `created_at`, `completed_at`: Timestamps
- `error_message`: If it failed

**2. Analytics Events** (`analytics_events` table)
Key events are logged:
- `user_signup`: When user creates account
- `generation_started`: When generation is queued
- `generation_completed`: When successfully completed
- `generation_failed`: When it fails

Each event includes:
```typescript
{
  event_type: string,
  user_id: UUID,
  metadata: {
    session_id?: string,
    processing_time_ms?: number,
    error?: string,
    // ... custom data per event
  },
  created_at: TIMESTAMPTZ
}
```

### Analytics API Endpoints

**1. Total Generations (Platform-wide)**
```typescript
const { data } = await trpc.analytics.getTotalGenerations.useQuery()
// Returns: { total: 1234 }
```

**2. Generation Stats by Status**
```typescript
const { data } = await trpc.analytics.getGenerationStats.useQuery()
// Returns: { total, completed, failed, pending, processing }
```

**3. Daily Statistics (Last 30 days)**
```typescript
const { data } = await trpc.analytics.getDailyStats.useQuery({ days: 30 })
// Returns: [{ date: '2026-01-07', started: 10, completed: 8, failed: 2 }, ...]
```

**4. User-Specific Stats**
```typescript
const { data } = await trpc.analytics.getUserStats.useQuery()
// Returns: {
//   total,
//   completed,
//   failed,
//   pending,
//   processing,
//   avgProcessingTimeMs,
//   totalCreditsUsed
// }
```

**5. Processing Metrics**
```typescript
const { data } = await trpc.analytics.getProcessingMetrics.useQuery()
// Returns: { avgMs, minMs, maxMs, count }
```

**6. Recent Events (Debugging)**
```typescript
const { data } = await trpc.analytics.getRecentEvents.useQuery({
  limit: 50,
  eventType: 'generation_failed' // optional filter
})
// Returns: Array of recent analytics events
```

## Example Queries

### Check if user has credits
```typescript
const { data: credits } = await trpc.credits.getBalance.useQuery()

if (credits.balance < 1) {
  alert('Insufficient credits!')
  return
}
```

### View generation history
```typescript
const { data: history } = await trpc.generation.getHistory.useQuery({
  limit: 20,
  status: 'completed' // optional: filter by status
})
```

### Monitor platform health
```typescript
const { data: stats } = await trpc.analytics.getGenerationStats.useQuery()
const successRate = (stats.completed / stats.total) * 100

console.log(`Success rate: ${successRate.toFixed(1)}%`)
console.log(`Active jobs: ${stats.pending + stats.processing}`)
```

### Check processing performance
```typescript
const { data: metrics } = await trpc.analytics.getProcessingMetrics.useQuery()

console.log(`Average processing time: ${metrics.avgMs}ms`)
console.log(`Fastest: ${metrics.minMs}ms, Slowest: ${metrics.maxMs}ms`)
```

## Credit Refund Logic (Worker)

The worker automatically refunds credits on failure:

```typescript
// In generation.worker.ts
try {
  // ... process generation
} catch (error) {
  // Check if rate limit error
  if (error.statusCode === 429) {
    throw error // Let BullMQ retry, don't refund
  }

  // Refund credit
  await supabase.rpc('refund_credits', {
    p_user_id: userId,
    p_amount: 1,
    p_description: `Generation failed: ${error.message}`
  })

  // Mark session as failed
  await supabase
    .from('generation_sessions')
    .update({ status: 'failed', error_message: error.message })
    .eq('id', sessionId)

  // Log failure event
  await supabase.from('analytics_events').insert({
    event_type: 'generation_failed',
    user_id: userId,
    metadata: { session_id: sessionId, error: error.message }
  })
}
```

## Future Enhancements

### Subscription Tiers
```typescript
// Example: Different credit allocations per tier
const PLANS = {
  free: { monthly_credits: 10 },
  basic: { monthly_credits: 50, price: 9.99 },
  pro: { monthly_credits: 200, price: 29.99 },
}
```

### Credit Purchase
```typescript
// Allow users to buy additional credits
await trpc.credits.purchase.mutate({
  amount: 10,
  paymentMethod: 'stripe'
})
```

### Admin Dashboard
```typescript
// View platform-wide analytics
const dailyRevenue = await trpc.analytics.getDailyRevenue.useQuery()
const activeUsers = await trpc.analytics.getActiveUsers.useQuery({ days: 7 })
```

## Monitoring & Alerts

### Key Metrics to Watch

1. **Success Rate**: `completed / total`
   - Target: > 95%
   - Alert if < 90%

2. **Processing Time**: `avgProcessingTimeMs`
   - Target: < 60 seconds
   - Alert if > 120 seconds

3. **Queue Depth**: `pending + processing`
   - Target: < 50 jobs
   - Alert if > 100 jobs

4. **Failed Generations**: Track error types
   - Identify common failure reasons
   - Improve error handling

5. **Credit Refunds**: Monitor refund rate
   - High refund rate = system issues
   - Should be < 5%

## SQL Queries for Deep Analytics

### Most active users
```sql
SELECT
  user_id,
  COUNT(*) as generation_count,
  SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
  SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
FROM generation_sessions
GROUP BY user_id
ORDER BY generation_count DESC
LIMIT 10;
```

### Error analysis
```sql
SELECT
  error_message,
  COUNT(*) as error_count,
  AVG(processing_time_ms) as avg_processing_time
FROM generation_sessions
WHERE status = 'failed'
GROUP BY error_message
ORDER BY error_count DESC;
```

### Credit balance distribution
```sql
SELECT
  balance,
  COUNT(*) as user_count
FROM user_credits
GROUP BY balance
ORDER BY balance DESC;
```

---

**Summary:**
- ✅ Credits are deducted **before** generation starts
- ✅ Credits are **automatically refunded** if generation fails
- ✅ All generations are tracked in database with status
- ✅ Comprehensive analytics available via tRPC API
- ✅ Platform health metrics and user statistics
