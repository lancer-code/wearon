# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **Tamagui + Solito + Next.js + Expo monorepo** for building universal (web + native) applications. The codebase uses Yarn Workspaces with a monorepo structure where code is shared between web (Next.js) and native (Expo) platforms.

**Tech Stack:**
- **Tamagui**: Universal UI components and styling system
- **Solito**: Cross-platform navigation (linking Expo Router and Next.js)
- **Next.js 16**: Web application (React 19)
- **Expo SDK 53**: Native iOS/Android application
- **React 19**: Shared across platforms
- **tRPC**: Type-safe API layer with end-to-end type safety
- **Supabase**: Backend as a Service (auth, database, storage, realtime)
- **Axios**: HTTP client for all API requests (preferred over fetch)
- **React Query**: Data fetching and caching
- **Sharp**: High-performance image processing (resize for cost optimization)
- **BullMQ + Redis**: Job queue with rate limiting (300 req/min)
- **OpenAI GPT Image 1.5**: AI image generation (virtual try-on)
- **Biome**: Linting and formatting
- **Vitest**: Testing framework
- **Yarn 4.5**: Package manager
- **Turbo**: Build system orchestration

## Development Commands

### Initial Setup
```bash
yarn                    # Install all dependencies (runs postinstall build)
```

### Running Applications
```bash
yarn web               # Build packages + start Next.js dev server
yarn web:extract       # Run web with Tamagui optimizer (slower, for testing)
yarn web:prod          # Production build for Next.js
yarn web:prod:serve    # Serve production build on port 8151

yarn native            # Start Expo dev server
yarn ios               # Run iOS app (Expo)
yarn android           # Run Android app (Expo)
yarn native:prebuild   # Generate native iOS/Android projects
```

### Background Worker (Required for Image Generation)
```bash
cd packages/api
yarn worker            # Start BullMQ worker for image generation jobs
```

The worker processes generation jobs from the queue, sends images directly to OpenAI GPT Image 1.5, and updates session status via Supabase Realtime. On startup, it clears any pending jobs from previous runs.

### Development Workflow
```bash
yarn build             # Build all workspace packages (excludes next-app)
yarn watch             # Watch mode for all packages (uses ultra-runner)
```

### Testing & Quality
```bash
yarn test              # Run Vitest tests
yarn test:watch        # Run tests in watch mode

# Linting (Biome)
cd apps/next && yarn lint        # Lint Next.js app
cd apps/expo && yarn lint        # Lint Expo app (if configured)
```

### Maintenance
```bash
yarn upgrade:tamagui         # Update Tamagui to latest stable
yarn upgrade:tamagui:canary  # Update Tamagui to canary
yarn check-tamagui           # Verify Tamagui installation
```

## Project Structure

```
apps/
  expo/          - Native iOS/Android app using Expo Router
  next/          - Web app using Next.js App Router
    app/
      layout.tsx   - Root layout (bare html/body, App Bridge script)
      (main)/      - Tamagui pages (provider wrapper only, not a root layout)
        layout.tsx   - NextTamaguiProvider wrapper
        (auth)/      - Auth route group (login, signup pages)
        admin/       - Admin panel (admin/moderator only)
        dashboard/   - Protected dashboard page
        merchant/    - Merchant onboarding and management
      shopify/     - Shopify Admin pages (Polaris, not Tamagui)
        layout.tsx   - PolarisProvider + shopify-api-key metadata
        page.tsx     - Main Shopify admin page
        billing/     - Billing page
        settings/    - Settings page
      api/         - API routes (flat, no route group)
        auth/        - Supabase OAuth callback
        shopify/store/ - Shopify store API (session-token auth)
        trpc/        - tRPC handler
        v1/          - B2B REST API
        cron/        - Scheduled cleanup/churn jobs
    proxy.ts     - Route protection (auth + role checks)
    utils/supabase/ - Server-side Supabase clients
packages/
  api/           - tRPC server with Supabase integration
    routers/     - API routers (auth, user, storage, roles)
    utils/       - Server utilities (rbac.ts)
  app/           - Shared application logic and features
    features/    - Feature-based organization (NOT screens/)
      admin/     - Admin panel components
        admin-layout.tsx    - Sidebar + content layout
        admin-sidebar.tsx   - Navigation sidebar (ShadCN style)
        admin-dashboard.tsx - Dashboard content
        admin-users.tsx     - User management
        admin-analytics.tsx - Analytics view
        admin-generations.tsx - Generations management
        admin-credits.tsx   - Credits management
        admin-settings.tsx  - Settings page
      auth/      - Login, signup, Google OAuth components
      dashboard/ - Dashboard screen
    provider/    - Platform-specific and shared providers
    utils/       - Shared utilities (tRPC client, Supabase client)
  ui/            - Custom UI component library (@my/ui)
  config/        - Shared configuration (Tamagui config)
docs/
  RBAC.md        - Role-based access control documentation
supabase/
  migrations/    - Database migrations (001-003)
```

