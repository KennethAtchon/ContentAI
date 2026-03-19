# Video Editor — Implementation Plan

A CapCut/DaVinci Resolve–style non-linear video editor embedded as a fourth tab in `/studio`. Users can load an assembled video from the queue, trim clips, layer audio, add text overlays, and export a final MP4 — all without leaving the app.

---

## Current State vs Target State

| Aspect | Current | Target |
|---|---|---|
| Studio tabs | Discover · Generate · Queue | Discover · Generate · Queue · **Editor** |
| Video editing | Removed (commit 450cda7) | Full NLE tab at `/studio/editor` |
| Edit state persistence | None | `editProjects` table in Postgres |
| Clip storage | `reelAssets` (voiceover, music, video_clip, assembled_video) | Same table, editor reads + writes clips |
| Export | Queue pipeline assembles via server | Client-driven edit → server render job |
| Asset panel | None | Media panel pulling from `reelAssets` |

---

## UI Layout

Follows the structure documented in `docs/ui-shop-notes/variant-4-paper-structure.md` exactly. The editor is a **full-viewport layout** (`100vh`, `min-width: 1280px`) with three horizontal bands:

```
┌──────────────────────────────────────────────────────────┐  54px
│  Toolbar: title | undo/redo | transport | timecode | zoom │
├──────────────────────────────────────────────────────────┤
│  Media Panel (220px) │ Preview (flex:1) │ Inspector(244px)│  flex:1
│  tabs: Media/Effects/│                  │                 │
│  Audio/Text          │   [16:9 screen]  │ clip properties │
│  2-col media grid    │                  │                 │
├──────────────────────────────────────────────────────────┤  296px
│  Timeline: track headers (186px) │ scrollable tracks     │
│  4 tracks: Video · Audio · Music · Text                  │
└──────────────────────────────────────────────────────────┘
```

### Toolbar (54px)

| Zone | Elements |
|---|---|
| Left | Project title `<input>` · separator · Undo · Redo · separator · Jump-start / Rewind / Play-Pause / FF / Jump-end · Timecode `HH:MM:SS:FF` · separator · Zoom− · `100%` · Zoom+ · Fit |
| Right | Export button (primary pill) |

### Media Panel (220px)

Four tabs — **Media**, **Effects**, **Audio**, **Text**:

- **Media tab** — 2-column grid of `reelAssets` thumbnails (video_clip + assembled_video for the current `generatedContentId`). Each card: 16:9 ratio, film-sprocket decoration, label. Click to add clip to playhead position on Video track.
- **Effects tab** — static list of built-in filter presets (Color Grade, B&W, Warm, Cool, Vignette). Click applies to selected clip via Inspector.
- **Audio tab** — list of `reelAssets` where type = voiceover or music. Click to add to Audio/Music track.
- **Text tab** — text overlay presets (Title, Subtitle, Caption). Click inserts a text clip on the Text track at playhead.

### Preview Area (flex:1)

- 16:9 `<video>` element rendered using a composited canvas (OffscreenCanvas or layered `<video>` + `<canvas>` overlay).
- Film-strip edge decorations (CSS pseudo-elements).
- Timecode overlay bottom-left, resolution badge top-right (`1080p`).
- Meta row below: current position / total duration · resolution · fps.
- Play/Pause, scrubbing, and frame-step driven by editor state.

### Inspector (244px)

Empty state: centered `✦` glyph + italic instruction.

When a clip is selected, four collapsible sections:

1. **Clip** — Name, Start (ms), Duration (ms), Speed (0.25× – 4×)
2. **Look** — Opacity slider, Warmth slider, Contrast slider
3. **Transform** — Position X, Position Y, Scale, Rotation
4. **Sound** — Volume slider, Mute toggle

All changes write directly to the in-memory edit project state (Zustand store), debounced 300ms before auto-save.

### Timeline (296px)

Four fixed tracks (56px each):

| Track | Clip types allowed |
|---|---|
| Video | video_clip, assembled_video |
| Audio | voiceover |
| Music | music |
| Text | text overlay |

- **Ruler** (32px) — major/minor ticks, seek on click/drag.
- **Clips** — absolutely positioned, film-sprocket decoration, trim handles (ew-resize), waveform SVG overlay (audio tracks), selected = 2px outline.
- **Playhead** — 2px vertical line, circular drag handle at top, z-index 20.
- **Track headers** — colored swatch pill, track name, M (mute) button, L (lock) button.
- Horizontal scroll only; zoom controlled by toolbar (pixels-per-second).

---

## Frontend Implementation

### Route

Add `/studio/editor` as a new tab route:

