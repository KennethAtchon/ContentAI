# ContentAI Editor Studio — Low-Level Design (LLD)

**Author:** Engineering
**Date:** 2026-03-24
**Status:** Draft
**Depends on:** hld.md, pm-product-spec.md

---

## Phase 0 — Bug Fixes

### 0.1 Fix: AI Chat Session Button

**File:** `frontend/src/routes/studio/queue.tsx` (DetailPanel or queue item card)

**Root cause:** The "Open AI Chat" / "Open Chat Session" button has no `onClick` or the `to` prop is undefined.

**Fix:**
```typescript
// In queue detail panel, find the chat button and wire it:
const chatUrl = item.generatedContentId
  ? `/studio/generate?contentId=${item.generatedContentId}`
  : "/studio/generate";

<Link to={chatUrl}>Open AI Chat</Link>
```

**Backend consideration:** The generate route must accept `?contentId=X` and load the existing chat session for that content. Check `frontend/src/routes/studio/generate.tsx` — if it already reads `contentId` from search params and uses it to load the workspace, the fix is only the link. If not, add:

```typescript
// In generate route or ContentWorkspace:
const { contentId } = Route.useSearch();
// Pass contentId to ContentWorkspace to pre-select the correct content
```

**Files to change:**
- `frontend/src/routes/studio/queue.tsx` — wire the button href
- `frontend/src/routes/studio/generate.tsx` — accept and handle `contentId` search param (verify this already works)

---

### 0.2 Fix: Dual Timeline Builder → Single Builder

**Root cause:** `backend/src/routes/video/index.ts` contains `_buildInitialTimeline` (line ~428) and `_convertTimelineToEditorTracks`. These drift from `backend/src/routes/editor/services/build-initial-timeline.ts`, causing the video route to produce clips with the wrong track assignments.

**Fix:**

In `backend/src/routes/video/index.ts`, find and delete:
- The `_buildInitialTimeline` function
- The `_convertTimelineToEditorTracks` function
- Any `TimelinePayload` type that only existed for those functions

Replace with an import:
```typescript
import { buildInitialTimeline } from "../editor/services/build-initial-timeline";
```

In `backend/src/routes/editor/services/build-initial-timeline.ts`, verify it handles all asset role types. Add any missing role mappings:

```typescript
// Ensure this function handles: video_clip, voiceover, background_music, text_overlay
// The text_overlay role must map to the "text" track, NOT the "video" track
function buildInitialTimeline(assets: Asset[]): Track[] {
  const videoClips = assets.filter(a => a.role === "video_clip").sort(byShotIndex);
  const voiceovers = assets.filter(a => a.role === "voiceover");
  const music = assets.filter(a => a.role === "background_music");
  const textOverlays = assets.filter(a => a.role === "text_overlay"); // Must go to text track

  let videoPos = 0;
  const videoTrackClips: Clip[] = videoClips.map(asset => {
    const duration = asset.durationMs ?? 5000;
    const clip = makeClip(asset, videoPos, duration);
    videoPos += duration;
    return clip;
  });

  return [
    { type: "video", lanes: [{ id: ulid(), name: "Video 1", clips: videoTrackClips, locked: false }], muted: false, locked: false },
    { type: "audio", clips: voiceovers.map(a => makeClip(a, 0, a.durationMs ?? videoPos)), muted: false, locked: false },
    { type: "music", clips: music.map(a => makeClip(a, 0, a.durationMs ?? videoPos, { volume: 0.3 })), muted: false, locked: false },
    { type: "text", clips: textOverlays.map(a => makeTextClip(a)), muted: false, locked: false },
  ];
}

function byShotIndex(a: Asset, b: Asset) {
  return (a.shotIndex ?? 999) - (b.shotIndex ?? 999);
}
```

**Files to change:**
- `backend/src/routes/video/index.ts` — delete dual builders, import single builder
- `backend/src/routes/editor/services/build-initial-timeline.ts` — add missing role mappings, sort by shotIndex

---

### 0.3 Fix: Inspector Enabled/Mute Buttons Offscreen

**File:** `frontend/src/features/editor/components/Inspector.tsx`

**Root cause:** The toggle switches for "Enabled" and "Mute" likely use a CSS transform or absolute positioning that pushes them outside the panel boundary when toggled off.

**Fix:** Ensure the inspector's inner scroll container has `overflow-y: auto` and `overflow-x: hidden`. The enabled/mute controls must be inside the scrollable area, not positioned absolutely outside it.

```tsx
// Inspector panel wrapper should have:
<div className="flex flex-col h-full overflow-y-auto overflow-x-hidden">
  {/* all inspector sections */}
</div>
```

If the Enabled/Mute toggle uses a `Switch` from Radix UI, verify the `checked` prop is correctly bound:
```tsx
<Switch
  checked={clip.enabled !== false}  // default true if undefined
  onCheckedChange={(v) => onUpdateClip(clip.id, { enabled: v })}
/>
```

**Files to change:**
- `frontend/src/features/editor/components/Inspector.tsx`

---

### 0.4 Add: Waveform Visualization

#### 0.4.1 Waveform Cache Hook

**New file:** `frontend/src/features/editor/hooks/useWaveformCache.ts`

```typescript
// Module-level cache — persists across renders, cleared when module unloads
const waveformCache = new Map<string, number[]>();
const pendingDecodes = new Map<string, Promise<number[]>>();

export function useWaveformCache() {
  return { getWaveform };
}

async function getWaveform(assetId: string, audioUrl: string, barCount: number): Promise<number[]> {
  const cacheKey = `${assetId}:${barCount}`;
  if (waveformCache.has(cacheKey)) return waveformCache.get(cacheKey)!;

  if (!pendingDecodes.has(cacheKey)) {
    const promise = decodeWaveform(audioUrl, barCount)
      .then(bars => { waveformCache.set(cacheKey, bars); return bars; })
      .catch(() => new Array(barCount).fill(0.1)); // flat line fallback
    pendingDecodes.set(cacheKey, promise);
  }
  return pendingDecodes.get(cacheKey)!;
}

async function decodeWaveform(url: string, barCount: number): Promise<number[]> {
  const resp = await fetch(url);
  const buf = await resp.arrayBuffer();
  const ctx = new AudioContext();
  const audio = await ctx.decodeAudioData(buf);
  const data = audio.getChannelData(0);
  const blockSize = Math.floor(data.length / barCount);
  const bars: number[] = [];
  for (let i = 0; i < barCount; i++) {
    let sum = 0;
    for (let j = 0; j < blockSize; j++) sum += Math.abs(data[i * blockSize + j]);
    bars.push(sum / blockSize);
  }
  const max = Math.max(...bars, 0.001);
  return bars.map(b => b / max);
}
```