### Feature-Based Organization
The codebase uses **feature-based** organization in `packages/app/features/`, not a `screens/` folder. Organize code by feature domains (e.g., `user/`, `home/`) rather than technical layers.

### Shared Code Strategy
- **packages/api**: tRPC server-side API with Supabase integration
- **packages/app**: Contains features, navigation, business logic, and API clients shared across platforms
- **packages/ui**: Contains Tamagui-based UI components following the design system
- **packages/config**: Shared configuration including Tamagui theme setup

## Tamagui Configuration

The Tamagui config is centralized in `packages/config/src/tamagui.config.ts`:
- Extends `@tamagui/config/v4` default configuration
- Custom fonts defined in `fonts.ts` (body and heading)
- Custom animations in `animations.ts`
- Setting: `onlyAllowShorthands: false` (allows both shorthand and full props)

### Adding Debug Output
Add `// debug` as a comment at the top of any file to see Tamagui compiler output.

## Dependency Management

### Installing Dependencies

**Pure JavaScript dependencies** (used across platforms):
```bash
cd packages/app
yarn add <package-name>
cd ../..
yarn
```

**Native dependencies** (with native code):
```bash
cd apps/expo
yarn add <package-name>
cd ../..
yarn
```

**CRITICAL**: If installing a native library in both `packages/app` and `apps/expo`, use the **exact same version** in both. Version mismatches cause severe bugs (classic monorepo issue).

### Transpilation for Next.js
If a package shows "Cannot use import statement outside a module", add it to `transpilePackages` in `apps/next/next.config.js`.

## Code Style & Linting

**Biome Configuration** (`biome.json`):
- Formatter: 2-space indentation, 100-char line width, single quotes, ES5 trailing commas
- Import type enforcement: `useImportType: "error"` (use `import type` for types)
- Console logs are errors: `noConsoleLog: "error"`
- Many rules relaxed for flexibility (see `biome.json` for specifics)

**Formatting**: Biome handles formatting and linting. No Prettier.

## Testing

- **Framework**: Vitest
- **Config**: Root `vitest.config.mts` + per-app configs
- **Run**: `yarn test` (all tests) or `yarn test:watch` (watch mode)
- **Playwright**: Available in Next.js app for E2E testing

## Build System

**Turbo Pipeline** (`turbo.json`):
- `build` task: Depends on `^build` (dependencies first), respects environment variables
- Outputs cached: `.next/**`, `build/**`, Metro cache
- `dev` task: Persistent, no caching

**Global Environment Variables**:
- `DISABLE_EXTRACTION`: Control Tamagui extraction
- `NODE_ENV`: Environment mode
- `EAS_BUILD_PLATFORM`: Expo build platform

## Deployment

### Vercel (Next.js)
- **Root directory**: `apps/next`
- **Install command**: `yarn set version stable && yarn install`
- **Build command**: Default (uses `next build`)
- **Output directory**: Default

### Expo (Native)
Use EAS Build for native app deployment. See Expo documentation.

## Cross-Platform Navigation

**Solito** manages navigation between platforms:
- Expo uses `expo-router` (file-based routing)
- Next.js uses App Router (or Pages Router - see README for migration)
- Solito provides unified navigation API via `@react-navigation/native`

## Important Notes

- **Node Version**: Node 22 required (`engines` field)
- **Package Manager**: Yarn 4.5.0 (enforced by `packageManager` field)
- **React 19**: Using latest React 19.0.0 across all platforms
- **Husky**: Git hooks configured (see `.husky/`)
- **Monorepo Resolutions**: Specific versions pinned for React, React Native Web, SVG (see `resolutions` in root `package.json`)

## tRPC + Supabase Integration

### API Structure (`packages/api`)

The API is built with tRPC and Supabase, providing type-safe end-to-end API calls:

**Routers:**
- **auth**: Authentication (signUp, signIn, signOut, session, updatePassword)
- **user**: User management (me, byId, update)
- **storage**: File storage (getUploadUrls, getDownloadUrls, adminUpload, delete, listFiles)
- **roles**: Role management (myRoles, myPermissions, assign, remove) - see RBAC section
- **credits**: Credit balance and transactions
- **generation**: Virtual try-on generation
- **analytics**: Platform analytics