```
frontend/src/routes/studio/editor.tsx          — tab shell (loads edit project)
frontend/src/routes/studio/editor.$editId.tsx  — specific edit project (optional deep link)
```

### Feature Folder

```
frontend/src/features/editor/
├── components/
│   ├── EditorLayout.tsx          — outer 3-band shell
│   ├── Toolbar.tsx
│   ├── MediaPanel.tsx
│   ├── PreviewArea.tsx
│   ├── Inspector.tsx
│   ├── Timeline.tsx
│   ├── TimelineTrack.tsx
│   ├── TimelineClip.tsx
│   ├── TimelineRuler.tsx
│   ├── Playhead.tsx
│   └── TrackHeader.tsx
├── hooks/
│   ├── useEditorState.ts         — Zustand store selector
│   ├── usePlayback.ts            — rAF-based playback loop
│   ├── useTimeline.ts            — scroll, zoom, seek helpers
│   └── useEditorProject.ts       — load/save edit project (React Query)
├── services/
│   └── editor-api.ts             — API calls for editProjects + export
├── store/
│   └── editorStore.ts            — Zustand store (tracks, clips, playhead, zoom)
└── types/
    └── editor.ts                 — Track, Clip, EditProject, ExportJob types
```

### State Management (Zustand)

```typescript
interface EditorStore {
  // Project
  editProjectId: string | null;
  title: string;
  durationMs: number;

  // Playback
  currentTimeMs: number;
  isPlaying: boolean;
  zoom: number; // pixels per second, default 40

  // Tracks (ordered: Video, Audio, Music, Text)
  tracks: Track[];

  // Selection
  selectedClipId: string | null;

  // History (undo/redo)
  past: TrackSnapshot[];
  future: TrackSnapshot[];
}

interface Track {
  id: string;
  type: "video" | "audio" | "music" | "text";
  name: string;
  muted: boolean;
  locked: boolean;
  clips: Clip[];
}

interface Clip {
  id: string;
  assetId: string | null;   // reelAssets.id — null for text clips
  r2Url: string;            // presigned URL for playback
  startMs: number;          // position on timeline
  durationMs: number;
  trimStartMs: number;      // in-point offset into source
  trimEndMs: number;        // out-point offset from end
  speed: number;
  label: string;
  // Look
  opacity: number;
  warmth: number;
  contrast: number;
  // Transform
  positionX: number;
  positionY: number;
  scale: number;
  rotation: number;
  // Sound
  volume: number;
  muted: boolean;
  // Text-only
  textContent?: string;
  textStyle?: TextStyle;
}
```

### Playback Engine

- Primary approach: stacked `<video>` elements (one per video clip) + `<canvas>` for text/effects overlay.
- Seek: `video.currentTime = (currentTimeMs - clip.startMs) / 1000 + clip.trimStartMs / 1000`
- `requestAnimationFrame` loop drives `currentTimeMs` increment while `isPlaying`.
- Audio clips: Web Audio API `AudioBufferSourceNode` for precise sync.
- Export preview (optional): OffscreenCanvas compositing — deferred to v2.

### StudioTopBar changes

Add `editor` tab to `STUDIO_TABS`:

```typescript
{ key: "editor", path: "/studio/editor" }
```

Add translation key `studio_tabs_editor` → `"Editor"` in `en.json`.

---

## Backend Implementation

### New Table: `editProjects`

```sql
CREATE TABLE edit_projects (
  id          TEXT PRIMARY KEY DEFAULT gen_ulid(),
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL DEFAULT 'Untitled Edit',

  -- Linked to generated content (optional, for context)
  generated_content_id TEXT REFERENCES generated_content(id) ON DELETE SET NULL,

  -- Serialized timeline state (JSON blob)
  tracks      JSONB NOT NULL DEFAULT '[]',

  -- Timeline metadata
  duration_ms INTEGER NOT NULL DEFAULT 0,
  fps         INTEGER NOT NULL DEFAULT 30,
  resolution  TEXT NOT NULL DEFAULT '1080p',   -- "1080p" | "720p" | "4k"

  -- Export state
  export_status  TEXT NOT NULL DEFAULT 'idle', -- "idle"|"queued"|"rendering"|"done"|"failed"
  export_r2_key  TEXT,
  export_r2_url  TEXT,
  export_error   TEXT,

  created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX edit_projects_user_idx ON edit_projects(user_id);
CREATE INDEX edit_projects_content_idx ON edit_projects(generated_content_id);
```

**Schema placement:** Add to `backend/src/infrastructure/database/drizzle/schema.ts` alongside existing tables.

### New Table: `exportJobs`

Separate table to track async render jobs (avoids polluting `editProjects`):