#### 0.4.2 WaveformRenderer Component

**New file:** `frontend/src/features/editor/components/timeline/WaveformRenderer.tsx`

```tsx
interface Props {
  assetId: string;
  audioUrl: string;
  width: number;   // clip pixel width
  height: number;  // clip pixel height
  color?: string;
}

export function WaveformRenderer({ assetId, audioUrl, width, height, color = "rgba(255,255,255,0.6)" }: Props) {
  const [bars, setBars] = useState<number[]>([]);
  const { getWaveform } = useWaveformCache();
  const barCount = Math.max(1, Math.floor(width / 3));

  useEffect(() => {
    let cancelled = false;
    getWaveform(assetId, audioUrl, barCount).then(b => {
      if (!cancelled) setBars(b);
    });
    return () => { cancelled = true; };
  }, [assetId, audioUrl, barCount]);

  if (!bars.length) return <div className="waveform-shimmer" style={{ width, height }} />;

  const barWidth = width / barCount;
  return (
    <svg width={width} height={height} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      {bars.map((amp, i) => {
        const barH = Math.max(2, amp * height * 0.8);
        return (
          <rect
            key={i}
            x={i * barWidth}
            y={(height - barH) / 2}
            width={Math.max(1, barWidth - 1)}
            height={barH}
            fill={color}
          />
        );
      })}
    </svg>
  );
}
```

#### 0.4.3 Wire into TimelineClip

In `TimelineClip.tsx`, for clips of type `audio`, `voiceover`, or `music` (i.e., clips with an `audioUrl`):

```tsx
{clip.type !== "video" && clip.audioUrl && (
  <WaveformRenderer
    assetId={clip.assetId}
    audioUrl={clip.audioUrl}
    width={clipPixelWidth}
    height={TRACK_HEIGHT}
  />
)}
```

**Files to change / create:**
- `frontend/src/features/editor/hooks/useWaveformCache.ts` (new)
- `frontend/src/features/editor/components/timeline/WaveformRenderer.tsx` (new)
- `frontend/src/features/editor/components/timeline/TimelineClip.tsx` (add waveform render)

---

## Phase 1 — Data Layer and Project Model

### 1.1 Schema Changes

**File:** `backend/src/infrastructure/database/drizzle/schema.ts`

```typescript
export const editProjects = pgTable("edit_projects", {
  // existing columns...
  status: text("status").notNull().default("draft"),              // NEW
  publishedAt: timestamp("published_at"),                         // NEW
  parentProjectId: text("parent_project_id")                      // NEW
    .references(() => editProjects.id),
  aspectRatio: text("aspect_ratio").notNull().default("9:16"),    // NEW (Phase 2)
}, (t) => ({
  uniqueContent: uniqueIndex("edit_project_unique_content")       // NEW
    .on(t.userId, t.generatedContentId)
    .where(sql`${t.generatedContentId} IS NOT NULL`),
}));

export const captions = pgTable("captions", {                     // NEW TABLE
  id: text("id").primaryKey().$defaultFn(() => generateUlid()),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  assetId: text("asset_id").notNull().references(() => assets.id, { onDelete: "cascade" }),
  language: text("language").notNull().default("en"),
  words: jsonb("words").notNull(),
  fullText: text("full_text").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  assetIdx: index("captions_asset_idx").on(t.assetId),
  userIdx: index("captions_user_idx").on(t.userId),
}));

// Relax prompt to nullable on generated_content
// Change: prompt: text("prompt").notNull() → prompt: text("prompt")
```

Run: `cd backend && bun db:generate && bun db:migrate`

---

### 1.2 POST /api/editor — Upsert + Auto-Initialize

**File:** `backend/src/routes/editor/index.ts`

```typescript
// POST /api/editor
app.post("/", requireAuth, async (c) => {
  const auth = c.get("auth");
  const body = await c.req.json();
  const parsed = CreateEditorProjectSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Invalid input" }, 400);

  const { generatedContentId } = parsed.data;

  // Upsert: if project already exists for this content, return it
  if (generatedContentId) {
    const [existing] = await db
      .select()
      .from(editProjects)
      .where(
        and(
          eq(editProjects.userId, auth.user.id),
          eq(editProjects.generatedContentId, generatedContentId),
        ),
      )
      .limit(1);

    if (existing) return c.json({ project: existing }, 200);
  }

  // First time: build initial timeline from pipeline assets
  const tracks = generatedContentId
    ? await buildInitialTimeline(generatedContentId, auth.user.id)
    : getEmptyTracks();

  const [project] = await db
    .insert(editProjects)
    .values({
      id: generateUlid(),
      userId: auth.user.id,
      generatedContentId: generatedContentId ?? null,
      tracks,
      status: "draft",
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  return c.json({ project }, 201);
});
```

---

### 1.3 POST /api/editor/:id/publish

**File:** `backend/src/routes/editor/index.ts`

```typescript
app.post("/:id/publish", requireAuth, async (c) => {
  const auth = c.get("auth");
  const { id } = c.req.param();

  const [project] = await db
    .select()
    .from(editProjects)
    .where(and(eq(editProjects.id, id), eq(editProjects.userId, auth.user.id)))
    .limit(1);

  if (!project) return c.json({ error: "Not found" }, 404);
  if (project.status === "published") return c.json({ error: "Already published" }, 409);

  // Must have a completed export job
  const [completedExport] = await db
    .select()
    .from(exportJobs)
    .where(and(eq(exportJobs.editProjectId, id), eq(exportJobs.status, "done")))
    .limit(1);

  if (!completedExport) return c.json({ error: "Export required before publishing" }, 422);

  const [updated] = await db
    .update(editProjects)
    .set({ status: "published", publishedAt: new Date(), updatedAt: new Date() })
    .where(eq(editProjects.id, id))
    .returning();

  // Update linked queue item status
  if (project.generatedContentId) {
    await db
      .update(queueItems)
      .set({ status: "ready" })
      .where(eq(queueItems.generatedContentId, project.generatedContentId));
  }

  return c.json({ project: updated });
});
```

