# Phase 5 LLD: Frontend Runtime Completion

> **Parent HLD:** [../hld-editor.md](../hld-editor.md)
> **Status:** Ready for implementation
> **Goal:** Wire Zustand stores + methods so every UI component reads real project state instead of hardcoded preview data. Patterns taken directly from `openreel-video/apps/web`.

---

## 1. Current Gap (Confirmed by Codebase Audit)

| Component | Current state |
|---|---|
| `Timeline.tsx` | Uses hardcoded `previewTracks` constant; all handlers `() => undefined` |
| `TimelineSection.tsx` | All zoom/sync toolbar callbacks `() => undefined` |
| `PlaybackBar.tsx` | Local `isPlaying` useState; never reads duration from project |
| `Inspector.tsx` | `selectedClipId: null` hardcoded; no clip data shown |
| `ExportModal.tsx` | Placeholder — no API calls, no progress |
| `EditorHeader.tsx` | Title input is `readOnly`; undo/redo buttons disabled; export is an unconnected stub |
| `EditorStatusBar.tsx` | Clip/track counts drilled as props from `EditorLayout` |
| `EditorProviders.tsx` | Dead wrapper — delete it; stores are module singletons |
| `EditorRoutePage.tsx` | `onSaveConflict` is a TODO comment |

**No Zustand stores exist.** `EditorState` and `EditorAction` types are defined in `model/`, but no store has been created. The `editor-core` package (`/packages/editor-core`) is NOT in the frontend's `package.json` — out of scope entirely.

**`model/editor.ts` exports `EditorAction` (a Redux-style action union) and `EditorState`.** These are dead code — nothing dispatches or reduces them. They contradict the project-wide Zustand migration ([frontend-zustand-migration.md](../frontend-zustand-migration.md)) and must be deleted in this phase.

---

## 2. Store Architecture

Follow the OpenReel pattern: **three focused stores, each with methods co-located, all module-level singletons using `subscribeWithSelector`**. No reducer, no dispatch, no React context.

```
openreel-video pattern          ContentAI equivalent
─────────────────────────────   ─────────────────────────────
useProjectStore                 useEditorProjectStore
useTimelineStore                useEditorTimelineStore
useUIStore                      useEditorUIStore
```

Bridges and services call `useXxxStore.getState().method()` imperatively — same as how `render-bridge.ts` calls `useProjectStore.getState().project`.

Autosave wiring: `useEditorProjectStore.subscribe(selector, callback)` via `subscribeWithSelector` — same pattern as `autoSaveManager` in `project-store.ts:2539`.

---

## 3. Scope

**In scope:**
- **Delete `model/editor.ts`** — removes the `EditorAction` union and `EditorState` composite type (dead reducer/dispatch artifacts)
- **Delete `model/editor-document.ts`, `model/editor-playback.ts`, `model/editor-ui.ts`** — state shapes are inlined into the three stores; these separate interface files are no longer needed
- Create `useEditorProjectStore`, `useEditorTimelineStore`, `useEditorUIStore`
- Wire bridge callbacks in `EditorRoutePage` to call store methods
- Subscribe to project store changes for autosave (forwarded to `EditorBridge.notifyStateChanged`)
- Connect all stub UI components to real store state
- Implement `ExportModal` with real API calls + progress polling
- Add `startExport` and `getExportStatus` to `editor-api.ts`

**Out of scope:**
- `editor-core` package integration
- Playback preview rendering (canvas / frame decode)
- Drag-to-trim / drag-to-move implementation
- Undo/redo history (`undo()`/`redo()` are stubs — `past`/`future` stay empty arrays)
- Collaboration / offline sync

---

## 4. Reducer/Dispatch Purge (Delete First)

### Why this pattern is wrong here

`model/editor.ts` introduced a Redux-style `EditorAction` discriminated union with 40+ variants and an `EditorState` composite type — the same pattern you'd use if you were calling `useReducer`. **This contradicts the project-wide Zustand migration** ([frontend-zustand-migration.md](../frontend-zustand-migration.md)) whose explicit goal is to stop using context + reducer patterns for shared state.

The problems:

- **Indirection with no benefit.** `dispatch({ type: "TOGGLE_TRACK_MUTE", trackId })` is strictly worse than calling `useEditorProjectStore.getState().toggleTrackMute(trackId)`. You gain a string-keyed action type that TypeScript can't autocomplete at the call site, a switch statement to maintain, and no additional testability.
- **It was never wired.** The action union is dead code — nothing in the codebase dispatches or reduces it. It exists purely as a blueprint that would have pulled the editor toward a Redux architecture the project is actively moving away from.
- **The correct alternative is already proven.** OpenReel's editor (`openreel-video/apps/web`) uses `useProjectStore`, `useTimelineStore`, and `useUIStore` — all Zustand stores with methods co-located. `moveClip(clipId, startMs)` is a method on the store. No action type, no switch case, no dispatch call anywhere.

### 4.1 Delete `model/editor.ts`

This file exports:
- `EditorAction` — 40-variant Redux-style action union (never dispatched)
- `EditorState` — composite type alias over three sub-interfaces (never instantiated)
- Re-exports from `editor-domain` — move any needed re-exports to the store files directly

**Delete the file.** Any `import ... from "../../model/editor"` that only imported domain types should be redirected to `"../../model/editor-domain"`.

### 4.2 Delete `model/editor-document.ts`, `model/editor-playback.ts`, `model/editor-ui.ts`

These interfaces were the "shape" for a reducer's state slices. State shape now lives inline in each store (sections 5.1–5.3). Delete all three files.

Exception: `model/editor-domain.ts` stays — it defines the domain value types (`Track`, `Clip`, `EditProject`, `Transition`, `ExportJobStatus`, etc.) used by stores, the bridge, and the API layer.

### 4.3 Fix import fallout

After deleting the files, grep for remaining imports and redirect:

```bash
# Find all consumers
rg "from ['\"].*model/editor['\"]" frontend/src --include="*.ts" --include="*.tsx"
```

Expected consumers: `EditorRoutePage`, `EditorLayout`, `EditorWorkspace`, bridge files, a few UI components. All should move to either `model/editor-domain` (for type imports) or the new store files (for state/methods).

---

## 5. Files to Create

### 5.1 `store/editor-project-store.ts`