**Protected Procedures**: Use `protectedProcedure` for authenticated-only endpoints. Middleware automatically checks for valid user session.

**Shopify B2B Services (`packages/api/src/services/shopify.ts`):**
- `exchangeTokenForOfflineAccess(shop, sessionToken)` — Token exchange for managed installation
- `createShopifyClient(shopDomain, accessToken)` — Admin GraphQL client

**Shopify Session Middleware (`packages/api/src/middleware/shopify-session.ts`):**
- Verifies App Bridge session token (JWT) via HMAC-SHA256
- Auto-provisions store on first request via token exchange
- Creates `stores` + `store_api_keys` records
- Wraps API handlers with `withShopifySession(handler)`

### Client Usage

Import the tRPC client from `packages/app/utils/trpc.ts`:

```typescript
import { trpc } from '../utils/trpc'

// In a component
function MyComponent() {
  // Query
  const { data, isLoading } = trpc.user.me.useQuery()

  // Mutation
  const signIn = trpc.auth.signIn.useMutation()

  return <Button onPress={() => signIn.mutate({ email, password })} />
}
```

### Supabase Client

Platform-aware Supabase clients in `packages/app/utils/supabase.ts`:
- **Web**: Uses `@supabase/ssr` with cookie-based storage (works with Next.js proxy)
- **Native**: Uses standard Supabase client with AsyncStorage

Access current user via `useSupabase()` hook from `SupabaseProvider`.

### Environment Variables

**Next.js** (`apps/next/.env`):
```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx  # Server-side only
NEXT_PUBLIC_API_URL=http://localhost:3000/api/trpc
NEXT_PUBLIC_SITE_URL=http://localhost:3000  # For OAuth callbacks
```

**Expo** (`apps/expo/.env`):
```bash
EXPO_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=xxx
EXPO_PUBLIC_API_URL=http://YOUR_LOCAL_IP:3000/api/trpc
```

### Provider Hierarchy

Providers wrap the app in this order (see `packages/app/provider/index.tsx`):
1. **SupabaseProvider** - Auth state management + redirect handling
2. **TRPCProvider** - API client with React Query
3. **TamaguiProvider** - UI styling
4. **ToastProvider** - Toast notifications

### Authentication & Route Protection

**Auth Pages** (`packages/app/features/auth/`):
- `login-screen.tsx` - Email/password login with Google OAuth
- `signup-screen.tsx` - Registration with email confirmation
- `google-sign-in-button.tsx` - Google OAuth button component
- `auth-form-container.tsx` - Two-column layout (form left, illustration right)

**Protected Routes** (`apps/next/proxy.ts`):
- Uses Next.js proxy (formerly middleware) for server-side route protection
- `/dashboard/*` - Redirects to `/login` if not authenticated
- `/login`, `/signup` - Redirects to `/dashboard` if already authenticated

**Client-Side Redirects** (`packages/app/provider/SupabaseProvider.tsx`):
- Listens for `SIGNED_IN` event → redirects to `/dashboard`
- Listens for `SIGNED_OUT` event → redirects to `/login`

**Form Validation**: Uses Zod schemas for login/signup validation with inline error display.

### Adding New API Endpoints

1. Create router in `packages/api/src/routers/`
2. Add to `packages/api/src/routers/_app.ts`
3. Use `publicProcedure` or `protectedProcedure`
4. Define input schema with Zod
5. Client automatically gets type-safe access

## Role-Based Access Control (RBAC)

The platform implements a full RBAC system with separate roles and permissions tables for granular access control.

### Database Schema (`supabase/migrations/003_rbac_schema.sql`)

**Tables:**
- `roles`: Available roles (user, moderator, admin)
- `permissions`: Available permissions (e.g., users:read, generations:create)
- `role_permissions`: Many-to-many mapping of roles to permissions
- `user_roles`: Assigns roles to users

**Database Functions (RPC):**
- `user_has_permission(user_id, permission_name)`: Check if user has permission
- `user_has_role(user_id, role_name)`: Check if user has role
- `get_user_permissions(user_id)`: Get all permissions for a user
- `get_user_roles(user_id)`: Get all roles for a user

### Default Roles & Permissions

| Role | Permissions |
|------|-------------|
| **user** | users:read, generations:read, generations:create, credits:read |
| **moderator** | All user permissions + users:write, generations:delete, analytics:read |
| **admin** | All permissions including users:manage, credits:manage, admin:access, roles:manage |

New users automatically receive the `user` role via database trigger.

### API Procedures (`packages/api/src/trpc.ts`)