---

### 1.4 POST /api/editor/:id/new-draft

```typescript
app.post("/:id/new-draft", requireAuth, async (c) => {
  const auth = c.get("auth");
  const { id } = c.req.param();

  const [source] = await db
    .select()
    .from(editProjects)
    .where(and(eq(editProjects.id, id), eq(editProjects.userId, auth.user.id)))
    .limit(1);

  if (!source) return c.json({ error: "Not found" }, 404);
  if (source.status !== "published") return c.json({ error: "Can only branch from published projects" }, 422);

  // Duplicate generated_content if linked
  let newContentId = null;
  if (source.generatedContentId) {
    const [srcContent] = await db
      .select()
      .from(generatedContent)
      .where(eq(generatedContent.id, source.generatedContentId))
      .limit(1);

    if (srcContent) {
      const [newContent] = await db
        .insert(generatedContent)
        .values({
          ...srcContent,
          id: generateUlid(),
          parentId: srcContent.id,
          status: "draft",
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();
      newContentId = newContent.id;
    }
  }

  const [newProject] = await db
    .insert(editProjects)
    .values({
      id: generateUlid(),
      userId: auth.user.id,
      generatedContentId: newContentId,
      parentProjectId: source.id,
      tracks: source.tracks,   // start from published timeline
      status: "draft",
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  return c.json({ project: newProject }, 201);
});
```

---

### 1.5 PATCH /api/editor/:id — Enforce Read-Only on Published

```typescript
app.patch("/:id", requireAuth, async (c) => {
  // ... existing ownership check ...
  if (project.status === "published") {
    return c.json({ error: "Published projects are read-only. Create a new draft to make changes." }, 403);
  }
  // ... rest of patch logic ...
});
```

---

### 1.6 Remove localStorage Job Tracking

**File:** `frontend/src/features/chat/components/ContentWorkspace.tsx`

Remove lines 42-48 (or wherever localStorage reads/writes for video job ID occur):
```typescript
// DELETE:
const [jobId, setJobId] = useState(() => localStorage.getItem(`videoJob_${contentId}`));
// ...
localStorage.setItem(`videoJob_${contentId}`, job.id);
localStorage.removeItem(`videoJob_${contentId}`);
```

Replace with the existing server-polling hook:
```typescript
const { job, status } = useVideoJob(generatedContentId);
```

Verify `useVideoJob` handles `null` generatedContentId and the "no active job" state gracefully.

---

### 1.7 Queue Live State — JOIN edit_projects

**File:** `backend/src/routes/queue/index.ts` (pipeline stage query)

```typescript
// Add to the queue list query:
const items = await db
  .select({
    // existing fields...
    editProjectId: editProjects.id,
    editProjectStatus: editProjects.status,
    editProjectPublishedAt: editProjects.publishedAt,
    latestExportStatus: exportJobs.status,
    latestExportUrl: exportJobs.outputUrl,
  })
  .from(queueItems)
  .leftJoin(generatedContent, eq(queueItems.generatedContentId, generatedContent.id))
  .leftJoin(editProjects, and(
    eq(editProjects.generatedContentId, queueItems.generatedContentId),
    eq(editProjects.userId, auth.user.id),
  ))
  .leftJoin(exportJobs, and(
    eq(exportJobs.editProjectId, editProjects.id),
    // latest export job only — use a subquery or order + limit
  ))
  .where(eq(queueItems.userId, auth.user.id));
```

**Frontend:** `frontend/src/routes/studio/queue.tsx` DetailPanel — add "Open in Editor" button:
```tsx
{item.editProjectId && (
  <Link to="/studio/editor" search={{ contentId: item.generatedContentId }}>
    Open in Editor
  </Link>
)}
{!item.editProjectId && (
  <Button onClick={() => openEditor(item.generatedContentId)}>
    Open in Editor
  </Button>
)}

// Status badges:
{item.editProjectStatus === "published" && <Badge>Published</Badge>}
{item.latestExportStatus === "done" && <Badge>Exported</Badge>}
```

---

## Phase 2 — Editor Core Quality

### 2.1 Aspect Ratio — 9:16 Default

**Frontend:** `frontend/src/features/editor/components/PreviewArea.tsx`
```tsx
// Change: aspectRatio: "16/9" → "9/16"
const aspectRatio = project.aspectRatio === "16:9" ? "16/9"
  : project.aspectRatio === "1:1" ? "1/1"
  : "9/16"; // default

<div style={{
  aspectRatio,
  maxWidth: aspectRatio === "9/16" ? "360px" : "640px",
  // for 9:16, constrain by width (it's tall), for 16:9 constrain by height
}}>
```

**Backend export resolution mapping:**
```typescript
// In build-ffmpeg-filtergraph.ts or export handler:
const resolutionMap: Record<string, [number, number]> = {
  "1080x1920": [1080, 1920],  // 9:16 default
  "720x1280":  [720, 1280],
  "2160x3840": [2160, 3840],
  "1920x1080": [1920, 1080],  // 16:9
  "1280x720":  [1280, 720],
  // Legacy compat:
  "1080p": [1080, 1920],      // treated as vertical 9:16
  "720p":  [720, 1280],
  "4k":    [2160, 3840],
};
```

**Toolbar aspect ratio toggle:**
```tsx
<select value={project.aspectRatio} onChange={e => updateAspectRatio(e.target.value)}>
  <option value="9:16">9:16 (Vertical)</option>
  <option value="16:9">16:9 (Horizontal)</option>
  <option value="1:1">1:1 (Square)</option>
</select>
```

---

### 2.2 Split Clip at Playhead

**File:** `frontend/src/features/editor/hooks/useEditorStore.ts`

