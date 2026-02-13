# Story 1.4: Python Worker Generation Pipeline & CI/CD (wearon-worker)

Status: done

## Story

As a **platform operator**,
I want **the Python worker to consume generation tasks from Redis, process them via OpenAI, and deploy automatically via CI/CD**,
so that **both B2B and B2C generation requests are processed through a unified pipeline with reliable deployments**.

## Acceptance Criteria

1. **Given** the Redis consumer in `worker/consumer.py`, **When** a JSON task is pushed to `wearon:tasks:generation` via LPUSH from Next.js, **Then** the consumer reads it via BRPOP, validates with Pydantic `GenerationTask` model, and dispatches to Celery for processing.

2. **Given** the Celery task in `worker/tasks.py`, **When** a generation task is processed, **Then** images are downloaded and resized to 1024px, sent to OpenAI GPT Image 1.5, result uploaded to Supabase Storage with signed URL, and session updated to `completed`. On failure: credits refunded, session marked `failed`.

3. **Given** a 429 rate limit error from OpenAI, **When** the task retries, **Then** credits are NOT refunded until the final failure (prevents double-spend). Session is set back to `queued` during retry.

4. **Given** the worker startup sequence in `main.py`, **When** the worker starts, **Then** stuck sessions (queued/processing) from previous runs are cleaned up with credit refunds, Celery subprocess is started, Redis consumer thread is started, and FastAPI server binds on port 8000.

5. **Given** the GitHub Actions workflow in `.github/workflows/ci-cd.yml`, **When** a PR targets main, **Then** the `test` job runs pytest and validates the Docker build. **When** code is pushed to main, **Then** the `deploy` job builds and pushes the Docker image to GHCR and deploys to VPS via SSH.

6. **Given** the Docker multi-stage build in `Dockerfile`, **When** the image is built, **Then** it produces a minimal runtime image with only production dependencies and system libs (libgl1, libglib2.0-0 for MediaPipe). A `.dockerignore` excludes `.git`, tests, `.env`, and docs.

## Tasks / Subtasks