```typescript
// Protected - requires authentication
export const protectedProcedure = t.procedure.use(...)

// Admin only - requires admin role
export const adminProcedure = protectedProcedure.use(...)

// Moderator - requires moderator or admin role
export const moderatorProcedure = protectedProcedure.use(...)

// Custom permission check
export function withPermission(permission: PermissionName) {...}
```

**Usage in routers:**
```typescript
import { adminProcedure, withPermission } from '../trpc'

export const myRouter = router({
  // Only admins can access
  adminOnly: adminProcedure.query(...),

  // Requires specific permission
  manageCredits: withPermission('credits:manage').mutation(...),
})
```

### Roles Router (`packages/api/src/routers/roles.ts`)

| Endpoint | Access | Description |
|----------|--------|-------------|
| `roles.myRoles` | Protected | Get current user's roles |
| `roles.myPermissions` | Protected | Get current user's permissions |
| `roles.list` | Protected | List all available roles |
| `roles.listPermissions` | Protected | List all available permissions |
| `roles.getUserRoles` | Admin | Get roles for any user |
| `roles.assign` | Admin | Assign role to user |
| `roles.remove` | Admin | Remove role from user |
| `roles.listUsersWithRoles` | Admin | Paginated user list with roles |

### Client-Side Usage (`useSupabase()` hook)

```typescript
import { useSupabase } from 'app/provider/SupabaseProvider'

function MyComponent() {
  const {
    roles,           // RoleName[] - user's roles
    permissions,     // PermissionName[] - user's permissions
    hasRole,         // (role: RoleName) => boolean
    hasPermission,   // (permission: PermissionName) => boolean
    isAdmin,         // boolean - shorthand for hasRole('admin')
    isModerator,     // boolean - admin or moderator
    refreshRoles,    // () => Promise<void> - refresh after role change
  } = useSupabase()

  if (!hasPermission('analytics:read')) {
    return <Text>No access</Text>
  }

  return <AnalyticsDashboard />
}
```

### Admin Route Protection (`apps/next/proxy.ts`)

The Next.js proxy protects `/admin/*` routes server-side:
- Checks for admin OR moderator role via `supabase.rpc('user_has_role')`
- Unauthorized users see 404 page (rewrite, not redirect)
- Unauthenticated users redirected to `/login`

### Adding New Permissions

1. Add to `003_rbac_schema.sql` INSERT statement
2. Add type to `packages/api/src/utils/rbac.ts` `PermissionName`
3. Add type to `packages/app/provider/SupabaseProvider.tsx` `PermissionName`
4. Assign to roles in `role_permissions` table

## HTTP Client (Axios)

**IMPORTANT**: Always use **axios** for HTTP requests, not fetch.

```typescript
import axios from 'axios'

// Example GET request
const response = await axios.get('/api/endpoint')

// Example POST request
const response = await axios.post('/api/endpoint', {
  data: 'value'
})

// With headers
const response = await axios.get('/api/endpoint', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
})
```

Axios is installed in both `apps/next` and `apps/expo` for consistent HTTP client usage across platforms.

## Common Patterns

1. **Creating Features**: Organize by feature in `packages/app/features/`, not by screen
2. **UI Components**: Create reusable components in `packages/ui` following Tamagui design system guide
3. **Providers**: Platform-specific providers in `packages/app/provider/` (e.g., `NextTamaguiProvider.tsx` for web)
4. **Navigation**: Use Solito's `Link` component for cross-platform routing
5. **Styling**: Prefer Tamagui components and styling props over raw CSS/StyleSheet
6. **API Calls**: **ALWAYS use axios** for HTTP requests, never use fetch
7. **Authentication**: Access user via `useSupabase()` hook, check `user` and `session` state
8. **Type Safety**: Use tRPC for type-safe API endpoints when needed, but prefer axios for REST calls

## WearOn Virtual Try-On Implementation

### Overview
WearOn is a virtual try-on platform where users upload photos and select outfits to see AI-generated try-on results.

### Architecture

**Backend Services** (`packages/api/src/`):
- **OpenAI Image Service** (`services/openai-image.ts`): GPT Image 1.5 API integration with image resize for cost optimization, moderation error handling
- **Queue System** (`services/queue.ts`): BullMQ + Redis job queue with 300 requests/minute rate limiting
- **Storage Cleanup** (`services/storage-cleanup.ts`): Automatically deletes files older than 6 hours for privacy
- **Generation Worker** (`workers/generation.worker.ts`): Background processor with startup cleanup, moderation handling, no retries for failed jobs

### Database Schema

**Tables** (see `supabase/migrations/`):
- `users`: Extended user profiles (gender, age)
- `user_credits`: Credit balance tracking (10 free credits on signup)
- `credit_transactions`: Audit trail for all credit operations
- `generation_sessions`: Try-on history with status tracking
- `analytics_events`: Platform usage metrics