**New reducer action type:**
```typescript
| { type: "SPLIT_CLIP"; clipId: string; atMs: number }
```

**Reducer case:**
```typescript
case "SPLIT_CLIP": {
  const { clipId, atMs } = action;
  const newTracks = state.tracks.map(track => ({
    ...track,
    // For multi-lane video tracks:
    lanes: track.lanes?.map(lane => ({
      ...lane,
      clips: splitClipInList(lane.clips, clipId, atMs),
    })),
    // For non-video tracks:
    clips: track.clips ? splitClipInList(track.clips, clipId, atMs) : undefined,
  }));
  return pushHistory({ ...state, tracks: newTracks });
}

function splitClipInList(clips: Clip[], clipId: string, atMs: number): Clip[] {
  const idx = clips.findIndex(c => c.id === clipId);
  if (idx === -1) return clips;
  const clip = clips[idx];
  if (atMs <= clip.startMs || atMs >= clip.startMs + clip.durationMs) return clips;

  const clipA: Clip = {
    ...clip,
    id: generateId(),
    durationMs: atMs - clip.startMs,
    trimEndMs: clip.trimEndMs + (clip.durationMs - (atMs - clip.startMs)),
  };
  const clipB: Clip = {
    ...clip,
    id: generateId(),
    startMs: atMs,
    durationMs: (clip.startMs + clip.durationMs) - atMs,
    trimStartMs: clip.trimStartMs + (atMs - clip.startMs),
  };
  return [...clips.slice(0, idx), clipA, clipB, ...clips.slice(idx + 1)];
}
```

**Keyboard shortcut in EditorLayout.tsx:**
```typescript
case "s":
case "S": {
  if (selectedClipId) {
    dispatch({ type: "SPLIT_CLIP", clipId: selectedClipId, atMs: state.currentTimeMs });
  }
  break;
}
```

---

### 2.3 Clip Snapping

**New file:** `frontend/src/features/editor/hooks/useSnapTargets.ts`

```typescript
export function collectSnapTargets(tracks: Track[], excludeClipId: string): number[] {
  const targets = new Set<number>([0]);
  for (const track of tracks) {
    const clips = getAllClipsFromTrack(track);
    for (const clip of clips) {
      if (clip.id === excludeClipId) continue;
      targets.add(clip.startMs);
      targets.add(clip.startMs + clip.durationMs);
    }
  }
  return [...targets].sort((a, b) => a - b);
}

export function findSnapTarget(posMs: number, targets: number[], thresholdMs: number): number | null {
  // Binary search for nearest target within threshold
  let lo = 0, hi = targets.length - 1;
  let nearest: number | null = null;
  let nearestDist = thresholdMs + 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const dist = Math.abs(targets[mid] - posMs);
    if (dist < nearestDist) { nearestDist = dist; nearest = targets[mid]; }
    if (targets[mid] < posMs) lo = mid + 1;
    else hi = mid - 1;
  }
  return nearestDist <= thresholdMs ? nearest : null;
}
```

**In TimelineClip.tsx drag handler:**
```typescript
const SNAP_THRESHOLD_PX = 10;

onMouseMove: (e) => {
  // ... compute rawStartMs from mouse position ...
  const thresholdMs = SNAP_THRESHOLD_PX / zoom * 1000;
  const snapTargets = collectSnapTargets(tracks, clip.id);
  // Also add playhead as snap target:
  snapTargets.push(state.currentTimeMs);

  const snapped = findSnapTarget(rawStartMs, snapTargets, thresholdMs);
  const newStartMs = snapped ?? rawStartMs;
  setSnapLineMs(snapped); // show vertical snap line
  dispatch({ type: "UPDATE_CLIP", clipId: clip.id, changes: { startMs: newStartMs } });
}
```

**Snap line render in Timeline.tsx:**
```tsx
{snapLineMs !== null && (
  <div
    className="absolute top-0 bottom-0 w-px bg-yellow-400 pointer-events-none z-50"
    style={{ left: snapLineMs / 1000 * zoom }}
  />
)}
```

---

### 2.4 Drag-and-Drop from Media Panel

**In MediaPanel asset cards:**
```tsx
<div
  draggable
  onDragStart={(e) => {
    e.dataTransfer.setData(
      "application/x-contentai-asset",
      JSON.stringify({ assetId: asset.id, type: asset.type, r2Url: asset.mediaUrl, durationMs: asset.durationMs })
    );
  }}
>
  {/* asset card content */}
</div>
```

**In TrackLane.tsx (each track row):**
```tsx
onDragOver={(e) => {
  const data = e.dataTransfer.types.includes("application/x-contentai-asset");
  if (!data) return;
  // Check track type compatibility
  if (!isCompatibleDrop(track.type, e.dataTransfer)) return;
  e.preventDefault(); // allow drop
  setDropHighlight(true);
}}

onDrop={(e) => {
  e.preventDefault();
  const raw = e.dataTransfer.getData("application/x-contentai-asset");
  if (!raw) return;
  const asset = JSON.parse(raw);
  const trackRect = e.currentTarget.getBoundingClientRect();
  const dropX = e.clientX - trackRect.left + scrollLeft;
  const startMs = Math.max(0, Math.round((dropX / zoom) * 1000));
  dispatch({ type: "ADD_CLIP", trackId: track.id, clip: makeClipFromAsset(asset, startMs) });
  setDropHighlight(false);
}}
```

---

### 2.5 Multi-Lane Video Track

**Type change in `editor.ts`:**
```typescript
// Before
interface Track {
  type: "video" | "audio" | "music" | "text";
  clips: Clip[];
  muted: boolean;
  locked: boolean;
  name: string;
}

// After
interface TrackLane {
  id: string;
  name: string;
  clips: Clip[];
  locked: boolean;
}

interface Track {
  type: "video" | "audio" | "music" | "text";
  // Video tracks have lanes, others have clips directly
  lanes?: TrackLane[];   // video tracks only
  clips?: Clip[];        // audio, music, text tracks
  muted: boolean;
  locked: boolean;
  name: string;
}
```

**Backward-compat reader:**
```typescript
function getTrackClips(track: Track, laneIndex = 0): Clip[] {
  if (track.lanes) return track.lanes[laneIndex]?.clips ?? [];
  return track.clips ?? []; // legacy format
}
```

