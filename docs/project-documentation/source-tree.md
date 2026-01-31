# WearOn - Source Tree Analysis

## Repository Structure

```
wearon/
├── apps/
│   ├── expo/                      # [mobile] Expo React Native app
│   │   ├── app/                   # expo-router file-based routes
│   │   ├── scripts/               # Build scripts
│   │   └── package.json           # Expo dependencies
│   │
│   └── next/                      # [web] Next.js web application
│       ├── app/                   # App Router pages
│       │   ├── (auth)/            # Auth route group (login, signup)
│       │   ├── admin/             # Admin panel routes
│       │   │   ├── page.tsx       # Dashboard
│       │   │   ├── users/         # User management
│       │   │   ├── analytics/     # Analytics view
│       │   │   ├── generations/   # Generation management
│       │   │   ├── credits/       # Credit management
│       │   │   └── settings/      # Settings
│       │   ├── api/               # API routes
│       │   │   ├── trpc/          # tRPC handler
│       │   │   ├── auth/          # OAuth callback
│       │   │   └── cron/          # Scheduled jobs
│       │   └── dashboard/         # User dashboard
│       ├── proxy.ts               # Route protection middleware
│       └── utils/supabase/        # Server-side Supabase clients
│
├── packages/
│   ├── api/                       # [backend] tRPC API server
│   │   └── src/
│   │       ├── routers/           # API endpoint definitions
│   │       │   ├── _app.ts        # Router aggregation
│   │       │   ├── auth.ts        # Authentication
│   │       │   ├── user.ts        # User management
│   │       │   ├── credits.ts     # Credit operations
│   │       │   ├── generation.ts  # Try-on generation
│   │       │   ├── storage.ts     # File storage
│   │       │   ├── analytics.ts   # Analytics
│   │       │   └── roles.ts       # RBAC management
│   │       ├── services/          # Business logic
│   │       │   ├── openai-image.ts # OpenAI GPT Image 1.5 client
│   │       │   ├── queue.ts       # BullMQ job queue
│   │       │   └── storage-cleanup.ts # File expiry cleanup
│   │       ├── workers/           # Background processors
│   │       │   └── generation.worker.ts # Image generation worker
│   │       ├── utils/             # Utilities
│   │       │   └── rbac.ts        # Role/permission types
│   │       ├── trpc.ts            # tRPC context & procedures
│   │       └── index.ts           # Package exports
│   │
│   ├── app/                       # [library] Shared application logic
│   │   ├── features/              # Feature modules
│   │   │   ├── admin/             # Admin panel components
│   │   │   │   ├── admin-layout.tsx
│   │   │   │   ├── admin-sidebar.tsx
│   │   │   │   ├── admin-dashboard.tsx
│   │   │   │   ├── admin-users.tsx
│   │   │   │   ├── admin-analytics.tsx
│   │   │   │   ├── admin-credits.tsx
│   │   │   │   ├── admin-generations.tsx
│   │   │   │   └── admin-settings.tsx
│   │   │   ├── auth/              # Authentication UI
│   │   │   │   ├── login-screen.tsx
│   │   │   │   ├── signup-screen.tsx
│   │   │   │   ├── google-sign-in-button.tsx
│   │   │   │   └── auth-form-container.tsx
│   │   │   ├── dashboard/         # Dashboard UI
│   │   │   │   └── dashboard-screen.tsx
│   │   │   ├── home/              # Home screen
│   │   │   │   └── screen.tsx
│   │   │   └── user/              # User profile
│   │   │       └── detail-screen.tsx
│   │   ├── provider/              # React context providers
│   │   │   ├── index.tsx          # Provider composition
│   │   │   ├── SupabaseProvider.tsx # Auth + RBAC state
│   │   │   ├── TRPCProvider.tsx   # tRPC client
│   │   │   └── *TamaguiProvider.tsx # Platform-specific UI
│   │   └── utils/                 # Shared utilities
│   │       ├── trpc.ts            # tRPC client setup
│   │       └── supabase.ts        # Platform-aware Supabase client
│   │
│   ├── ui/                        # [library] Tamagui component library
│   │   └── src/                   # Reusable UI components
│   │
│   └── config/                    # [library] Shared configuration
│       └── src/
│           ├── tamagui.config.ts  # Tamagui theme setup
│           ├── fonts.ts           # Font definitions
│           └── animations.ts      # Animation presets
│
├── supabase/                      # Database configuration
│   ├── migrations/                # SQL migrations
│   │   ├── 001_initial_schema.sql # Core tables
│   │   ├── 002_rls_policies.sql   # Row-level security
│   │   ├── 003_rbac_schema.sql    # Roles & permissions
│   │   └── 004_user_credit_update_policy.sql
│   └── README.md                  # Setup instructions
│
├── docs/                          # Documentation
│   ├── project-documentation/     # Generated docs (this folder)
│   ├── architecture-plan.md       # ⚠️ OUTDATED (refs Grok, not OpenAI)
│   ├── SETUP.md                   # Installation guide
│   ├── QUICKSTART.md              # Quick setup
│   ├── RBAC.md                    # RBAC documentation
│   └── ...                        # Other guides
│
├── CLAUDE.md                      # AI assistant context
├── package.json                   # Root workspace config
├── turbo.json                     # Turbo build config
├── biome.json                     # Linter/formatter config
└── tsconfig.json                  # TypeScript config
```

## Entry Points

| Part | Entry Point | Purpose |
|------|-------------|---------|
| expo-app | `apps/expo/app/` | Expo Router file-based routing |
| next-app | `apps/next/app/` | Next.js App Router |
| api | `packages/api/src/index.ts` | tRPC router exports |
| app | `packages/app/index.ts` | Shared logic exports |
| ui | `packages/ui/src/index.ts` | Component exports |
| config | `packages/config/src/index.ts` | Config exports |

## Integration Points

```
┌─────────────┐     ┌─────────────┐
│  apps/expo  │────▶│ packages/app│
│   (mobile)  │     │  (shared)   │
└─────────────┘     └──────┬──────┘
                          │
┌─────────────┐           ▼
│  apps/next  │────▶┌─────────────┐
│    (web)    │────▶│ packages/api│
└─────────────┘     │  (backend)  │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │  Supabase   │
                    │ (DB/Auth/   │
                    │  Storage)   │
                    └─────────────┘
```

## Critical Folders by Part

### apps/expo (Mobile)
- `app/` - Routes and screens
- `scripts/` - Build helpers

### apps/next (Web)
- `app/` - Pages and API routes
- `app/api/trpc/` - tRPC endpoint handler
- `app/admin/` - Admin panel
- `proxy.ts` - Auth/role protection

### packages/api (Backend)
- `src/routers/` - All API endpoints
- `src/services/` - Business logic (OpenAI, Queue)
- `src/workers/` - Background job processors

### packages/app (Shared)
- `features/` - UI feature modules
- `provider/` - React context providers
- `utils/` - Shared utilities

---

*Generated: 2026-02-01 | WearOn Source Tree*
