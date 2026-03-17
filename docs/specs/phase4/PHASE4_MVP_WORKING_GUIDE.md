# Phase 4 MVP Working Guide

This guide explains how to work with the current **Phase 4 Video Production MVP baseline** in ContentAI.

Use this for daily implementation, QA checks, and safe iteration.

---

## 1) What "MVP baseline complete" means

The following are implemented and usable:

- Backend video routes for generation, assembly, status polling, and retry
- Async job lifecycle (`queued`, `running`, `completed`, `failed`)
- Storyboard-level shot actions (regenerate, upload replacement, clip audio toggle)
- Assembly baseline (FFmpeg concat, audio mix, basic caption burn)
- Video workspace shell in frontend (Generate, Storyboard, Final Preview)
- Final preview actions (download, back to storyboard, create new version)

Not part of MVP-complete claim (still enhancement/hardening):

- Whisper word-level caption timing
- CapCut-style caption parity and rich caption controls
- Full endpoint contract/integration test suite and formal release-gate signoff

---

## 2) Primary user flow (happy path)

1. Open Studio and select a generated draft.
2. Go to the `Video` workspace tab.
3. Click `Generate Reel`.
4. Wait for job status to move from queued/running to completed.
5. Review generated shots in Storyboard:
   - Regenerate shot if needed
   - Upload replacement media per shot if needed
   - Toggle clip audio on/off for clips with embedded audio
6. Click `Apply changes & re-assemble` after storyboard edits.
7. Review final preview, then:
   - Download video
   - Or create new version (queue flow)

---

## 3) Key controls and expected behavior

- `Generate Reel`: starts `/api/video/reel`, returns `jobId`, UI polls status
- `Retry`: starts `/api/video/jobs/:jobId/retry` when a job fails
- `Re-assemble`: starts `/api/video/assemble` with caption toggle option
- `Use clip audio`: persists `metadata.useClipAudio` via `/api/assets/:id`
- `Replace shot`: uploads to `/api/assets/upload` with `shotIndex`
- `Regenerate shot`: calls `/api/video/shots/regenerate` for one shot

If an action fails, user should see inline/toast feedback and can retry.

---

## 4) Operational guardrails

- Treat current assembly as **baseline** quality, not final studio-grade output.
- Do not assume caption timings are word-accurate.
- Preserve existing assets on failures; avoid destructive behavior in UI actions.
- Keep using current API contracts and metadata keys (`shotIndex`, `useClipAudio`, `hasEmbeddedAudio`).

---

## 5) How to extend safely

When adding features, prefer this order:

1. Keep existing route contracts backward-compatible.
2. Extend metadata shape in additive ways (no breaking removals).
3. Ensure new UI behavior degrades gracefully when metadata is missing.
4. Update these docs:
   - `docs/PHASE4_IMPLEMENTATION_TODO.md`
   - relevant `docs/specs/PHASE4_*.md` files

---

## 6) Quick manual verification checklist (no test suite required)

- Generate reel starts and returns a job id.
- Job progresses and eventually completes/fails visibly in UI.
- Storyboard shows shot cards and preview.
- Regenerate shot starts a new job and updates output flow.
- Replacement upload updates shot media and enables re-assemble.
- Clip audio toggle changes behavior after re-assemble.
- Final preview shows video, allows download, and create-new-version action works.

---

## 7) Source of truth

- Implementation status: `docs/PHASE4_IMPLEMENTATION_TODO.md`
- Product roadmap context: `docs/REEL_CREATION_TODO.md`
- Technical details/contracts: `docs/specs/PHASE4_TECHNICAL_DESIGN.md`, `docs/specs/PHASE4_API_AND_FLOW_CONTRACTS.md`