```typescript
import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import type { Clip, ClipPatch, EditProject, Track } from "../model/editor-domain";
import type { EditorHistorySnapshot } from "../model/editor-domain";

export interface EditorProjectState {
  editProjectId: string | null;
  title: string;
  durationMs: number;
  fps: number;
  resolution: string;
  saveRevision: number;
  createdAt: string;
  tracks: Track[];
  clipboardClip: Clip | null;
  clipboardSourceTrackId: string | null;
  past: EditorHistorySnapshot[];
  future: EditorHistorySnapshot[];
  isReadOnly: boolean;

  loadProject: (project: EditProject) => void;
  updateSaveRevision: (saveRevision: number) => void;
  setReadOnly: () => void;
  setTitle: (title: string) => void;
  setResolution: (resolution: string) => void;
  setFps: (fps: number) => void;
  updateClip: (clipId: string, patch: ClipPatch) => void;
  toggleClipEnabled: (clipId: string) => void;
  removeClip: (clipId: string) => void;
  moveClip: (clipId: string, startMs: number) => void;
  toggleTrackMute: (trackId: string) => void;
  toggleTrackLock: (trackId: string) => void;
  renameTrack: (trackId: string, name: string) => void;
  mergeTracksFromServer: (tracks: Track[]) => void;
  copyClip: (clipId: string) => void;
  undo: () => void;
  redo: () => void;
  reset: () => void;
}

export const useEditorProjectStore = create<EditorProjectState>()(
  subscribeWithSelector((set, get) => ({
    editProjectId: null,
    title: "Untitled Edit",
    durationMs: 0,
    fps: 30,
    resolution: "1080x1920",
    saveRevision: 0,
    createdAt: "",
    tracks: [],
    clipboardClip: null,
    clipboardSourceTrackId: null,
    past: [],
    future: [],
    isReadOnly: false,

    loadProject: (project) =>
      set({
        editProjectId: project.id,
        title: project.title ?? "Untitled Edit",
        tracks: project.tracks,
        durationMs: project.durationMs,
        fps: project.fps,
        resolution: project.resolution,
        saveRevision: project.saveRevision,
        createdAt: project.createdAt,
        isReadOnly: project.status === "published",
        past: [],
        future: [],
        clipboardClip: null,
        clipboardSourceTrackId: null,
      }),

    updateSaveRevision: (saveRevision) => set({ saveRevision }),

    setReadOnly: () => set({ isReadOnly: true }),

    setTitle: (title) => set({ title }),

    setResolution: (resolution) => set({ resolution }),

    setFps: (fps) => set({ fps }),

    updateClip: (clipId, patch) =>
      set((s) => ({ tracks: updateClipInTracks(s.tracks, clipId, patch) })),

    toggleClipEnabled: (clipId) =>
      set((s) => ({
        tracks: updateClipInTracks(s.tracks, clipId, (c) => ({
          enabled: !("enabled" in c && c.enabled),
        })),
      })),

    removeClip: (clipId) =>
      set((s) => ({
        tracks: s.tracks.map((t) => ({
          ...t,
          clips: t.clips.filter((c) => c.id !== clipId),
        })),
      })),

    moveClip: (clipId, startMs) =>
      set((s) => ({ tracks: updateClipInTracks(s.tracks, clipId, { startMs }) })),

    toggleTrackMute: (trackId) =>
      set((s) => ({
        tracks: s.tracks.map((t) =>
          t.id === trackId ? { ...t, muted: !t.muted } : t,
        ),
      })),

    toggleTrackLock: (trackId) =>
      set((s) => ({
        tracks: s.tracks.map((t) =>
          t.id === trackId ? { ...t, locked: !t.locked } : t,
        ),
      })),

    renameTrack: (trackId, name) =>
      set((s) => ({
        tracks: s.tracks.map((t) =>
          t.id === trackId ? { ...t, name } : t,
        ),
      })),

    mergeTracksFromServer: (fresh) =>
      set((s) => ({ tracks: mergeTracks(s.tracks, fresh) })),

    copyClip: (clipId) => {
      const { tracks } = get();
      const clip = tracks.flatMap((t) => t.clips).find((c) => c.id === clipId) ?? null;
      const trackId = tracks.find((t) => t.clips.some((c) => c.id === clipId))?.id ?? null;
      if (clip) set({ clipboardClip: clip, clipboardSourceTrackId: trackId });
    },

    undo: () => undefined, // stub — history not implemented in this phase
    redo: () => undefined,

    reset: () =>
      set({
        editProjectId: null,
        title: "Untitled Edit",
        tracks: [],
        durationMs: 0,
        saveRevision: 0,
        past: [],
        future: [],
        isReadOnly: false,
        clipboardClip: null,
        clipboardSourceTrackId: null,
      }),
  })),
);

// ── Helpers ───────────────────────────────────────────────────────────────────

function updateClipInTracks(
  tracks: Track[],
  clipId: string,
  patch: Partial<Clip> | ((clip: Clip) => Partial<Clip>),
): Track[] {
  return tracks.map((track) => ({
    ...track,
    clips: track.clips.map((clip) => {
      if (clip.id !== clipId) return clip;
      const p = typeof patch === "function" ? patch(clip) : patch;
      return { ...clip, ...p } as Clip;
    }),
  }));
}

function mergeTracks(existing: Track[], fresh: Track[]): Track[] {
  const freshMap = new Map(fresh.map((t) => [t.id, t]));
  const merged = existing.map((t) => freshMap.get(t.id) ?? t);
  const existingIds = new Set(existing.map((t) => t.id));
  return [...merged, ...fresh.filter((t) => !existingIds.has(t.id))];
}
```

### 5.2 `store/editor-timeline-store.ts`

Mirrors `openreel-video` `useTimelineStore` — same method names, same clamping logic.

