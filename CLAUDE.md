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
- **Sharp**: High-performance image processing (collage stitching)
- **BullMQ + Redis**: Job queue with rate limiting (300 req/min)
- **Grok API**: AI image generation (x.ai)
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

The worker processes generation jobs from the queue, creates collages, calls Grok API, and updates session status via Supabase Realtime.

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
      (auth)/    - Auth route group (login, signup pages)
      api/       - API routes (trpc, auth callback)
      dashboard/ - Protected dashboard page
    proxy.ts     - Route protection (auth redirects)
    utils/supabase/ - Server-side Supabase clients
packages/
  api/           - tRPC server with Supabase integration
    routers/     - API routers (auth, user, storage)
  app/           - Shared application logic and features
    features/    - Feature-based organization (NOT screens/)
      auth/      - Login, signup, Google OAuth components
      dashboard/ - Dashboard screen
    provider/    - Platform-specific and shared providers
    utils/       - Shared utilities (tRPC client, Supabase client)
  ui/            - Custom UI component library (@my/ui)
  config/        - Shared configuration (Tamagui config)
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
- **storage**: File storage (upload, getSignedUrl, delete, listFiles)

**Protected Procedures**: Use `protectedProcedure` for authenticated-only endpoints. Middleware automatically checks for valid user session.

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
- Checks for admin role via `supabase.rpc('user_has_role')`
- Non-admins redirected to `/dashboard?error=unauthorized`

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
- **Image Processing** (`services/image-processor.ts`): Sharp-based collage stitcher that combines multiple images (model, outfit, accessories) into a single 2048x2048 image
- **Queue System** (`services/queue.ts`): BullMQ + Redis job queue with 300 requests/minute rate limiting
- **Grok API Client** (`services/grok.ts`): Integration with x.ai Grok image generation API
- **Storage Cleanup** (`services/storage-cleanup.ts`): Automatically deletes files older than 6 hours for privacy
- **Generation Worker** (`workers/generation.worker.ts`): Background processor that handles the full pipeline

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

1. User uploads images → Supabase Storage
2. Mobile app calls `generation.create()` → Deducts 1 credit
3. Job added to BullMQ queue → Returns session_id
4. Mobile app subscribes to Supabase Realtime for status updates
5. **Background Worker**:
   - Downloads images from Supabase Storage
   - Creates collage using Sharp (high quality, 2048x2048)
   - Uploads collage to Supabase Storage
   - Calls Grok API with collage URL + prompts (generates 1 image)
   - Saves result URL in generation_sessions
   - Updates status → Triggers Realtime notification
6. Mobile app receives update instantly via WebSocket

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
- `GROK_API_KEY`: x.ai API key for image generation
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

### Testing

1. Sign up → Check you received 10 free credits
2. Call `generation.create()` with image URLs
3. Worker should process job and update session
4. Check Realtime updates arrive in mobile app

### Documentation

- [QUICKSTART.md](../QUICKSTART.md): 5-minute setup guide
- [SETUP.md](../SETUP.md): Complete installation guide
- [supabase/README.md](../supabase/README.md): Database setup details