**Functions**:
- `handle_new_user()`: Trigger that auto-creates profile + grants 10 credits
- `deduct_credits()`: Atomic credit deduction with transaction logging
- `refund_credits()`: Refund credits on generation failure

### API Endpoints (tRPC)

**Credits Router** (`routers/credits.ts`):
- `getBalance`: Returns user's current credit balance
- `getTransactions`: Paginated transaction history

**Generation Router** (`routers/generation.ts`):
- `create`: Validates credits, deducts 1 credit, queues generation job
- `getById`: Fetch session details with job status
- `getHistory`: Paginated history with optional status filter
- `getStats`: User generation statistics

### Generation Pipeline

1. User uploads images via presigned URLs → Supabase Storage (`uploads/` folder)
2. Frontend calls `storage.getDownloadUrls()` to get signed download URLs
3. Frontend calls `generation.create()` with download URLs → Deducts 1 credit immediately
4. Job added to BullMQ queue → Returns session_id
5. Frontend subscribes to Supabase Realtime for status updates
6. **Background Worker**:
   - Downloads images from Supabase Storage
   - Resizes images to max 1024px for cost optimization (~765 tokens each)
   - Sends images directly to OpenAI GPT Image 1.5 `/images/edits` endpoint
   - Handles base64 response (GPT Image always returns base64, no URL option)
   - Uploads generated image to Supabase Storage (`generated/` folder)
   - Creates signed URL, saves to generation_sessions
   - Updates status → Triggers Realtime notification
7. Frontend receives update instantly via WebSocket

### Worker Behavior

- **Startup Cleanup**: Clears all pending jobs on restart, refunds credits, marks sessions as failed
- **No Retries**: Failed jobs return immediately (only rate limit errors retry)
- **Moderation Handling**: OpenAI safety filter blocks show user-friendly message
- **Autorun Disabled**: Worker starts paused until cleanup completes

### Privacy & Cleanup

- **6-hour expiry**: All images deleted after 6 hours
- **Vercel Cron**: Runs every 6 hours (`/api/cron/cleanup`)
- **Database**: Only stores metadata with URLs (which expire)
- **No long-term storage**: Generated images saved only to user's device

### Status Updates

**Primary**: Supabase Realtime (WebSocket)
- Mobile app subscribes to `generation_sessions` table updates
- Instant notifications when status changes

**Fallback**: Polling every 2 seconds
- Timeout after 10 seconds if no Realtime update
- Query `generation.getById()` for status

### Environment Setup

Required environment variables (`.env.local`):
- `OPENAI_API_KEY`: OpenAI API key for GPT Image 1.5
- `OPENAI_MAX_RETRIES`: Retry count for OpenAI API (1 for dev, 3 for production)
- `REDIS_URL`: Upstash Redis connection string
- `SUPABASE_SERVICE_ROLE_KEY`: For worker operations
- `CRON_SECRET`: Security for Vercel Cron endpoint

### Development Workflow

**Terminal 1**: Next.js backend + frontend
```bash
yarn web
```

**Terminal 2**: Background worker
```bash
cd packages/api
yarn worker
```

### Presigned URL Upload Flow

The upload uses a two-step process to avoid "Object not found" errors:

1. **Get Upload URLs**: `storage.getUploadUrls()` returns presigned URLs + paths
2. **Upload Files**: Client uploads directly to Supabase Storage using presigned URLs
3. **Get Download URLs**: `storage.getDownloadUrls()` creates signed download URLs AFTER upload completes
4. **Pass to Generation**: Download URLs are passed to `generation.create()`

This split is required because Supabase validates file existence when creating signed URLs.

### Error Handling

**Moderation Errors**: OpenAI safety filter blocks return user-friendly message:
- "Your image was flagged by the safety filter. Please use different images that comply with content guidelines."
- Credits are refunded, session marked as failed
- Tracked in analytics as `generation_moderation_blocked` event

**Rate Limits (429)**: Only error type that retries via BullMQ backoff

**Other Errors**: Return immediately without retry, refund credits, mark session failed

### Testing

1. Sign up → Check you received 10 free credits
2. Upload images via presigned URLs
3. Call `generation.create()` with download URLs
4. Worker should process job and update session
5. Check Realtime updates arrive in frontend

### Documentation

- [QUICKSTART.md](../QUICKSTART.md): 5-minute setup guide
- [SETUP.md](../SETUP.md): Complete installation guide
- [supabase/README.md](../supabase/README.md): Database setup details
- [docs/RBAC.md](../docs/RBAC.md): Role-based access control implementation