```typescript
import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";

export interface EditorTimelineState {
  currentTimeMs: number;
  isPlaying: boolean;
  playbackRate: number;
  zoom: number; // pixels per second (matches OpenReel pixelsPerSecond)

  play: () => void;
  pause: () => void;
  togglePlayback: () => void;
  seekTo: (ms: number) => void;
  seekToStart: () => void;
  seekToEnd: (durationMs: number) => void;
  setPlaybackRate: (rate: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  setZoom: (zoom: number) => void;
  zoomToFit: (durationMs: number, viewportWidthPx: number) => void;
  reset: () => void;
}

const ZOOM_MIN = 20;
const ZOOM_MAX = 400;
const ZOOM_DEFAULT = 80;

export const useEditorTimelineStore = create<EditorTimelineState>()(
  subscribeWithSelector((set, get) => ({
    currentTimeMs: 0,
    isPlaying: false,
    playbackRate: 1,
    zoom: ZOOM_DEFAULT,

    play: () => set({ isPlaying: true }),
    pause: () => set({ isPlaying: false }),
    togglePlayback: () => set((s) => ({ isPlaying: !s.isPlaying })),
    seekTo: (ms) => set({ currentTimeMs: Math.max(0, ms) }),
    seekToStart: () => set({ currentTimeMs: 0 }),
    seekToEnd: (durationMs) => set({ currentTimeMs: durationMs }),
    setPlaybackRate: (rate) =>
      set({ playbackRate: Math.max(0.1, Math.min(4.0, rate)) }),

    zoomIn: () =>
      set((s) => ({ zoom: Math.min(s.zoom * 1.25, ZOOM_MAX) })),
    zoomOut: () =>
      set((s) => ({ zoom: Math.max(s.zoom / 1.25, ZOOM_MIN) })),
    setZoom: (zoom) =>
      set({ zoom: Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoom)) }),
    zoomToFit: (durationMs, viewportWidthPx) => {
      if (durationMs > 0) {
        const zoom = Math.max(
          ZOOM_MIN,
          Math.min(ZOOM_MAX, (viewportWidthPx - 100) / (durationMs / 1000)),
        );
        set({ zoom });
      }
    },

    reset: () =>
      set({ currentTimeMs: 0, isPlaying: false, playbackRate: 1, zoom: ZOOM_DEFAULT }),
  })),
);
```

### 5.3 `store/editor-ui-store.ts`

```typescript
import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import type { ExportJobStatus } from "../model/editor-domain";

export interface EditorUIState {
  selectedClipId: string | null;
  exportModalOpen: boolean;
  exportJobId: string | null;
  exportStatus: ExportJobStatus | null;

  selectClip: (clipId: string | null) => void;
  openExportModal: () => void;
  closeExportModal: () => void;
  setExportJob: (jobId: string | null) => void;
  setExportStatus: (status: ExportJobStatus | null) => void;
  reset: () => void;
}

export const useEditorUIStore = create<EditorUIState>()(
  subscribeWithSelector((set) => ({
    selectedClipId: null,
    exportModalOpen: false,
    exportJobId: null,
    exportStatus: null,

    selectClip: (clipId) => set({ selectedClipId: clipId }),
    openExportModal: () => set({ exportModalOpen: true }),
    closeExportModal: () =>
      set({ exportModalOpen: false, exportStatus: null, exportJobId: null }),
    setExportJob: (jobId) => set({ exportJobId: jobId }),
    setExportStatus: (status) => set({ exportStatus: status }),
    reset: () =>
      set({ selectedClipId: null, exportModalOpen: false, exportJobId: null, exportStatus: null }),
  })),
);
```

---

## 6. Files to Modify

### 6.1 `bridge/editor-api.ts`

Add two methods:

```typescript
startExport(
  projectId: string,
  opts: { resolution?: string; fps?: number },
): Promise<{ exportJobId: string; projectRevisionId: string }> {
  return authenticatedFetchJson(`/api/editor/${projectId}/export`, {
    method: "POST",
    body: JSON.stringify(opts),
  });
},

getExportStatus(projectId: string): Promise<ExportJobStatus> {
  return authenticatedFetchJson<ExportJobStatus>(
    `/api/editor/${projectId}/export/status`,
  );
},
```

Import `ExportJobStatus` from `../model/editor-domain`.

### 6.2 `ui/layout/EditorRoutePage.tsx`

Replace `activeProject` local state with `isReady` boolean. Wire bridge callbacks to store methods. Set up autosave subscription.