```sql
CREATE TABLE export_jobs (
  id              TEXT PRIMARY KEY DEFAULT gen_ulid(),
  edit_project_id TEXT NOT NULL REFERENCES edit_projects(id) ON DELETE CASCADE,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status          TEXT NOT NULL DEFAULT 'queued', -- "queued"|"rendering"|"done"|"failed"
  progress        INTEGER NOT NULL DEFAULT 0,     -- 0–100
  r2_key          TEXT,
  r2_url          TEXT,
  error           TEXT,
  created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX export_jobs_project_idx ON export_jobs(edit_project_id);
CREATE INDEX export_jobs_user_idx ON export_jobs(user_id);
```

### `reelAssets` — No Schema Changes Required

The existing `reelAssets` table (voiceover, music, video_clip, assembled_video, image) is the media source for the editor. The editor reads assets by `generatedContentId` from the existing `GET /api/assets` endpoint. No new columns needed.

### New API Routes: `/api/editor`

Mount in `backend/src/index.ts` as `/api/editor`.

```
GET    /api/editor                           — list user's edit projects
POST   /api/editor                           — create new edit project
GET    /api/editor/:id                       — get single edit project (full tracks JSON)
PATCH  /api/editor/:id                       — auto-save tracks + title + duration
DELETE /api/editor/:id                       — delete edit project

POST   /api/editor/:id/export                — enqueue export render job
GET    /api/editor/:id/export/status         — poll export job status + progress
```

**`PATCH /api/editor/:id`** — auto-save endpoint (debounced from client, every 2s or on change):

```typescript
// Request body
{
  title?: string;
  tracks?: Track[];          // full serialized timeline state
  durationMs?: number;
}

// Response
{ id, updatedAt }
```

**`POST /api/editor/:id/export`** — enqueue a render job:

```typescript
// Request body (optional overrides)
{
  resolution?: "720p" | "1080p" | "4k";
  fps?: 24 | 30 | 60;
}

// Response
{ exportJobId: string }
```

**`GET /api/editor/:id/export/status`** — poll for render job progress:

```typescript
// Response
{
  status: "queued" | "rendering" | "done" | "failed";
  progress: number;   // 0–100
  r2Url?: string;     // present when status = "done"
  error?: string;
}
```

### Export / Render Backend

**Server-side video assembly** uses `ffmpeg` (already available on the server via the existing pipeline) to render the timeline:

1. Client sends `PATCH /api/editor/:id` with final tracks.
2. Client calls `POST /api/editor/:id/export`.
3. Server enqueues an export job in `exportJobs`.
4. A background worker (or inline Bun subprocess) reads `editProjects.tracks`, resolves R2 keys for each clip, and runs an `ffmpeg` command:
   - Trims each clip per `trimStartMs`/`trimEndMs`.
   - Applies `speed` via `setpts`.
   - Layers audio tracks at their correct volumes.
   - Composite text overlays via `drawtext` filter.
   - Outputs final MP4 to R2 under `exports/{userId}/{editProjectId}/{exportJobId}.mp4`.
5. Server updates `exportJobs.status`, `progress`, `r2_key`, `r2_url`.
6. Client polls `GET /api/editor/:id/export/status` every 3s.
7. On completion, the exported video URL is shown in the Export modal.

**ffmpeg approach** — complex filtergraph example (simplified):

```bash
ffmpeg \
  -i clip1.mp4 -i clip2.mp4 \
  -i voiceover.mp3 \
  -filter_complex "
    [0:v]trim=start=0:end=5,setpts=PTS/1.0[v0];
    [1:v]trim=start=2:end=8,setpts=PTS/1.0[v1];
    [v0][v1]concat=n=2:v=1:a=0[vout];
    [0:a][1:a]amix=inputs=2[aout]
  " \
  -map [vout] -map [aout] \
  -c:v libx264 -crf 18 -preset fast \
  -c:a aac -b:a 192k \
  output.mp4
```

Text overlays use `drawtext` filter with font, position, and timing options derived from `TextStyle`.

---

## Migration

One new Drizzle migration file (auto-generated via `bun db:generate`):

```
backend/src/infrastructure/database/drizzle/migrations/
  XXXX_add_edit_projects.sql
```

Creates:
- `edit_projects` table
- `export_jobs` table
- Two indexes each

---

## i18n

Add to `frontend/src/translations/en.json`:

```json
"studio_tabs_editor": "Editor",
"editor_media_tab": "Media",
"editor_effects_tab": "Effects",
"editor_audio_tab": "Audio",
"editor_text_tab": "Text",
"editor_inspector_empty": "Select a clip to edit its properties",
"editor_export_button": "Export",
"editor_export_modal_title": "Export Video",
"editor_export_rendering": "Rendering…",
"editor_export_done": "Export complete",
"editor_export_failed": "Export failed",
"editor_track_video": "Video",
"editor_track_audio": "Audio",
"editor_track_music": "Music",
"editor_track_text": "Text",
"editor_untitled": "Untitled Edit"
```

