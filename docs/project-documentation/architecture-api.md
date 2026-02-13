# WearOn - System Architecture

## Overview

WearOn is a **universal virtual try-on platform** with a shared codebase serving both web (Next.js) and mobile (Expo) clients through a unified tRPC API layer.

## Architecture Pattern

**Monorepo with Universal App Architecture**

```
┌──────────────────────────────────────────────────────────────┐
│                        CLIENTS                                │
├────────────────────────┬─────────────────────────────────────┤
│     apps/expo          │           apps/next                  │
│   (iOS/Android)        │        (Web + API Routes)           │
│  - expo-router         │     - Next.js App Router            │
│  - React Navigation    │     - Vercel hosting                │
│  - Native features     │     - SSR/SSG                       │
└────────────┬───────────┴──────────────┬──────────────────────┘
             │                          │
             ▼                          ▼
┌──────────────────────────────────────────────────────────────┐
│                    packages/app                               │
│              (Shared Features & Logic)                        │
│  - UI Components (Tamagui)     - tRPC Client                 │
│  - Feature modules             - Supabase Client             │
│  - Navigation (Solito)         - Providers                   │
└─────────────────────────┬────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────────┐
│                     packages/api                              │
│                 (tRPC API Server)                             │
├──────────────────────────────────────────────────────────────┤
│  Routers:                      Services:                      │
│  - auth.ts                     - openai-image.ts (GPT Image) │
│  - user.ts                     - queue.ts (BullMQ)           │
│  - credits.ts                  - storage-cleanup.ts          │
│  - generation.ts               Workers:                       │
│  - storage.ts                  - generation.worker.ts        │
│  - analytics.ts                                               │
│  - roles.ts                                                   │
└─────────────────────────┬────────────────────────────────────┘
                          │
         ┌────────────────┼────────────────┐
         ▼                ▼                ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│   Supabase   │  │    Redis     │  │   OpenAI     │
│  (Postgres)  │  │  (Upstash)   │  │ GPT Image 1.5│
│  - Auth      │  │  - BullMQ    │  │              │
│  - Database  │  │  - Rate      │  │  Virtual     │
│  - Storage   │  │    limiting  │  │  Try-on AI   │
│  - Realtime  │  │              │  │              │
└──────────────┘  └──────────────┘  └──────────────┘
```

## Key Components

### 1. Image Generation Pipeline

```
User Request → tRPC → Credit Check → BullMQ Queue → Worker
                                                      │
                                    ┌─────────────────┤
                                    ▼                 │
                              Download Images         │
                                    │                 │
                                    ▼                 │
                              Resize (Sharp)          │
                              (Cost optimization)     │
                                    │                 │
                                    ▼                 │
                              OpenAI API Call         │
                              (GPT Image 1.5)         │
                                    │                 │
                                    ▼                 │
                              Upload Result           │
                              (Supabase Storage)      │
                                    │                 │
                                    ▼                 │
                              Update Session ─────────┘
                              (Triggers Realtime)
```

### 2. Authentication Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Client    │────▶│  Supabase   │────▶│  Database   │
│  (Login)    │     │    Auth     │     │  Triggers   │
└─────────────┘     └──────┬──────┘     └──────┬──────┘
                           │                   │
                           ▼                   ▼
                    JWT Token            Create Profile
                    Returned             Grant 10 Credits
```

### 3. Shopify B2B Authentication (Managed Installation)

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Shopify    │────▶│  App Bridge │────▶│  WearOn API │
│  Admin      │     │  (iframe)   │     │  /api/shopify│
│  Iframe     │     │  Session    │     │  /store/*   │
└─────────────┘     │  Token JWT  │     └──────┬──────┘
                    └─────────────┘            │
                                               ▼
                                    ┌─────────────────┐
                                    │ Session Middleware│
                                    │ Verify JWT       │
                                    │ Store exists? ───┐
                                    └────────┬────────┘│
                                             │    NO   │
                                             │         ▼
                                        YES  │  Token Exchange
                                             │  Auto-provision
                                             │  Store + API Key
                                             ▼
                                    ┌─────────────────┐
                                    │  Supabase       │
                                    │  stores table   │
                                    └─────────────────┘
```

- No OAuth callback — Shopify managed installation handles consent
- Session token (JWT) verified via HMAC-SHA256 with client secret
- Token exchange: `shopify.auth.tokenExchange()` → offline access token
- Store auto-provisioned on first request if not found

### 4. RBAC System

```
user_roles ──┬── roles ──┬── role_permissions ──┬── permissions
             │           │                      │
    user_id──┤  admin    │                      ├── users:read
             │  moderator│                      ├── users:write
             │  user     │                      ├── generations:create
             │           │                      ├── admin:access
             │           │                      └── ...
```

## Technology Decisions

### Why tRPC?
- End-to-end type safety
- No code generation needed
- Works seamlessly with React Query
- Shared types between client and server

### Why BullMQ?
- Rate limiting for OpenAI API (handles 300 req/min)
- Job persistence and retry logic
- Background processing without blocking requests
- Redis-backed for reliability

### Why Supabase?
- Built-in auth with OAuth support
- Realtime subscriptions for live updates
- Row-level security for data isolation
- Integrated storage with signed URLs

### Why Tamagui?
- Universal components (web + native)
- Near-native performance
- Design system built-in
- Solito integration for navigation

## Image Processing (Sharp)

Sharp is used for **cost optimization** before sending to OpenAI:

1. **Resize**: Max 1024px on longest side
2. **Convert**: To JPEG (consistent format)
3. **Token Savings**: ~75% reduction for typical phone photos

```typescript
// Token calculation: 85 + 170 * tiles
// 1024x1024 = 4 tiles = 765 tokens
// vs 4000x3000 original = 48 tiles = 8245 tokens
```

## Privacy & Cleanup

- All images deleted after 6 hours
- Vercel Cron runs `/api/cron/cleanup` every 6 hours
- Database stores URLs only (which expire)
- Users must save results to device

## Rate Limiting

| Resource | Limit | Handling |
|----------|-------|----------|
| OpenAI API | 300 req/min | BullMQ rate limiter |
| Redis (Upstash) | Per plan | Lazy connections |
| Supabase | Per plan | Connection pooling |

## Scalability Considerations

1. **Horizontal Worker Scaling**: Add more BullMQ workers
2. **Database**: Supabase handles scaling
3. **Storage**: Supabase Storage with CDN
4. **API**: Serverless via Vercel

---

*Generated: 2026-02-01 | WearOn Architecture*