```typescript
import { useEffect, useState } from "react";
import { EditorLayout } from "./EditorLayout";
import { EditorProjectList } from "./EditorProjectList";
import { getEditorBridge, disposeEditorBridge } from "../../bridge";
import { useEditorProjectStore } from "../../store/editor-project-store";
import { useEditorTimelineStore } from "../../store/editor-timeline-store";
import { useEditorUIStore } from "../../store/editor-ui-store";

export function EditorRoutePage({ search }: { search: EditorRouteSearch }) {
  const [openProjectId, setOpenProjectId] = useState<string | null>(
    search.projectId ?? null,
  );
  const [isReady, setIsReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!openProjectId) {
      setIsReady(false);
      return;
    }

    setIsReady(false);
    setLoadError(null);

    const bridge = getEditorBridge();

    bridge.initialize(openProjectId, {
      onProjectLoaded: (project) => {
        useEditorProjectStore.getState().loadProject(project);
        useEditorTimelineStore.getState().reset();
        useEditorUIStore.getState().reset();

        // Forward project mutations to bridge for autosave.
        // Uses subscribeWithSelector to detect only track/title/duration changes
        // — same pattern as project-store.ts:2539 in openreel-video.
        useEditorProjectStore.subscribe(
          (s) => ({ tracks: s.tracks, title: s.title, durationMs: s.durationMs }),
          () => {
            const s = useEditorProjectStore.getState();
            bridge.notifyStateChanged({
              tracks: s.tracks,
              durationMs: s.durationMs,
              title: s.title,
              fps: s.fps,
              resolution: s.resolution,
              saveRevision: s.saveRevision,
              createdAt: s.createdAt,
            });
          },
        );

        setIsReady(true);
      },

      onSaveRevisionUpdated: (saveRevision) => {
        useEditorProjectStore.getState().updateSaveRevision(saveRevision);
      },

      onSaveConflict: () => {
        useEditorProjectStore.getState().setReadOnly();
      },

      onLoadError: (err) => setLoadError(err.message),
    });

    return () => {
      disposeEditorBridge();
      useEditorProjectStore.getState().reset();
      useEditorTimelineStore.getState().reset();
      useEditorUIStore.getState().reset();
      setIsReady(false);
    };
  }, [openProjectId]);

  if (openProjectId && !isReady && !loadError) {
    return (
      <div className="fixed inset-0 z-50 bg-studio-bg flex items-center justify-center text-dim-3 text-sm">
        Loading…
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="fixed inset-0 z-50 bg-studio-bg flex items-center justify-center text-red-400 text-sm">
        {loadError}
      </div>
    );
  }

  if (isReady) {
    return (
      <div className="fixed inset-0 z-50 bg-studio-bg flex flex-col overflow-hidden">
        <EditorLayout
          onBack={() => {
            disposeEditorBridge();
            useEditorProjectStore.getState().reset();
            useEditorTimelineStore.getState().reset();
            useEditorUIStore.getState().reset();
            setOpenProjectId(null);
            setIsReady(false);
          }}
        />
      </div>
    );
  }

  return <EditorProjectList onOpen={(id) => setOpenProjectId(id)} />;
}
```

### 6.3 Delete `ui/layout/EditorProviders.tsx`

There is no context to provide. The three editor stores are Zustand module singletons, and every component reads them directly. `EditorProviders` would be a dead wrapper that suggests a provider architecture still exists when it does not.

**Delete the file.** Remove its import from `EditorLayout` and render the layout tree directly.

### 6.4 `ui/layout/EditorLayout.tsx`

Remove `project` prop and remove the `EditorProviders` wrapper entirely — components read from stores directly.

```typescript
interface Props { onBack: () => void; }

export function EditorLayout({ onBack }: Props) {
  return (
    <div className="flex flex-col bg-studio-bg overflow-hidden min-w-0 w-full" style={{ height: "100%" }}>
      <EditorHeader onBack={onBack} />
      <EditorWorkspace />
      <TimelineSection />
      <EditorStatusBar />
      <EditorDialogs />
    </div>
  );
}
```

### 6.5 `ui/layout/EditorWorkspace.tsx`

Remove `project` prop.

```typescript
export function EditorWorkspace() {
  const generatedContentId = useEditorProjectStore((s) => s.editProjectId);
  return (
    <div className="flex flex-1 overflow-hidden min-h-0">
      <LeftPanel generatedContentId={null} />
      <PreviewArea />
      <Inspector />
    </div>
  );
}
```

`PreviewArea` reads resolution/durationMs from stores.

### 6.6 `ui/layout/EditorHeader.tsx`