---

## Data Flow

```
Queue item (generatedContentId)
        │
        ▼
GET /api/assets?generatedContentId=X  →  reelAssets list
        │
        ▼
Editor Media Panel (Media tab)
        │  drag or click
        ▼
Clip added to Track in Zustand store
        │  debounced 2s
        ▼
PATCH /api/editor/:id  (auto-save tracks JSON)
        │
        ▼
User clicks Export
        │
        ▼
POST /api/editor/:id/export  →  exportJobs record created
        │
        ▼
Server ffmpeg render  →  R2 upload
        │
        ▼
GET /api/editor/:id/export/status  (polled every 3s)
        │
        ▼
Export modal shows download link / plays final video
```

---

## Build Sequence

### Phase 1 — Schema & API Skeleton
1. Add `editProjects` and `exportJobs` tables to `schema.ts`.
2. Run `bun db:generate && bun db:migrate`.
3. Implement `/api/editor` routes (CRUD + export endpoints) with stubs.
4. Write backend unit tests for the new routes.

### Phase 2 — Editor Tab Shell
5. Add `editor` tab to `StudioTopBar` + `STUDIO_TABS`.
6. Add translation keys to `en.json`.
7. Create `/studio/editor` route with `EditorLayout` shell.
8. Implement Zustand `editorStore` with all state fields.
9. Wire `useEditorProject` hook (load/auto-save via React Query + `useMutation`).

### Phase 3 — Timeline
10. Implement `TimelineRuler` with tick marks and seek-on-click.
11. Implement `TrackHeader` with mute/lock buttons.
12. Implement `TimelineClip` with drag-to-move, trim handles, waveform SVG, selection ring.
13. Implement `Playhead` with drag handle.
14. Wire zoom (px/s) to toolbar Zoom+/Zoom− and timeline horizontal scroll.

### Phase 4 — Playback Engine
15. Implement `usePlayback` (rAF loop, `currentTimeMs` increment).
16. Map clips to stacked `<video>` elements in `PreviewArea`.
17. Wire transport controls (Play/Pause, Jump-start, Jump-end, FF, Rewind).
18. Display timecode overlay and meta row below preview.

### Phase 5 — Inspector & Media Panel
19. Implement `Inspector` (empty state + populated state with 4 sections).
20. Implement `MediaPanel` with four tabs pulling from `GET /api/assets`.
21. Wire clip-drop from Media tab to Timeline (add clip at playhead).
22. Wire Text tab (insert text clip).

### Phase 6 — Export
23. Implement Export modal (resolution + fps options, progress bar).
24. Implement server-side ffmpeg render worker.
25. Wire `POST /api/editor/:id/export` + polling `GET /api/editor/:id/export/status`.
26. Show final download link / copy R2 URL on completion.

### Phase 7 — Polish & Edge Cases
27. Undo/redo (past/future stacks in Zustand).
28. Keyboard shortcuts: Space (play/pause), `←`/`→` (frame step), `Cmd+Z` (undo), `Cmd+Shift+Z` (redo), `Delete` (remove selected clip).
29. Responsive guard: show "Editor requires desktop (≥1280px)" on small screens.
30. Integration tests: create edit project, add clips, export.

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| R2 presigned URL expiry during long edit sessions | Clips fail to play mid-session | Refresh URLs via `GET /api/assets` with a 6h expiry window; re-fetch on 403 |
| ffmpeg not available on server | Export broken | Confirm ffmpeg binary path in `envUtil`; add health check endpoint |
| Large `tracks` JSON in Postgres | Slow auto-save for complex edits | Limit to 100 clips max; index on `id` only; consider compressing with `pg_lz` |
| Stacked `<video>` element sync drift | Playback desync | Use a single master `currentTime` reference + sync all videos to it on each rAF tick |
| Browser autoplay policies | Audio clips silenced | Require user gesture before starting playback; show unmute button if autoplay blocked |
| Text overlay rendering in ffmpeg | Font embedding issues | Bundle a known-good TTF font (e.g., Inter) in backend assets |

---

## Out of Scope (v1)

- Multi-user collaboration / shared edit projects
- Transition effects between clips (wipe, fade) — basic cut only in v1
- Real-time server-side preview generation
- Mobile editor UI (min-width enforced)
- AI-assisted auto-edit ("cut to beat", scene detection)
- Caption auto-sync from script (v2 — uses `cleanScriptForAudio` + timestamps)
