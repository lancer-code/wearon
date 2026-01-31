# WearOn - Project Overview

## Executive Summary

WearOn is a **virtual try-on platform** that enables users to upload photos of themselves and see AI-generated images of themselves wearing selected outfits and accessories. The platform targets both **B2C** (mobile app users) and **B2B** (e-commerce store integrations via plugins).

## Project Classification

| Attribute | Value |
|-----------|-------|
| **Project Name** | WearOn |
| **Repository Type** | Monorepo (Yarn Workspaces + Turbo) |
| **Primary Language** | TypeScript |
| **Architecture** | Universal App (Web + Mobile) with shared API |

## Technology Stack

### Frontend

| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js | 16.1.1 | Web application |
| Expo SDK | 53 | Mobile app (iOS/Android) |
| React | 19.0.0 | UI framework |
| Tamagui | 1.143.1 | Universal UI components |
| Solito | 5.0.0 | Cross-platform navigation |

### Backend

| Technology | Version | Purpose |
|------------|---------|---------|
| tRPC | 11.0.0 | Type-safe API layer |
| Supabase | - | Database, Auth, Storage, Realtime |
| BullMQ | 5.66.4 | Job queue for generation |
| Redis (Upstash) | - | Queue backend |
| OpenAI GPT Image 1.5 | - | AI image generation |

### Infrastructure

| Technology | Purpose |
|------------|---------|
| Vercel | Web hosting + Cron jobs |
| Supabase | PostgreSQL database |
| Upstash | Redis for BullMQ |
| EAS Build | Native app builds |

## Monorepo Structure

```
wearon/
├── apps/
│   ├── expo/          # Mobile app (iOS/Android)
│   └── next/          # Web app + API routes
├── packages/
│   ├── api/           # tRPC server + services
│   ├── app/           # Shared features + logic
│   ├── ui/            # Tamagui components
│   └── config/        # Shared configuration
├── supabase/          # Database migrations
└── docs/              # Documentation
```

## Core Features

### Implemented (B2C)
- User authentication (Email/Password + Google OAuth)
- Credit-based generation system (10 free credits on signup)
- Virtual try-on generation via OpenAI
- Generation history with status tracking
- Admin panel with RBAC (admin/moderator/user roles)
- Realtime status updates via Supabase

### Planned (B2B)
- Public API for third-party integrations
- WordPress plugin
- Shopify plugin
- Bulk credit purchasing for businesses

## Key Differentiator

Unlike competitors, WearOn supports **accessories** (hats, watches, necklaces) in addition to clothing, making it unique in the virtual try-on market.

## Documentation Index

- [Architecture](./architecture-api.md) - System architecture details
- [API Contracts](./api-contracts.md) - tRPC endpoint documentation
- [Data Models](./data-models.md) - Database schema
- [Development Guide](./development-guide.md) - Setup and workflow
- [Source Tree](./source-tree.md) - Directory structure

---

*Generated: 2026-02-01 | WearOn Project Documentation*
