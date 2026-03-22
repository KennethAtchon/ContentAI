# Editor Studio -- Master Plan

**Last updated:** 2026-03-20
**Status:** Foundation built, major features missing

---

## Current State Assessment

The editor has a real foundation. It is not a placeholder. What exists today:

**Working:**
- Full NLE-style layout (toolbar, media panel, preview, inspector, timeline) at `/studio/editor`
- Four-track model (video, audio, music, text) with typed clips
- `useReducer`-based state management with undo/redo (50-step history)
- `requestAnimationFrame` playback engine driving the playhead
- Stacked `<video>` element preview with per-clip sync, speed, opacity, contrast, transform
- Timeline with ruler, track headers (mute/lock), clip rendering, trim handles, drag-to-move
- Playhead scrubbing (click + drag)
- Media panel pulling assets from `GET /api/assets` by `generatedContentId`
- Inspector with clip/look/transform/sound sections
- Auto-save (2s debounce) to backend via `PATCH /api/editor/:id`
- Full CRUD backend routes (`/api/editor`) with Zod validation
- Server-side ffmpeg export pipeline (download clips from R2 -> filtergraph -> upload output)
- Export modal with polling, progress bar, download link
- Keyboard shortcuts (Space, arrow keys, Cmd+Z/Y, Delete)
- Desktop-only guard (min-width 1280px)
- Media library integration (user-uploaded videos)

**Missing -- and it matters:**
- No caption system (auto-generated or manual)
- No transitions between clips (hard cuts only)
- No effects pipeline beyond basic Inspector sliders
- No publish/lock model (draft vs published)
- No 1:1 binding between editor projects and generated content
- No shot assembly system (editor creates from scratch, not from pipeline)
- No AI assembly integration
- No waveform visualization on audio clips
- No snap-to-grid or clip snapping
- No split clip operation
- No drag-and-drop from media panel to timeline (click-to-add only)
- No aspect ratio control (preview is 16:9 only, but reels are 9:16)
- Version conflict detection not implemented (doc describes it but code uses simple overwrite)

---

## Roadmap

Ordered by priority. Each item has a dedicated spec document.

| Phase | Feature | Document | Effort | User Value |
|-------|---------|----------|--------|------------|
| 1 | Project Model (1:1 binding, publish/draft) | [04-project-model.md](./04-project-model.md) | Medium | Critical |
| 2 | Editor Core (timeline polish, split, snap, 9:16) | [01-editor-core.md](./01-editor-core.md) | Large | Critical |
| 3 | Caption System (auto-generate, styles) | [02-captions.md](./02-captions.md) | Large | High |
| 4 | Assembly System (shot assembly, pipeline integration) | [05-assembly-system.md](./05-assembly-system.md) | Large | High |
| 5 | Effects and Transitions | [03-effects-transitions.md](./03-effects-transitions.md) | Medium | Medium |

---

## Why This Order

**Phase 1 -- Project Model** comes first because without the 1:1 binding between generated content and editor projects, the editor is disconnected from the rest of the platform. Users generate content in chat, it appears in the queue, but opening the editor is a separate workflow where you manually create a blank project. The whole point of the editor is to refine what the pipeline produced. This is the glue that makes the product coherent.

**Phase 2 -- Editor Core** is next because the current editor, while functional, has gaps that will frustrate anyone trying to do real work: no clip splitting, no snap alignment, and the preview is 16:9 when reels are 9:16. These are not nice-to-haves -- they are the difference between a toy and a tool.

**Phase 3 -- Captions** are the single highest-value feature for reel creators. CapCut's auto-caption feature is the reason most creators use it. If ContentAI can auto-generate and style captions from the voiceover/script that already exists in the pipeline, that is a genuine differentiator.

**Phase 4 -- Assembly System** connects the generation pipeline's shot-by-shot output to the editor's timeline. Today the assembly pipeline and the editor are two separate systems. Unifying them means the editor becomes the place where AI-generated shots land and get refined, which is the core product promise.

**Phase 5 -- Effects and Transitions** are last because they add polish but do not unlock new workflows. Hard cuts are fine for most short-form content. Creators will not abandon the product for lack of a cross-dissolve, but they will abandon it if they cannot add captions.

---

## Architecture Decisions

**Browser-based editing, server-side rendering.** The editor composes a timeline in the browser using stacked `<video>` elements for preview. Final export renders via ffmpeg on the server. This is the same model CapCut Web and Descript use. It avoids WebCodecs complexity while keeping export quality high.

**State lives in `useReducer`, not Zustand.** The existing implementation uses `useReducer` despite the original plan doc calling for Zustand. This is fine -- the reducer pattern gives better undo/redo semantics and keeps state predictable. Do not migrate to Zustand.

**JSONB tracks in Postgres.** The timeline is serialized as a JSONB blob on the `edit_projects` table. This works for the current scale. If projects get very complex (100+ clips), consider splitting clips into a separate relational table. But that is a problem for later.

**9:16 is the default, not 16:9.** The current preview renders 16:9. Reels are 9:16. This needs to change. The preview area, export pipeline, and resolution options should all default to vertical format. See [01-editor-core.md](./01-editor-core.md).

---

## Key Files

### Frontend
- `/home/kenneth/Documents/Workplace/ContentAI/frontend/src/routes/studio/editor.tsx` -- route shell
- `/home/kenneth/Documents/Workplace/ContentAI/frontend/src/features/editor/` -- all editor components, hooks, types
- `/home/kenneth/Documents/Workplace/ContentAI/frontend/src/features/editor/components/EditorLayout.tsx` -- main layout
- `/home/kenneth/Documents/Workplace/ContentAI/frontend/src/features/editor/types/editor.ts` -- type definitions
- `/home/kenneth/Documents/Workplace/ContentAI/frontend/src/features/editor/hooks/useEditorStore.ts` -- state reducer

### Backend
- `/home/kenneth/Documents/Workplace/ContentAI/backend/src/routes/editor/index.ts` -- all API routes + ffmpeg export worker
- `/home/kenneth/Documents/Workplace/ContentAI/backend/src/infrastructure/database/drizzle/schema.ts` -- `editProjects` and `exportJobs` tables

### Existing Documentation
- `/home/kenneth/Documents/Workplace/ContentAI/docs/research/video-editor-plan.md` -- original implementation plan
- `/home/kenneth/Documents/Workplace/ContentAI/docs/architecture/domain/manual-editor-system.md` -- composition model docs
