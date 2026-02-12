# Story 5.4: MediaPipe Pose Estimation Service (wearon-worker)

Status: ready-for-dev

## Story

As a **platform operator**,
I want **the Python worker to estimate body measurements from a single photo**,
so that **size recommendations are based on accurate AI pose estimation**.

## Acceptance Criteria

1. **Given** the FastAPI endpoint `POST /estimate-body` on the Python worker, **When** an image URL and height_cm are provided, **Then** MediaPipe BlazePose extracts 33 3D body landmarks **And** measurements are estimated: shoulder width, chest, waist, hip, body type **And** the response includes `recommended_size`, `measurements`, `confidence`, and `body_type`.

2. **Given** the MediaPipe model, **When** the worker starts, **Then** the model loads once and stays warm in memory for subsequent requests.

## Tasks / Subtasks

- [ ] Task 1: FastAPI size rec endpoint (AC: #1)
  - [ ] 1.1 Create `size_rec/app.py` with FastAPI app and `POST /estimate-body` endpoint.
  - [ ] 1.2 Define Pydantic request model: `image_url` (str, required), `height_cm` (float, required).
  - [ ] 1.3 Define Pydantic response model: `recommended_size` (str), `measurements` (object with `chest_cm`, `waist_cm`, `hip_cm`, `shoulder_cm`), `confidence` (float 0-1), `body_type` (str), `size_range` (object with `lower`, `upper`).
  - [ ] 1.4 Add `/health` endpoint that checks MediaPipe model loaded + Redis connection.

- [ ] Task 2: MediaPipe pose estimation (AC: #1, #2)
  - [ ] 2.1 Create `size_rec/mediapipe_service.py` — singleton class that loads BlazePose model on init.
  - [ ] 2.2 Load model once on startup, keep warm in memory (FP-1).
  - [ ] 2.3 Accept image (downloaded via URL), extract 33 3D body landmarks.
  - [ ] 2.4 Return raw landmark coordinates for size calculation.

- [ ] Task 3: Size calculation logic (AC: #1)
  - [ ] 3.1 Create `size_rec/size_calculator.py` — converts landmarks + height_cm to body measurements.
  - [ ] 3.2 Estimate shoulder width, chest, waist, hip circumferences from landmark distances + height scaling.
  - [ ] 3.3 Determine body type from measurement ratios (e.g., `athletic`, `slim`, `average`, `broad`).
  - [ ] 3.4 Map measurements to standard size (XS-XXL) with confidence score.
  - [ ] 3.5 Return size range (lower/upper) when confidence is below 80%.

- [ ] Task 4: Image download and processing (AC: #1)
  - [ ] 4.1 Download image from URL using httpx with 5s timeout.
  - [ ] 4.2 Resize image using Pillow to max 512px for faster MediaPipe processing.
  - [ ] 4.3 Handle invalid image URLs and corrupted images gracefully.

- [ ] Task 5: Write tests (AC: #1-2)
  - [ ] 5.1 Test /estimate-body returns valid measurements for a test image.
  - [ ] 5.2 Test model loads once on startup (singleton pattern).
  - [ ] 5.3 Test size calculation maps measurements to correct size ranges.
  - [ ] 5.4 Test /health endpoint returns correct status.
  - [ ] 5.5 Test image download timeout returns error.

## Dev Notes

- **This story is implemented in the wearon-worker repo.**
- **FP-1**: MediaPipe on persistent Python worker, model loaded once on startup. [Source: architecture.md#FP-1]
- **AR4**: MediaPipe for size rec — 33 3D body landmarks, FastAPI HTTP endpoint. [Source: architecture.md#AR4]
- **NFR2**: Size rec response <1s. Model must be pre-loaded (warm) to meet this.

### Technology Stack

- **MediaPipe**: `mediapipe` Python package — BlazePose for 33 3D landmarks.
- **FastAPI**: HTTP server for synchronous size rec requests.
- **Pillow**: Image download and resize (512px for faster processing).
- **Pydantic**: Strict models for request/response validation.
- **structlog**: JSON logging with `request_id`.

### Worker Architecture

- Worker runs two interfaces simultaneously:
  1. **FastAPI HTTP server** — for synchronous size rec requests (<1s)
  2. **Redis consumer + Celery** — for async generation jobs
- Both share the same process, same Supabase connection, same Redis connection.

### References

- [Source: architecture.md#FP-1] — Size Rec on Python Worker
- [Source: architecture.md#AR4] — MediaPipe for size rec
- [Source: architecture.md#Repo 3: wearon-worker] — Worker project structure
- [Source: epics.md#Story 5.4] — MediaPipe Pose Estimation Service

## Dev Agent Record

### Agent Model Used

(to be filled by dev agent)

### Debug Log References

### Completion Notes List

### File List