**New reducer actions:**
```typescript
| { type: "ADD_VIDEO_LANE" }
| { type: "REMOVE_VIDEO_LANE"; laneId: string }
```

**Timeline rendering:** Video track section renders one `<TrackLane>` row per lane, with a vertically scrollable container if more than 2 lanes. An "Add Video Track" button appears at the bottom of the video section.

---

## Phase 3 — Caption System

### 3.1 Caption Tab Redesign (Frontend)

**File:** Wherever the text/media panel tab content lives (likely `MediaPanel.tsx` or a `TextPanel.tsx` sub-component)

**Rename:** Tab label "Text" → "Caption"

**Remove:** Title / Subtitle / Caption option buttons from the tab

**Add:** Five theme preset tiles (each a preview card)

```typescript
const CAPTION_PRESETS: CaptionPreset[] = [
  {
    id: "hormozi",
    name: "Hormozi",
    fontFamily: "Montserrat",
    fontWeight: "900",
    fontSize: 64,
    color: "#FFFFFF",
    activeColor: "#FFE500",
    outlineColor: "#000000",
    outlineWidth: 4,
    positionY: 78,
    animation: "highlight",
    groupSize: 3,
  },
  {
    id: "clean-minimal",
    name: "Clean Minimal",
    fontFamily: "Inter",
    fontWeight: "600",
    fontSize: 48,
    color: "#FFFFFF",
    outlineColor: "#000000",
    outlineWidth: 2,
    positionY: 82,
    animation: "none",
    groupSize: 5,
  },
  {
    id: "dark-box",
    name: "Dark Box",
    fontFamily: "Inter",
    fontWeight: "700",
    fontSize: 48,
    color: "#FFFFFF",
    backgroundColor: "rgba(0,0,0,0.75)",
    backgroundPadding: 12,
    backgroundRadius: 8,
    positionY: 80,
    animation: "none",
    groupSize: 4,
  },
  {
    id: "karaoke",
    name: "Karaoke",
    fontFamily: "Poppins",
    fontWeight: "800",
    fontSize: 56,
    color: "rgba(255,255,255,0.5)",
    activeColor: "#FFFFFF",
    outlineColor: "#000000",
    outlineWidth: 3,
    positionY: 78,
    animation: "karaoke",
    groupSize: 4,
  },
  {
    id: "bold-outline",
    name: "Bold Outline",
    fontFamily: "Montserrat",
    fontWeight: "900",
    fontSize: 60,
    color: "#FFFFFF",
    outlineColor: "#000000",
    outlineWidth: 5,
    positionY: 80,
    animation: "none",
    groupSize: 3,
  },
];
```

**Tab content:**
```tsx
<div className="grid grid-cols-2 gap-2 p-3">
  {CAPTION_PRESETS.map(preset => (
    <button key={preset.id} onClick={() => addCaptionClip(preset)}>
      <CaptionPresetTile preset={preset} />
    </button>
  ))}
</div>

<div className="border-t px-3 py-2">
  <Button variant="outline" onClick={autoGenerateCaptions} disabled={!hasVoiceover}>
    Auto-Generate from Voiceover
  </Button>
</div>
```

---

### 3.2 Caption in Inspector

**File:** `frontend/src/features/editor/components/Inspector.tsx`

When selected clip has `captionWords` or `captionStylePreset`, render a Caption section:

```tsx
{isCaptionClip(selectedClip) && (
  <InspectorSection title="Caption">
    {/* Style preset picker */}
    <div className="grid grid-cols-3 gap-1">
      {CAPTION_PRESETS.map(p => (
        <button
          key={p.id}
          className={cn("...", selectedClip.captionStylePreset === p.id && "ring-2 ring-blue-500")}
          onClick={() => updateClip(selectedClip.id, { captionStylePreset: p.id })}
        >
          {p.name}
        </button>
      ))}
    </div>
    {/* Group size */}
    <Select value={String(selectedClip.captionGroupSize ?? 3)}
            onValueChange={v => updateClip(selectedClip.id, { captionGroupSize: Number(v) })}>
      <SelectItem value="1">1 word</SelectItem>
      <SelectItem value="2">2 words</SelectItem>
      <SelectItem value="3">3 words</SelectItem>
      <SelectItem value="5">Full sentence</SelectItem>
    </Select>
    {/* Word list */}
    <CaptionWordList
      words={selectedClip.captionWords ?? []}
      onWordEdit={(idx, newWord) => updateCaptionWord(selectedClip.id, idx, newWord)}
      onWordClick={(idx) => seekTo(selectedClip.captionWords![idx].startMs + selectedClip.startMs)}
    />
  </InspectorSection>
)}
```

---

### 3.3 Backend: Caption Transcription Endpoint

**New file:** `backend/src/routes/captions/index.ts`

```typescript
import { Hono } from "hono";
import OpenAI from "openai";
import { db } from "../../infrastructure/database/drizzle";
import { captions, assets } from "../../infrastructure/database/drizzle/schema";

const captionsRouter = new Hono();

captionsRouter.post("/transcribe", requireAuth, async (c) => {
  const auth = c.get("auth");
  const { assetId } = await c.req.json();

  // Verify ownership
  const [asset] = await db
    .select()
    .from(assets)
    .where(and(eq(assets.id, assetId), eq(assets.userId, auth.user.id)))
    .limit(1);

  if (!asset) return c.json({ error: "Asset not found" }, 404);
  if (!asset.r2Key) return c.json({ error: "Asset has no audio file" }, 422);

  // Check for existing transcription
  const [existing] = await db
    .select()
    .from(captions)
    .where(eq(captions.assetId, assetId))
    .limit(1);

  if (existing) return c.json({ captionId: existing.id, words: existing.words });

  // Download audio from R2
  const audioBuffer = await downloadFromR2(asset.r2Key);

  // Call Whisper with word-level timestamps
  const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
  const transcription = await openai.audio.transcriptions.create({
    file: new File([audioBuffer], "audio.mp3", { type: "audio/mpeg" }),
    model: "whisper-1",
    response_format: "verbose_json",
    timestamp_granularities: ["word"],
  });

  // Normalize to { word, startMs, endMs }
  const words = (transcription.words ?? []).map(w => ({
    word: w.word,
    startMs: Math.round(w.start * 1000),
    endMs: Math.round(w.end * 1000),
  }));

  // Persist
  const [caption] = await db
    .insert(captions)
    .values({
      id: generateUlid(),
      userId: auth.user.id,
      assetId,
      language: "en",
      words,
      fullText: transcription.text,
      createdAt: new Date(),
    })
    .returning();

  return c.json({ captionId: caption.id, words });
});

export { captionsRouter };
```

