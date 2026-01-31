# WearOn - Project Documentation Index

> **AI-Optimized Reference** - Use this index as the entry point for AI-assisted development.

## Project Overview

| Attribute | Value |
|-----------|-------|
| **Type** | Monorepo (Yarn Workspaces + Turbo) |
| **Parts** | 6 (mobile, web, backend, 3 libraries) |
| **Primary Language** | TypeScript |
| **Architecture** | Universal App (Web + Mobile) |

### Quick Reference

| Part | Type | Path | Tech Stack |
|------|------|------|------------|
| **expo-app** | mobile | `apps/expo/` | Expo 53, React Native, expo-router |
| **next-app** | web | `apps/next/` | Next.js 16, React 19, tRPC client |
| **api** | backend | `packages/api/` | tRPC 11, Supabase, BullMQ, OpenAI |
| **app** | library | `packages/app/` | Shared features, Solito, providers |
| **ui** | library | `packages/ui/` | Tamagui components |
| **config** | library | `packages/config/` | Tamagui config |

---

## Generated Documentation

### Core Documentation

- [Project Overview](./project-overview.md) - Executive summary and tech stack
- [Architecture](./architecture-api.md) - System design and patterns
- [Source Tree](./source-tree.md) - Directory structure with annotations
- [Development Guide](./development-guide.md) - Setup and workflow

### Technical Reference

- [API Contracts](./api-contracts.md) - tRPC endpoint documentation
- [Data Models](./data-models.md) - Database schema and functions

---

## Existing Documentation (May Need Updates)

> ⚠️ Some existing docs reference **Grok API** - actual implementation uses **OpenAI GPT Image 1.5**

| Document | Status | Notes |
|----------|--------|-------|
| [CLAUDE.md](../../CLAUDE.md) | ✅ Current | AI assistant context |
| [SETUP.md](../SETUP.md) | ✅ Current | Installation guide |
| [QUICKSTART.md](../QUICKSTART.md) | ✅ Current | Quick setup |
| [RBAC.md](../RBAC.md) | ✅ Current | Role-based access |
| [architecture-plan.md](../architecture-plan.md) | ⚠️ Outdated | References Grok, not OpenAI |
| [supabase-setup.md](../supabase-setup.md) | ✅ Current | Database setup |
| [google-oauth-setup.md](../google-oauth-setup.md) | ✅ Current | OAuth config |

---

## Getting Started

### For AI Assistants

When working on this codebase:

1. **Read this index** for project structure
2. **Check CLAUDE.md** for development conventions
3. **Reference API Contracts** for endpoint modifications
4. **Reference Data Models** for database changes

### For Developers

```bash
# Install dependencies
yarn

# Start web app + API
yarn web

# Start worker (required for generation)
cd packages/api && yarn worker

# Start mobile app
yarn native
```

---

## Key Integration Points

### Generation Flow
1. `storage.getUploadUrls` → Upload images
2. `storage.getDownloadUrls` → Get signed URLs
3. `generation.create` → Queue job (deducts credit)
4. Subscribe to Supabase Realtime for updates
5. Worker processes via OpenAI GPT Image 1.5

### Authentication
- Supabase Auth (Email/Password + Google OAuth)
- RBAC via `roles.ts` router
- Protected routes via `proxy.ts`

---

## Documentation Updates Needed

| File | Issue | Action |
|------|-------|--------|
| `docs/architecture-plan.md` | References Grok API | Update to OpenAI GPT Image 1.5 |
| Sharp references | In architecture doc | Clarify: used for image compression |

---

*Generated: 2026-02-01 | Scan Level: Deep | Mode: initial_scan*
