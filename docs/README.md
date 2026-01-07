# WearOn Documentation

Welcome to the WearOn virtual try-on platform documentation.

## Quick Links

- **[Quick Start Guide](QUICKSTART.md)** - Get up and running in 5 minutes
- **[Setup Guide](SETUP.md)** - Comprehensive installation and deployment guide
- **[Architecture Plan](architecture-plan.md)** - System design and implementation plan
- **[Credits & Analytics](CREDITS_AND_ANALYTICS.md)** - Credit system and analytics documentation
- **[Supabase Setup](supabase-setup.md)** - Database migration and configuration

## Getting Started

New to WearOn? Start here:

1. Read the [Architecture Plan](architecture-plan.md) to understand the system design
2. Follow the [Quick Start Guide](QUICKSTART.md) to set up your development environment
3. Review [Credits & Analytics](CREDITS_AND_ANALYTICS.md) to understand the core business logic

## Documentation Overview

### Architecture Plan
Comprehensive system design document covering:
- Product overview and AI model details (Grok Image Generation v2)
- Architecture decisions and research findings
- Database schema and storage structure
- System architecture and request flow
- Implementation phases and critical details

### Quick Start Guide
5-minute setup guide with:
- Prerequisites checklist
- Step-by-step setup instructions
- Verification steps
- Common troubleshooting

### Setup Guide
Complete installation and deployment guide covering:
- Environment configuration
- Database setup with Supabase
- Redis configuration (BullMQ)
- Worker deployment
- Vercel deployment
- Mobile app setup (Expo)

### Credits & Analytics
Detailed documentation of:
- Credit system (signup bonus, deduction, refunds)
- Database tables and functions
- API endpoints for credits and analytics
- Monitoring and metrics
- SQL queries for deep analytics

### Supabase Setup
Database-specific instructions:
- Migration files and execution order
- Database functions (triggers, RPC)
- Row Level Security policies
- Storage bucket configuration
- Testing procedures

## Tech Stack

- **Frontend**: Expo (React Native) + Next.js + Tamagui
- **Backend**: Next.js API Routes + tRPC
- **Database**: Supabase (PostgreSQL)
- **Storage**: Supabase Storage
- **Queue**: BullMQ + Redis (Upstash)
- **AI Model**: Grok Image Generation v2 (x.ai)
- **Image Processing**: Sharp
- **Deployment**: Vercel (web) + EAS Build (mobile)

## Need Help?

- Check [Common Issues](QUICKSTART.md#common-issues) in the Quick Start Guide
- Review [Troubleshooting](SETUP.md#troubleshooting) in the Setup Guide
- See [Monitoring & Alerts](CREDITS_AND_ANALYTICS.md#monitoring--alerts) for system health