Mount in `backend/src/index.ts`:
```typescript
app.route("/api/captions", captionsRouter);
```

---

### 3.4 Canvas Caption Preview

**New file:** `frontend/src/features/editor/hooks/useCaptionRenderer.ts`

```typescript
export function useCaptionRenderer(
  canvasRef: React.RefObject<HTMLCanvasElement>,
  tracks: Track[],
  currentTimeMs: number,
  presets: Record<string, CaptionPreset>,
) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const textTrack = tracks.find(t => t.type === "text");
    const captionClips = (textTrack?.clips ?? []).filter(
      c => c.captionWords?.length && c.startMs <= currentTimeMs && c.startMs + c.durationMs > currentTimeMs
    );

    for (const clip of captionClips) {
      const preset = presets[clip.captionStylePreset ?? "clean-minimal"];
      if (!preset || !clip.captionWords) continue;
      const relativeMs = currentTimeMs - clip.startMs;
      drawCaptions(ctx, clip.captionWords, relativeMs, preset, canvas.width, canvas.height);
    }
  }, [currentTimeMs, tracks]);
}

function drawCaptions(
  ctx: CanvasRenderingContext2D,
  words: CaptionWord[],
  currentMs: number,
  preset: CaptionPreset,
  w: number,
  h: number,
) {
  const activeIdx = words.findIndex(word => currentMs >= word.startMs && currentMs < word.endMs);
  if (activeIdx === -1) return;

  const groupStart = Math.floor(activeIdx / preset.groupSize) * preset.groupSize;
  const groupWords = words.slice(groupStart, groupStart + preset.groupSize);

  ctx.font = `${preset.fontWeight} ${preset.fontSize}px "${preset.fontFamily}"`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const y = h * (preset.positionY / 100);
  const text = groupWords.map(gw => gw.word).join(" ");
  const totalWidth = ctx.measureText(text).width;

  // Background box
  if (preset.backgroundColor) {
    const pad = preset.backgroundPadding ?? 8;
    ctx.fillStyle = preset.backgroundColor;
    roundRect(ctx, w / 2 - totalWidth / 2 - pad, y - preset.fontSize / 2 - pad,
              totalWidth + pad * 2, preset.fontSize + pad * 2, preset.backgroundRadius ?? 6);
    ctx.fill();
  }

  // Draw each word with active highlighting
  let xCursor = w / 2 - totalWidth / 2;
  for (const gw of groupWords) {
    const isActive = currentMs >= gw.startMs && currentMs < gw.endMs;
    const wordWidth = ctx.measureText(gw.word + " ").width;
    ctx.fillStyle = (isActive && preset.activeColor) ? preset.activeColor : preset.color;

    if (preset.outlineWidth && preset.outlineColor) {
      ctx.strokeStyle = preset.outlineColor;
      ctx.lineWidth = preset.outlineWidth;
      ctx.strokeText(gw.word, xCursor + wordWidth / 2, y);
    }
    ctx.fillText(gw.word, xCursor + wordWidth / 2, y);
    xCursor += wordWidth;
  }
}
```

**Wire into PreviewArea.tsx:**
```tsx
<canvas
  ref={captionCanvasRef}
  width={previewWidth}
  height={previewHeight}
  style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
/>
```

---

### 3.5 ASS Subtitle Export (Backend)

**New file:** `backend/src/routes/editor/services/generate-ass-subtitles.ts`

```typescript
export function generateASS(words: CaptionWord[], preset: CaptionPreset, resolution: [number, number]): string {
  const [W, H] = resolution;
  const colorHex = cssColorToASSBGR(preset.color);
  const outlineHex = preset.outlineColor ? cssColorToASSBGR(preset.outlineColor) : "&H00000000";
  const bold = preset.fontWeight === "900" || preset.fontWeight === "bold" ? 1 : 0;
  const marginV = Math.round(H * (1 - preset.positionY / 100));

  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: ${W}
PlayResY: ${H}
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Caption,${preset.fontFamily},${preset.fontSize},${colorHex},&H000000FF,${outlineHex},&H80000000,${bold},0,0,0,100,100,0,0,1,${preset.outlineWidth ?? 2},0,2,10,10,${marginV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  const groupSize = preset.groupSize;
  const events: string[] = [];

  for (let i = 0; i < words.length; i += groupSize) {
    const group = words.slice(i, i + groupSize);
    const startTime = formatASSTime(group[0].startMs);
    const endTime = formatASSTime(group[group.length - 1].endMs);

    let text: string;
    if (preset.animation === "karaoke" || preset.animation === "highlight") {
      // ASS karaoke tags: {\kN} where N is duration in centiseconds
      text = group.map((w, gi) => {
        const durCs = Math.round((w.endMs - w.startMs) / 10);
        return `{\\k${durCs}}${w.word}`;
      }).join(" ");
    } else {
      text = group.map(w => w.word).join(" ");
    }

    events.push(`Dialogue: 0,${startTime},${endTime},Caption,,0,0,0,,${text}`);
  }

  return header + events.join("\n");
}

function formatASSTime(ms: number): string {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const cs = Math.floor((ms % 1000) / 10);
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}

function cssColorToASSBGR(cssColor: string): string {
  // Convert #RRGGBB to &H00BBGGRR (ASS format)
  const hex = cssColor.replace("#", "");
  if (hex.length !== 6) return "&H00FFFFFF";
  const r = hex.slice(0, 2);
  const g = hex.slice(2, 4);
  const b = hex.slice(4, 6);
  return `&H00${b}${g}${r}`;
}
```