Wire title, save status, undo/redo, export button.

```typescript
export function EditorHeader({ onBack }: { onBack?: () => void }) {
  const title = useEditorProjectStore((s) => s.title);
  const isReadOnly = useEditorProjectStore((s) => s.isReadOnly);
  const canUndo = useEditorProjectStore((s) => s.past.length > 0);
  const canRedo = useEditorProjectStore((s) => s.future.length > 0);
  const { setTitle, undo, redo } = useEditorProjectStore.getState();
  const openExportModal = useEditorUIStore((s) => s.openExportModal);

  // ... same JSX, replace stubs:
  // title input: value={title}, onChange={(e) => setTitle(e.target.value)}
  // undo: disabled={!canUndo}, onClick={undo}
  // redo: disabled={!canRedo}, onClick={redo}
  // export button: onClick={openExportModal}
}
```

### 6.7 `ui/layout/EditorStatusBar.tsx`

Remove props — read from stores.

```typescript
export function EditorStatusBar() {
  const tracks = useEditorProjectStore((s) => s.tracks);
  const resolution = useEditorProjectStore((s) => s.resolution);
  const fps = useEditorProjectStore((s) => s.fps);
  const clipCount = tracks.reduce((n, t) => n + t.clips.length, 0);
  // ... same JSX
}
```

### 6.8 `ui/timeline/Timeline.tsx`

Replace hardcoded `previewTracks`. Wire all handlers to store methods.

```typescript
export function Timeline({ scrollRef }: { scrollRef?: RefObject<HTMLDivElement | null> }) {
  const tracks = useEditorProjectStore((s) => s.tracks);
  const durationMs = useEditorProjectStore((s) => s.durationMs);
  const zoom = useEditorTimelineStore((s) => s.zoom);
  const currentTimeMs = useEditorTimelineStore((s) => s.currentTimeMs);
  const selectedClipId = useEditorUIStore((s) => s.selectedClipId);
  const clipboardClip = useEditorProjectStore((s) => s.clipboardClip);

  const { toggleTrackMute, toggleTrackLock, renameTrack, removeClip, moveClip,
          toggleClipEnabled, copyClip } = useEditorProjectStore.getState();
  const { seekTo } = useEditorTimelineStore.getState();
  const { selectClip } = useEditorUIStore.getState();

  // Remove previewTracks constant and Props interface tracks? optional field.
  // TrackHeader: onToggleMute, onToggleLock, onRename wired.
  // TimelineClip: onSelect={selectClip}, onMove, onToggleEnabled, onDelete={removeClip}, onCopy={copyClip}
  //               isSelected={clip.id === selectedClipId}, hasClipboard={clipboardClip !== null}
  // TimelineRuler: onSeek={seekTo}
  // Playhead: currentTimeMs, zoom
}
```

Delete the `previewTracks` constant. Remove `tracks?`, `durationMs?`, `zoom?` from `Props` (all from stores now).

### 6.9 `ui/timeline/TimelineSection.tsx`

Wire zoom methods.

```typescript
export function TimelineSection() {
  const { zoomIn, zoomOut, setZoom } = useEditorTimelineStore.getState();
  const [snap, setSnap] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <div style={{ height: 340 }} className="flex flex-col shrink-0">
      <TimelineToolstrip
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onZoomFit={() => setZoom(80)}
        onSyncTimeline={() => undefined}
        snap={snap}
        onSnapChange={setSnap}
      />
      <div className="flex-1 overflow-hidden">
        <Timeline scrollRef={scrollRef} />
      </div>
    </div>
  );
}
```

### 6.10 `ui/preview/PlaybackBar.tsx`

Replace local `isPlaying` useState with store. Remove `durationMs`/`fps` props.

```typescript
export function PlaybackBar() {
  const isPlaying = useEditorTimelineStore((s) => s.isPlaying);
  const currentTimeMs = useEditorTimelineStore((s) => s.currentTimeMs);
  const durationMs = useEditorProjectStore((s) => s.durationMs);
  const fps = useEditorProjectStore((s) => s.fps);
  const { play, pause, togglePlayback, seekToStart, seekToEnd } =
    useEditorTimelineStore.getState();

  // play/pause button: onClick={togglePlayback}
  // jump-start: onClick={seekToStart}
  // jump-end: onClick={() => seekToEnd(durationMs)}
  // timecode: formatHHMMSSFF(currentTimeMs, fps) / formatHHMMSSFF(durationMs, fps)
  // volume: keep local useState (master volume is UI-only, not persisted)
}
```

