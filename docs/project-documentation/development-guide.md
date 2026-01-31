# WearOn - Development Guide

## Prerequisites

- **Node.js**: v22+ (required by `engines` field)
- **Yarn**: 4.5.0 (enforced by `packageManager`)
- **Redis**: For BullMQ queue (Upstash recommended)
- **Supabase**: Project with database configured

## Initial Setup

```bash
# Clone and install
git clone <repo-url>
cd wearon
yarn                    # Installs all dependencies + runs postinstall build
```

## Environment Variables

### apps/next/.env.local

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx

# API
NEXT_PUBLIC_API_URL=http://localhost:3000/api/trpc
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# OpenAI (for image generation)
OPENAI_API_KEY=sk-xxx
OPENAI_MAX_RETRIES=3

# Redis (for BullMQ)
REDIS_URL=rediss://xxx@xxx.upstash.io:6379

# Cron security
CRON_SECRET=your-random-secret
```

### apps/expo/.env

```env
EXPO_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=xxx
EXPO_PUBLIC_API_URL=http://YOUR_LOCAL_IP:3000/api/trpc
```

## Running the Application

### Web Development

```bash
# Terminal 1: Next.js app
yarn web                # Builds packages + starts dev server at localhost:3000

# Terminal 2: Background worker (required for generation)
cd packages/api
yarn worker             # Starts BullMQ worker for image generation
```

### Mobile Development

```bash
# Start Expo dev server
yarn native

# Or run on specific platform
yarn ios
yarn android
```

**Note**: Mobile requires development build for native features:
```bash
yarn native:prebuild    # Generate native projects
eas build --profile development --platform ios
```

## Build Commands

| Command | Description |
|---------|-------------|
| `yarn build` | Build all workspace packages |
| `yarn web:prod` | Production build for Next.js |
| `yarn web:prod:serve` | Serve production build on port 8151 |
| `yarn test` | Run Vitest tests |
| `yarn test:watch` | Tests in watch mode |

## Linting & Formatting

Uses **Biome** (not ESLint/Prettier):

```bash
cd apps/next && yarn lint    # Lint Next.js app
cd apps/expo && yarn lint    # Lint Expo app
```

**Key Biome rules:**
- 2-space indentation
- Single quotes
- No console.log (error)
- Use `import type` for type imports

## Database Migrations

```bash
# Apply migrations to Supabase
cd supabase
supabase db push
```

## Testing

```bash
yarn test              # Run all tests
yarn test:watch        # Watch mode
```

E2E tests with Playwright (in apps/next):
```bash
cd apps/next
npx playwright test
```

## Common Development Tasks

### Adding a New API Endpoint

1. Create router in `packages/api/src/routers/yourRouter.ts`
2. Add to `packages/api/src/routers/_app.ts`
3. Use `publicProcedure` or `protectedProcedure`
4. Define input with Zod schema
5. Client gets type-safe access automatically

### Adding a New Feature

1. Create feature folder in `packages/app/features/yourFeature/`
2. Add screen components
3. Import in platform-specific app (next or expo)

### Adding New Dependencies

**Shared JS packages:**
```bash
cd packages/app
yarn add <package>
cd ../..
yarn
```

**Native packages:**
```bash
cd apps/expo
yarn add <package>
cd ../..
yarn
# Then rebuild development build
```

**Important**: Use exact same versions in both packages and apps.

## Troubleshooting

### "Cannot use import statement outside a module"
Add package to `transpilePackages` in `apps/next/next.config.js`

### Redis connection errors
Check `REDIS_URL` format. Upstash requires `rediss://` (with TLS).

### Worker not processing jobs
1. Check Redis connection
2. Verify `OPENAI_API_KEY` is set
3. Check worker logs: `cd packages/api && yarn worker`

### Mobile app not connecting to API
Use your machine's local IP (not localhost) in `EXPO_PUBLIC_API_URL`

---

*Generated: 2026-02-01 | WearOn Development Guide*