**In the export handler**, for clips with `captionWords`, generate the ASS file and pass to ffmpeg:

```typescript
// During export job processing:
const captionClips = getAllCaptionClips(editProject.tracks);
if (captionClips.length > 0) {
  const assContent = generateASS(
    captionClips[0].captionWords,
    CAPTION_PRESETS[captionClips[0].captionStylePreset ?? "clean-minimal"],
    [outW, outH],
  );
  const assPath = path.join(tmpDir, "captions.ass");
  await fs.writeFile(assPath, assContent, "utf-8");

  // Add to ffmpeg filtergraph: -vf "ass=captions.ass"
  filterArgs.push("-vf", `ass=${assPath}`);
}
```

---

## Phase 4 — Assembly System

### 4.1 POST /api/video/assemble — Remove FFmpeg, Upsert edit_project

**File:** `backend/src/routes/video/index.ts`

**Remove:** All ffmpeg concatenation logic from the assemble handler (~50-100 lines)
**Remove:** `assembled_video` asset creation from this path
**Keep:** Asset fetching, `buildInitialTimeline` call, `edit_project` upsert

```typescript
app.post("/assemble", requireAuth, async (c) => {
  const auth = c.get("auth");
  const { generatedContentId, preset = "standard" } = await c.req.json();

  // Fetch all assets for the content
  const contentAssets = await db.select().from(assets)
    .where(and(eq(assets.generatedContentId, generatedContentId), eq(assets.userId, auth.user.id)));

  // Build timeline using single canonical builder
  let tracks = await buildInitialTimeline(generatedContentId, auth.user.id);

  // Apply assembly preset modifier
  tracks = applyAssemblyPreset(tracks, preset);

  // Upsert edit_project
  const existing = await findExistingProject(generatedContentId, auth.user.id);
  let project: EditProject;
  if (existing) {
    [project] = await db.update(editProjects)
      .set({ tracks, status: "draft", updatedAt: new Date() })
      .where(eq(editProjects.id, existing.id))
      .returning();
  } else {
    [project] = await db.insert(editProjects)
      .values({ id: generateUlid(), userId: auth.user.id, generatedContentId, tracks, status: "draft", createdAt: new Date(), updatedAt: new Date() })
      .returning();
  }

  return c.json({
    editorProjectId: project.id,
    redirect: `/studio/editor?contentId=${generatedContentId}`,
  });
});
```

**File:** `backend/src/routes/editor/services/apply-assembly-preset.ts` (new)

```typescript
export function applyAssemblyPreset(tracks: Track[], preset: "standard" | "fast-cut" | "cinematic"): Track[] {
  if (preset === "fast-cut") {
    return applyFastCut(tracks);
  }
  if (preset === "cinematic") {
    return applyCinematic(tracks);
  }
  return tracks; // "standard" = no modification
}

function applyFastCut(tracks: Track[]): Track[] {
  const MAX_CLIP_MS = 3000;
  return tracks.map(track => {
    if (track.type !== "video") return track;
    let pos = 0;
    const trimmedLanes = (track.lanes ?? []).map(lane => ({
      ...lane,
      clips: lane.clips.map(clip => {
        const duration = Math.min(clip.durationMs, MAX_CLIP_MS);
        const adjusted = { ...clip, startMs: pos, durationMs: duration };
        pos += duration;
        return adjusted;
      }),
    }));
    return { ...track, lanes: trimmedLanes };
  });
}

function applyCinematic(tracks: Track[]): Track[] {
  const FADE_MS = 500;
  return tracks.map(track => {
    if (track.type !== "video") return track;
    const lanes = (track.lanes ?? []).map(lane => {
      const transitions: Transition[] = [];
      for (let i = 0; i < lane.clips.length - 1; i++) {
        transitions.push({
          id: generateUlid(),
          type: "fade",
          durationMs: FADE_MS,
          clipAId: lane.clips[i].id,
          clipBId: lane.clips[i + 1].id,
        });
      }
      return { ...lane, transitions };
    });
    return { ...track, lanes };
  });
}
```

---

### 4.2 Shot Order Panel (Frontend)

**New file:** `frontend/src/features/editor/components/timeline/ShotOrderPanel.tsx`

```tsx
// Drag-to-reorder list of shot thumbnails
// On reorder: dispatch REORDER_SHOTS action
// Action recalculates startMs for all video track clips to maintain sequential, gap-free layout

export function ShotOrderPanel({ tracks, dispatch }: Props) {
  const videoClips = getVideoTrackClips(tracks); // from lane 0

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const reordered = arrayMove(videoClips, result.source.index, result.destination.index);
    // Recalculate startMs
    let pos = 0;
    const repositioned = reordered.map(clip => {
      const c = { ...clip, startMs: pos };
      pos += clip.durationMs;
      return c;
    });
    dispatch({ type: "REPLACE_TRACK_CLIPS", trackType: "video", laneIndex: 0, clips: repositioned });
  };

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <Droppable droppableId="shots">
        {(provided) => (
          <div ref={provided.innerRef} {...provided.droppableProps}>
            {videoClips.map((clip, i) => (
              <Draggable key={clip.id} draggableId={clip.id} index={i}>
                {(provided) => (
                  <div ref={provided.innerRef} {...provided.draggableProps}>
                    <ShotThumbnail clip={clip} index={i} dragHandle={provided.dragHandleProps} />
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </DragDropContext>
  );
}
```

---

## Phase 5 — Effects and Transitions

### 5.1 Wire Effects Tab Presets

**File:** `frontend/src/features/editor/components/MediaPanel.tsx` (or wherever `applyEffect` lives)

The `applyEffect` function is currently a no-op. Wire it:

```typescript
// Before: applyEffect does nothing
// After:
const applyEffect = (effect: Effect) => {
  if (!selectedClipId) return;
  onUpdateClip(selectedClipId, {
    contrast: effect.contrast ?? 0,
    warmth: effect.warmth ?? 0,
    opacity: effect.opacity ?? 1,
  });
};
```

Pass `selectedClipId` and `onUpdateClip` down to the MediaPanel from EditorLayout.

---

### 5.2 Transition Data Model and Timeline UI

