# WearOn - API Contracts

## Overview

WearOn uses **tRPC v11** for type-safe API communication. All endpoints are defined in `packages/api/src/routers/`.

## Base URL

- **Development**: `http://localhost:3000/api/trpc`
- **Production**: `https://your-domain.com/api/trpc`

## Authentication

Most endpoints require authentication via Supabase JWT token in the request header.

---

## Routers

### Auth Router (`auth`)

| Endpoint | Type | Access | Description |
|----------|------|--------|-------------|
| `auth.signUp` | mutation | public | Register new user |
| `auth.signIn` | mutation | public | Login with email/password |
| `auth.signOut` | mutation | protected | Logout current user |
| `auth.session` | query | protected | Get current session |
| `auth.updatePassword` | mutation | protected | Change password |

### User Router (`user`)

| Endpoint | Type | Access | Description |
|----------|------|--------|-------------|
| `user.me` | query | protected | Get current user profile |
| `user.byId` | query | protected | Get user by ID |
| `user.update` | mutation | protected | Update user profile |

### Credits Router (`credits`)

| Endpoint | Type | Access | Description |
|----------|------|--------|-------------|
| `credits.getBalance` | query | protected | Get credit balance |
| `credits.getTransactions` | query | protected | Get transaction history (paginated) |

**Input Schema (getTransactions):**
```typescript
{
  limit: number (1-100, default: 50),
  offset: number (min: 0, default: 0)
}
```

### Generation Router (`generation`)

| Endpoint | Type | Access | Description |
|----------|------|--------|-------------|
| `generation.create` | mutation | protected | Start new virtual try-on |
| `generation.getById` | query | protected | Get generation by session ID |
| `generation.getHistory` | query | protected | Get generation history (paginated) |
| `generation.getStats` | query | protected | Get user generation statistics |

**Input Schema (create):**
```typescript
{
  modelImageUrl: string (URL),      // Person photo
  outfitImageUrl?: string (URL),    // Clothing item
  accessories?: Array<{
    type: string,
    url: string (URL)
  }>
}
```

**Response (create):**
```typescript
{
  sessionId: string (UUID),
  status: 'pending',
  message: string
}
```

### Storage Router (`storage`)

| Endpoint | Type | Access | Description |
|----------|------|--------|-------------|
| `storage.getUploadUrls` | mutation | admin | Get presigned upload URLs |
| `storage.getDownloadUrls` | mutation | admin | Get signed download URLs |
| `storage.adminUpload` | mutation | admin | Upload file with service role |
| `storage.getPublicUrl` | query | protected | Get public URL |
| `storage.getSignedUrl` | query | protected | Get signed URL |
| `storage.delete` | mutation | protected | Delete files |
| `storage.listFiles` | query | protected | List bucket files |

**Input Schema (getUploadUrls):**
```typescript
{
  files: Array<{
    fileName: string,
    contentType: string,
    type: 'model' | 'outfit' | 'accessory'
  }>,
  bucket: string (default: 'virtual-tryon-images')
}
```

### Roles Router (`roles`)

| Endpoint | Type | Access | Description |
|----------|------|--------|-------------|
| `roles.myRoles` | query | protected | Get current user's roles |
| `roles.myPermissions` | query | protected | Get current user's permissions |
| `roles.list` | query | protected | List all available roles |
| `roles.listPermissions` | query | protected | List all permissions |
| `roles.getUserRoles` | query | admin | Get roles for any user |
| `roles.assign` | mutation | admin | Assign role to user |
| `roles.remove` | mutation | admin | Remove role from user |
| `roles.listUsersWithRoles` | query | admin | Paginated user list with roles |

### Analytics Router (`analytics`)

| Endpoint | Type | Access | Description |
|----------|------|--------|-------------|
| `analytics.getTotalGenerations` | query | protected | Total generation count |
| `analytics.getDailyStats` | query | protected | Daily statistics |

---

## Error Handling

All endpoints return errors in this format:
```typescript
{
  error: {
    code: string,
    message: string
  }
}
```

**Common Error Codes:**
- `UNAUTHORIZED` - Missing or invalid auth
- `INSUFFICIENT_CREDITS` - Not enough credits
- `NOT_FOUND` - Resource not found
- `RATE_LIMIT_EXCEEDED` - Too many requests

---

## Generation Flow

1. **Upload Images** → `storage.getUploadUrls` → Upload to Supabase
2. **Get Download URLs** → `storage.getDownloadUrls` (after upload completes)
3. **Create Generation** → `generation.create` (deducts 1 credit)
4. **Subscribe to Updates** → Supabase Realtime on `generation_sessions`
5. **Poll Fallback** → `generation.getById` every 2 seconds

---

*Generated: 2026-02-01 | WearOn API Documentation*
