# Phase 4 Video Production — Implementation Checklist

**Last updated:** 2026-03-15  
**Purpose:** Track what is built vs remaining for Phase 4 (video production). Use with `docs/REEL_CREATION_TODO.md` and `docs/specs/PHASE4_*.md`.

---

## Already implemented (do not redo)

- [x] **Video clip generation service** — `backend/src/services/media/video-generation/`: provider abstraction (Kling fal, Runway, image-ken-burns), `generateVideoClip()`, R2 upload, cost ledger.
- [x] **Assets API (partial)** — GET `/api/assets`, PATCH `/api/assets/:id`, DELETE `/api/assets/:id`.
- [x] **Database** — `reel_asset`, `generated_content` (including `videoR2Url`, `thumbnailR2Key`, `generatedMetadata`). Schema ready for Phase 4.

---

## Backend — Prerequisites

- [x] **User file upload** — `POST /api/assets/upload` implemented for video (mp4, mov) and images (jpg, png, webp). Size limits: 100MB video, 10MB image. Server-side mime validation, R2 upload, `generatedContentId` + `shotIndex` + `assetType` supported.
- [ ] **Assembly service** — Remotion (recommended) or FFmpeg backend: sequence clips, overlay voiceover + music (Phase 3 ratio), burn captions, output mp4 to R2. Respect per-shot `useClipAudio` when clip has embedded audio.
- [x] **Render job queue (baseline)** — Redis-backed async video job state implemented (`queued`/`running`/`completed`/`failed`) via `backend/src/services/video/job.service.ts`. Polling works via `/api/video/jobs/:jobId`.

---

## Backend — Video / Reel API

- [x] **Start full reel generation** — `POST /api/video/reel` implemented with `generatedContentId`, optional provider/aspect/duration/prompt. Resolves shots, generates clips, enqueues async processing, returns `202` + `jobId`.
- [x] **Regenerate single shot** — `POST /api/video/shots/regenerate` implemented.
- [x] **Request assembly** — `POST /api/video/assemble` implemented.
- [x] **Job status** — `GET /api/video/jobs/:jobId` implemented.
- [x] **Job retry** — `POST /api/video/jobs/:jobId/retry` implemented.
- [ ] **Shot audio preference** — Ensure `PATCH /api/assets/:id` supports `metadata.useClipAudio` (already have PATCH; confirm contract and that assembly reads it).

---

## Backend — Data & behavior

- [x] **Shot list source (baseline)** — Script timestamp parsing added for generated scripts with fallback to prompt/hook; stored in `generatedMetadata.phase4.shots`.
- [x] **Clip audio detection (baseline)** — Upload path sets `hasEmbeddedAudio` true for uploaded video clips; AI clips default false.
- [ ] **Caption generation** — Whisper (or equivalent) during assembly: voiceover → word-level timings → burn-in. CapCut-style variable caption sizes: research and implement placement/sizing (see REEL_CREATION_TODO.md).

---

## Frontend — Generate & progress

- [x] **Generate Reel CTA (baseline)** — Added button in draft detail that calls `POST /api/video/reel` and polls `GET /api/video/jobs/:jobId`.
- [x] **Progress UI (baseline)** — Added basic queued/running/completed state surface in draft detail with i18n keys.
- [ ] **Error & retry** — Retryable failure: inline banner + Retry. Terminal: blocking modal + “Back to Draft”. Preserve existing clips on failure.

---

## Frontend — Storyboard

- [ ] **Storyboard panel** — Shot list (cards) after generation. Each card: index, thumbnail, duration, description, source badge (AI / Upload). Actions: Preview, Regenerate, Upload replacement.
- [ ] **Use clip audio toggle** — When `hasEmbeddedAudio`, show “Use this clip’s audio” vs “Voiceover only” in shot inspector. Persist via `PATCH /api/assets/:id` (or content metadata).
- [ ] **Re-assemble CTA** — Enable when storyboard is dirty; call `POST /api/video/assemble`, then poll job status.

---

## Frontend — Final preview & export

- [ ] **Final video player** — When job completed, show inline player with signed URL. Download button. Optional “Back to Storyboard” / “Create new version.”
- [ ] **Reel workspace shell** — Single route/shell with regions: Generate (progress), Storyboard, Final preview. See `docs/specs/PHASE4_UI_LAYOUT_BLUEPRINT.md` and `PHASE4_UI_IMPLEMENTATION_HANDOFF.md`.

---

## Quality & release

- [ ] **Tests** — Contract/integration tests for new endpoints; failure and retry paths; upload validation; clip-audio choice. See `docs/specs/PHASE4_TEST_AND_RELEASE_CRITERIA.md`.
- [ ] **Release gates** — All go/no-go criteria in test/release doc passed before marking Phase 4 complete.

---

## References

- Phase 4 roadmap: `docs/REEL_CREATION_TODO.md` (Phase 4 section)
- Specs: `docs/specs/PHASE4_VIDEO_PRODUCTION_MVP.md`, `PHASE4_TECHNICAL_DESIGN.md`, `PHASE4_API_AND_FLOW_CONTRACTS.md`
- UI: `docs/specs/PHASE4_UI_LAYOUT_BLUEPRINT.md`, `PHASE4_UI_STATES_AND_WIREFLOWS.md`, `PHASE4_UI_IMPLEMENTATION_HANDOFF.md`
- Tests & gates: `docs/specs/PHASE4_TEST_AND_RELEASE_CRITERIA.md`