**Transition type additions** (in `editor.ts`):
```typescript
interface Transition {
  id: string;
  type: "fade" | "slide-left" | "slide-up" | "dissolve" | "wipe-right";
  durationMs: number;
  clipAId: string;
  clipBId: string;
}
```

**New reducer actions:**
```typescript
| { type: "ADD_TRANSITION"; transition: Omit<Transition, "id"> }
| { type: "UPDATE_TRANSITION"; transitionId: string; changes: Partial<Transition> }
| { type: "REMOVE_TRANSITION"; transitionId: string }
```

**Timeline rendering — diamond icon between adjacent clips:**
```tsx
// In the timeline, after rendering each clip, check for a transition between clip[i] and clip[i+1]
const transition = lane.transitions?.find(t => t.clipAId === clip.id);
if (transition) {
  <TransitionHandle
    transition={transition}
    xPos={clipEndPx - (transition.durationMs / 1000 * zoom) / 2}
    onSelect={() => setSelectedTransitionId(transition.id)}
  />
}
```

**ffmpeg xfade filtergraph** (in `build-ffmpeg-filtergraph.ts`):
```typescript
function buildXfadeFiltergraph(clips: Clip[], transitions: Transition[], resolution: [number, number]): string {
  // Track cumulative offset for each xfade offset parameter
  let outputLabel = "v0";
  let timeOffset = 0;
  const filters: string[] = [];

  for (let i = 0; i < clips.length - 1; i++) {
    const clip = clips[i];
    const nextClip = clips[i + 1];
    const transition = transitions.find(t => t.clipAId === clip.id && t.clipBId === nextClip.id);

    timeOffset += clip.durationMs / 1000;

    if (transition && transition.type !== "none") {
      const fadeDuration = transition.durationMs / 1000;
      const offset = timeOffset - fadeDuration;
      const nextLabel = `vx${i}${i + 1}`;
      filters.push(
        `[${outputLabel}][v${i + 1}]xfade=transition=${toXfadeType(transition.type)}:duration=${fadeDuration}:offset=${offset}[${nextLabel}]`
      );
      outputLabel = nextLabel;
      timeOffset -= fadeDuration; // transition overlaps — adjust cumulative time
    } else {
      // Simple concat for this pair
      outputLabel = `v${i + 1}`;
    }
  }

  return filters.join(";\n");
}

function toXfadeType(type: Transition["type"]): string {
  const map: Record<Transition["type"], string> = {
    "fade": "fade",
    "slide-left": "slideleft",
    "slide-up": "slideup",
    "dissolve": "dissolve",
    "wipe-right": "wiperight",
  };
  return map[type];
}
```

---

## File Change Summary

### New Files
| File | Purpose |
|---|---|
| `backend/src/routes/captions/index.ts` | Whisper transcription endpoint |
| `backend/src/routes/editor/services/generate-ass-subtitles.ts` | Caption → ASS format |
| `backend/src/routes/editor/services/apply-assembly-preset.ts` | Standard/FastCut/Cinematic preset modifiers |
| `frontend/src/features/editor/hooks/useWaveformCache.ts` | Web Audio waveform decode + cache |
| `frontend/src/features/editor/hooks/useSnapTargets.ts` | Snap target computation |
| `frontend/src/features/editor/hooks/useCaptionRenderer.ts` | Canvas caption draw loop |
| `frontend/src/features/editor/components/timeline/WaveformRenderer.tsx` | SVG waveform inside audio clips |
| `frontend/src/features/editor/components/timeline/SnapLine.tsx` | Vertical snap indicator |
| `frontend/src/features/editor/components/timeline/TransitionHandle.tsx` | Diamond icon between clips |
| `frontend/src/features/editor/components/timeline/ShotOrderPanel.tsx` | Drag-reorder shot thumbnails |

### Modified Files
| File | Change |
|---|---|
| `backend/src/infrastructure/database/drizzle/schema.ts` | Add status/publishedAt/parentProjectId to editProjects, add captions table, unique index |
| `backend/src/routes/video/index.ts` | Remove dual builder, remove ffmpeg from assemble, import single builder |
| `backend/src/routes/editor/index.ts` | Add upsert, publish, new-draft endpoints; enforce read-only on published |
| `backend/src/routes/editor/services/build-initial-timeline.ts` | Add missing role mappings, sort by shotIndex |
| `backend/src/routes/editor/services/build-ffmpeg-filtergraph.ts` | Add xfade transition support |
| `backend/src/routes/queue/index.ts` | LEFT JOIN edit_projects + export_jobs |
| `backend/src/index.ts` | Mount captionsRouter |
| `frontend/src/routes/studio/queue.tsx` | Add "Open in Editor" button, live editor/export state, wire AI chat link |
| `frontend/src/routes/studio/generate.tsx` | Accept and handle `?contentId` search param |
| `frontend/src/features/editor/types/editor.ts` | Add multi-lane Track, Transition, CaptionWord, CaptionPreset types |
| `frontend/src/features/editor/hooks/useEditorStore.ts` | Add SPLIT_CLIP, ADD_VIDEO_LANE, REORDER_SHOTS, ADD_TRANSITION actions |
| `frontend/src/features/editor/components/EditorLayout.tsx` | 9:16 default, `S` shortcut, pass selectedClipId to MediaPanel |
| `frontend/src/features/editor/components/PreviewArea.tsx` | 9:16 aspect ratio, add caption canvas overlay |
| `frontend/src/features/editor/components/Inspector.tsx` | Fix enabled/mute overflow, add caption section |
| `frontend/src/features/editor/components/MediaPanel.tsx` | Wire effects presets, rename Text→Caption tab, add 5 theme tiles |
| `frontend/src/features/editor/components/timeline/Timeline.tsx` | Multi-lane video section, snap line render, "Add Video Track" |
| `frontend/src/features/editor/components/timeline/TrackLane.tsx` | DnD drop target, collision detection |
| `frontend/src/features/editor/components/timeline/TimelineClip.tsx` | Waveform render, snapping during drag |
| `frontend/src/features/chat/components/ContentWorkspace.tsx` | Remove localStorage, use useVideoJob |
| `frontend/src/shared/lib/query-keys.ts` | Add editorProject key for cache invalidation |