### 6.11 `ui/inspector/Inspector.tsx`

Wire selected clip to real data. Pass real values to `AdjustTab`.

```typescript
export function Inspector() {
  const selectedClipId = useEditorUIStore((s) => s.selectedClipId);
  const tracks = useEditorProjectStore((s) => s.tracks);
  const { updateClip } = useEditorProjectStore.getState();
  const [activeTab, setActiveTab] = useState<InspectorTab>("adjust");

  const selectedClip = selectedClipId
    ? tracks.flatMap((t) => t.clips).find((c) => c.id === selectedClipId) ?? null
    : null;
  const selectedTrack = selectedClipId
    ? tracks.find((t) => t.clips.some((c) => c.id === selectedClipId)) ?? null
    : null;

  return (
    // ...
    // InspectorHeader: selectedClipLabel={selectedClip?.label ?? null}, selectedTrack
    // AdjustTab: pass selectedClip values; onChange → updateClip(selectedClipId, patch)
  );
}
```

**`AdjustTab` — real values example:**
```typescript
<InspectorSliderRow
  label={t("editor_opacity_label")}
  value={selectedClip && "opacity" in selectedClip ? selectedClip.opacity * 100 : 100}
  min={0}
  max={100}
  step={1}
  onChange={(v) =>
    selectedClipId &&
    updateClip(selectedClipId, { opacity: v / 100 })
  }
/>
```

### 6.12 `ui/dialogs/ExportModal.tsx`

Full implementation. Export progress state is local (same as OpenReel `Toolbar.tsx` pattern — local `exportState` useState, synced to global store for status bar).

```typescript
import { useState, useEffect, useRef } from "react";
import { useEditorProjectStore } from "../../store/editor-project-store";
import { useEditorUIStore } from "../../store/editor-ui-store";
import { editorApi } from "../../bridge/editor-api";
import { ResolutionPicker } from "./ResolutionPicker";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/shared/ui/primitives/dialog";
import type { ExportJobStatus } from "../../model/editor-domain";

const POLL_MS = 2000;

export function ExportModal() {
  const exportModalOpen = useEditorUIStore((s) => s.exportModalOpen);
  const projectId = useEditorProjectStore((s) => s.editProjectId);
  const defaultResolution = useEditorProjectStore((s) => s.resolution);
  const defaultFps = useEditorProjectStore((s) => s.fps);
  const { closeExportModal, setExportStatus } = useEditorUIStore.getState();

  const [resolution, setResolution] = useState(defaultResolution);
  const [fps, setFps] = useState(defaultFps);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [exportState, setExportState] = useState<ExportJobStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Sync local export state to global store (so status bar can show progress)
  useEffect(() => {
    setExportStatus(exportState);
  }, [exportState, setExportStatus]);

  // Poll while active
  useEffect(() => {
    if (!projectId) return;
    const active =
      exportState?.status === "queued" || exportState?.status === "rendering";
    if (!active) {
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }
    pollRef.current = setInterval(async () => {
      try {
        const status = await editorApi.getExportStatus(projectId);
        setExportState(status);
        if (status.status === "done" || status.status === "failed") {
          clearInterval(pollRef.current!);
        }
      } catch {
        // silent retry next poll
      }
    }, POLL_MS);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [exportState?.status, projectId]);

  async function handleStartExport() {
    if (!projectId) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await editorApi.startExport(projectId, { resolution, fps });
      setExportState({ status: "queued", progress: 0 });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleClose() {
    if (exportState?.status === "queued" || exportState?.status === "rendering") return;
    setExportState(null);
    closeExportModal();
  }

  const isActive =
    exportState?.status === "queued" || exportState?.status === "rendering";
  const isDone = exportState?.status === "done";

  return (
    <Dialog open={exportModalOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Export Video</DialogTitle>
        </DialogHeader>

        {!isActive && !isDone && (
          <div className="flex flex-col gap-4 pt-2">
            <ResolutionPicker value={resolution} onChange={setResolution} />
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button onClick={handleStartExport} disabled={isSubmitting}>
              {isSubmitting ? "Starting…" : "Export"}
            </button>
          </div>
        )}

        {isActive && (
          <div className="flex flex-col gap-2 pt-2">
            <p className="text-sm text-dim-2">
              {exportState?.progressPhase ?? "Rendering…"}
            </p>
            <div className="h-2 bg-overlay-sm rounded-full overflow-hidden">
              <div
                className="h-full bg-studio-accent transition-all"
                style={{ width: `${exportState?.progress ?? 0}%` }}
              />
            </div>
            <p className="text-xs text-dim-3">{exportState?.progress ?? 0}%</p>
          </div>
        )}

        {isDone && exportState?.r2Url && (
          <div className="flex flex-col gap-2 pt-2">
            <p className="text-sm text-green-400">Export complete!</p>
            <a href={exportState.r2Url} download className="text-studio-accent underline text-sm">
              Download video
            </a>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

### 6.13 `ui/dialogs/EditorDialogs.tsx`

`ExportModal` reads from stores directly — no props needed.

```typescript
export function EditorDialogs() {
  return <ExportModal />;
}
```

---

## 7. Data Flow Diagrams

### Autosave

```
User moves a clip
  → useEditorProjectStore.getState().moveClip(clipId, startMs)
  → Zustand set() → tracks reference changes
  → subscribeWithSelector callback fires (EditorRoutePage useEffect)
  → bridge.notifyStateChanged({ tracks, durationMs, title, ... })
  → EditorBridge debounces 2s → flushAutosave()
  → PATCH /api/editor/:id
  ← { saveRevision: n+1 }
  → bridge.onSaveRevisionUpdated(n+1)
  → useEditorProjectStore.getState().updateSaveRevision(n+1)
