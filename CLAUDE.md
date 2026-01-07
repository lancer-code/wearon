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
- **Supabase**: Backend as a Service (auth, database, storage)
- **Axios**: HTTP client for all API requests (preferred over fetch)
- **React Query**: Data fetching and caching
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
    app/api/trpc/[trpc]/route.ts - tRPC API endpoint handler
packages/
  api/           - tRPC server with Supabase integration
    routers/     - API routers (auth, user, storage)
  app/           - Shared application logic and features
    features/    - Feature-based organization (NOT screens/)
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
- **Web**: Uses localStorage for session persistence
- **Native**: Uses AsyncStorage for session persistence

Access current user via `useSupabase()` hook from `SupabaseProvider`.

### Environment Variables

**Next.js** (`apps/next/.env`):
```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx  # Server-side only
NEXT_PUBLIC_API_URL=http://localhost:3000/api/trpc
```

**Expo** (`apps/expo/.env`):
```bash
EXPO_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=xxx
EXPO_PUBLIC_API_URL=http://YOUR_LOCAL_IP:3000/api/trpc
```

### Provider Hierarchy

Providers wrap the app in this order (see `packages/app/provider/index.tsx`):
1. **SupabaseProvider** - Auth state management
2. **TRPCProvider** - API client with React Query
3. **TamaguiProvider** - UI styling
4. **ToastProvider** - Toast notifications

### Adding New API Endpoints

1. Create router in `packages/api/src/routers/`
2. Add to `packages/api/src/routers/_app.ts`
3. Use `publicProcedure` or `protectedProcedure`
4. Define input schema with Zod
5. Client automatically gets type-safe access

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