- [x] Task 1: Project config and dependencies (AC: #4)
  - [x] 1.1 Update `.gitignore` with standard Python patterns
  - [x] 1.2 Update `requirements.txt` with celery, redis, pydantic-settings, supabase, openai, Pillow, mediapipe, structlog, httpx
  - [x] 1.3 Update `pyproject.toml` with project metadata, pytest config, mypy settings
  - [x] 1.4 Create `.env.example` with all required env vars

- [x] Task 2: Config module (AC: #4)
  - [x] 2.1 Create `config/settings.py` — Pydantic Settings with REDIS_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY, OPENAI_MAX_RETRIES, WORKER_CONCURRENCY
  - [x] 2.2 Create `config/logging_config.py` — structlog JSON formatter with ISO timestamps

- [x] Task 3: Pydantic models (AC: #1)
  - [x] 3.1 Create `models/generation.py` — SessionStatus Literal, SessionUpdate model
  - [x] 3.2 Create `models/task_payload.py` — GenerationTask matching Redis queue contract from `packages/api/src/types/queue.ts`
  - [x] 3.3 Update `models/__init__.py` with new exports

- [x] Task 4: Services (AC: #2)
  - [x] 4.1 Create `services/openai_client.py` — OpenAI GPT Image 1.5 via httpx with exponential backoff retries, moderation error handling, base64 decode
  - [x] 4.2 Create `services/supabase_client.py` — lazy singleton supabase-py client with service role key
  - [x] 4.3 Create `services/image_processor.py` — download with content-type/size validation, SSRF protection (no redirects), resize to 1024px JPEG

- [x] Task 5: Worker module (AC: #1, #2, #3)
  - [x] 5.1 Create `worker/celery_app.py` — Celery config with acks_late, 300s time limit, 300/m OpenAI rate limit, no result backend
  - [x] 5.2 Create `worker/consumer.py` — BRPOP loop with Pydantic validation, 5s backoff on errors
  - [x] 5.3 Create `worker/tasks.py` — process_generation task: download → resize → OpenAI → upload → update session. Credit refund on failure, retry-before-refund on 429
  - [x] 5.4 Create `worker/startup.py` — cleanup stuck sessions (queued/processing) with credit refunds

- [x] Task 6: Main entrypoint (AC: #4)
  - [x] 6.1 Rewrite `main.py` — startup cleanup → Celery subprocess → consumer daemon thread → FastAPI server (blocks main thread). Graceful shutdown terminates Celery.

- [x] Task 7: Docker & deployment (AC: #6)
  - [x] 7.1 Create `Dockerfile` — multi-stage build (builder installs deps, runtime copies /install + source)
  - [x] 7.2 Create `docker-compose.yml` — Redis 7-alpine with password auth + worker service
  - [x] 7.3 Update `Makefile` — dev, up, down, logs, test, build commands
  - [x] 7.4 Create `.dockerignore` — exclude .git, tests, .env, docs, IDE files

- [x] Task 8: CI/CD pipeline (AC: #5)
  - [x] 8.1 Create `.github/workflows/ci-cd.yml` — test job (Python 3.12, system deps, pytest, Docker build validation) + deploy job (GHCR push with BuildKit cache, SSH deploy to VPS)
  - [x] 8.2 Set dummy env vars in test job for pydantic-settings import (tests mock all external services)

- [x] Task 9: Tests (AC: #1-3)
  - [x] 9.1 Create `tests/test_consumer.py` — valid task dispatch, invalid JSON skip
  - [x] 9.2 Create `tests/test_task_payload.py` — b2b/b2c validation, invalid channel rejection, default version
  - [x] 9.3 Create `tests/test_tasks.py` — payload roundtrip serialization

- [x] Task 10: Code review fixes (AC: #2, #3)
  - [x] 10.1 Add content-type validation and size limit to `services/image_processor.py`
  - [x] 10.2 Move event loop close to finally block in `worker/tasks.py`
  - [x] 10.3 Add 5s backoff on consumer errors in `worker/consumer.py`
  - [x] 10.4 Remove dead `_shutdown` event from `main.py`
  - [x] 10.5 Fix retry-before-refund on 429 in `worker/tasks.py`
  - [x] 10.6 Add exponential backoff to OpenAI retries in `services/openai_client.py`
  - [x] 10.7 Increase Celery task_time_limit from 60s to 300s
  - [x] 10.8 Create `.dockerignore`

## Dev Notes

### Architecture Requirements

- **ADR-4: Shared Generation Pipeline** — Single Python worker for B2B and B2C. Simple Redis queue (LPUSH/BRPOP). Celery only on Python side. [Source: architecture.md#ADR-4]
- **FP-1: Size Rec on Python Worker** — Worker runs FastAPI + Celery + Redis consumer in single process. [Source: architecture.md#FP-1]
- **AR11: Correlation ID** — `request_id` field in task payload, included in all log lines. [Source: architecture.md#Correlation ID]
- **CI/CD** — Docker build + push via GitHub Action on push to main, SSH deploy to VPS. [Source: architecture.md#CI/CD]

### Cross-Language Queue Contract

Queue key: `wearon:tasks:generation`

Python worker validates with `GenerationTask` Pydantic model. Matches TypeScript `GenerationTaskPayload` from `packages/api/src/types/queue.ts` (Story 1.3).

### Security Measures Applied

- Image downloads: content-type validation (must be `image/*`), 10MB size limit, redirects disabled (SSRF protection)
- OpenAI retries: exponential backoff (2^attempt seconds) prevents API hammering
- Consumer errors: 5s sleep prevents tight-loop spam on Redis failures
- Credit integrity: retry-before-refund on 429 prevents double-spend
- Docker: `.dockerignore` prevents `.env` and `.git` from leaking into image

### CI/CD Secrets

| Secret | Location | Purpose |
|--------|----------|---------|
| `VPS_HOST` | GitHub Secrets | SSH deploy target |
| `VPS_USERNAME` | GitHub Secrets | SSH user |
| `VPS_SSH_KEY` | GitHub Secrets | SSH private key |
| `GITHUB_TOKEN` | Automatic | GHCR auth |
| App secrets | VPS `/opt/wearon/.env` | Runtime config (never in GitHub) |

### References

- [Source: architecture.md#ADR-4] — Shared generation pipeline
- [Source: architecture.md#FP-1] — Size rec on Python worker
- [Source: architecture.md#CI/CD] — Deployment strategy
- [Source: architecture.md#Resilience] — Error handling patterns
- [Source: architecture.md#Repo 3: wearon-worker] — Project structure

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- All tests pass (consumer, task_payload, tasks, size_rec_app, mediapipe_service, size_calculator)
- Code review completed with 7 fixes applied (4 HIGH, 2 MEDIUM, 1 LOW)
- Commits: `9dfafc8` through `80432fb` (11 progressive commits) + `d49d04f` (code review fixes)

### Completion Notes List

- Built complete Python worker: Redis BRPOP consumer, Celery task processor, OpenAI client, Supabase client, image processor
- Config module with pydantic-settings and structlog JSON logging
- Pydantic models matching cross-language Redis queue contract
- Multi-stage Docker build with docker-compose for local dev
- GitHub Actions CI/CD: test on PR (pytest + Docker build), deploy on main (GHCR + SSH)
- Adversarial code review applied 7 fixes: event loop leak, consumer backoff, credit double-spend, OpenAI retry backoff, task time limit, image validation, .dockerignore

### Change Log

| Change | Reason |
|--------|--------|
| 2026-02-13 implementation | Built complete worker generation pipeline: config, models, services, worker, main, Docker, CI/CD |
| 2026-02-13 code review | Adversarial review found 10 issues (4 HIGH, 3 MEDIUM, 3 LOW). Fixed 7, skipped 1 infra-level (zero-downtime deploy), 2 LOW (services __init__ exports, no action needed) |

### File List

New files:
- wearon-worker/.github/workflows/ci-cd.yml
- wearon-worker/.dockerignore
- wearon-worker/.env.example
- wearon-worker/Dockerfile
- wearon-worker/docker-compose.yml
- wearon-worker/config/__init__.py
- wearon-worker/config/settings.py
- wearon-worker/config/logging_config.py
- wearon-worker/models/generation.py
- wearon-worker/models/task_payload.py
- wearon-worker/services/openai_client.py
- wearon-worker/services/supabase_client.py
- wearon-worker/services/image_processor.py
- wearon-worker/worker/__init__.py
- wearon-worker/worker/celery_app.py
- wearon-worker/worker/consumer.py
- wearon-worker/worker/tasks.py
- wearon-worker/worker/startup.py
- wearon-worker/tests/test_consumer.py
- wearon-worker/tests/test_task_payload.py
- wearon-worker/tests/test_tasks.py

Modified files:
- wearon-worker/main.py (rewritten as unified entrypoint)
- wearon-worker/requirements.txt (expanded dependencies)
- wearon-worker/pyproject.toml (updated metadata and config)
- wearon-worker/.gitignore (expanded patterns)
- wearon-worker/Makefile (docker-based commands)
- wearon-worker/README.md (rewritten with architecture and deploy guide)
- wearon-worker/models/__init__.py (new exports)
- wearon-worker/services/__init__.py (minor cleanup)
- wearon-worker/size_rec/image_processing.py (security fixes: content-type, size limit, no redirects)