```

### Export

```
User clicks "Export" in EditorHeader
  → useEditorUIStore.getState().openExportModal()
  → ExportModal renders (open=true)

User picks settings, clicks "Export"
  → editorApi.startExport(projectId, { resolution, fps })
  ← { exportJobId, projectRevisionId }
  → setExportState({ status: "queued", progress: 0 })

Poll every 2s:
  → editorApi.getExportStatus(projectId)
  → setExportState({ status: "rendering", progress: 45, progressPhase: "encoding" })

status === "done":
  → setExportState({ ..., r2Url: "..." })
  → ExportModal shows download link, poll stops
```

---

## 8. Validation Checklist

- [ ] `model/editor.ts` is deleted — `rg "from.*model/editor['\"]"` returns 0 results
- [ ] `model/editor-document.ts`, `model/editor-playback.ts`, `model/editor-ui.ts` are deleted
- [ ] `rg "EditorAction|useReducer|dispatch\(" frontend/src/domains/creation/editor` returns 0 results
- [ ] Opening a project shows real tracks in Timeline (not hardcoded `previewTracks`)
- [ ] Moving/toggling a clip triggers autosave within 2s (check Network tab)
- [ ] Save revision increments in store after each autosave (Zustand devtools)
- [ ] Concurrent-save conflict (two tabs, edit both) renders editor read-only on losing tab
- [ ] Play/Pause in PlaybackBar reads `isPlaying` from `useEditorTimelineStore`
- [ ] Zoom in/out buttons change timeline scale
- [ ] Selecting a clip in Timeline sets `selectedClipId` in `useEditorUIStore`
- [ ] Inspector AdjustTab shows real opacity/contrast/warmth for selected clip
- [ ] Changing a slider in Inspector calls `updateClip` and the Timeline clip reflects it
- [ ] EditorHeader title input is editable; change triggers autosave
- [ ] EditorStatusBar shows real clip and track counts
- [ ] Clicking "Export" opens the modal
- [ ] Export progress bar updates every 2s
- [ ] Export "done" shows download link
- [ ] Closing editor and reopening a different project resets all three stores (no stale data)

---

## 9. Rollback

All changes are additive except deleting dead reducer types and the dead `EditorProviders` wrapper. To revert: restore `previewTracks` in `Timeline.tsx`, restore `isPlaying` local state in `PlaybackBar.tsx`, recreate `EditorProviders` only if a real provider layer returns, and remove the three store files. No database migrations involved.
