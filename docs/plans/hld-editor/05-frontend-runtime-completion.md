# Phase 5 LLD: Frontend Runtime Completion

> **Parent HLD:** [../hld-editor.md](../hld-editor.md)
> **Status:** Ready for implementation
> **Goal:** Wire the editor Zustand store + reducer so every UI component reads real project state instead of hardcoded preview data.

---

## 1. Current Gap (Confirmed by Codebase Audit)

| Component | Current state |
|---|---|
| `Timeline.tsx` | Uses hardcoded `previewTracks` constant; all handlers `() => undefined` |
| `TimelineSection.tsx` | All zoom/sync toolbar callbacks `() => undefined` |
| `PlaybackBar.tsx` | Local `isPlaying` useState; never reads duration from project |
| `Inspector.tsx` | `selectedClipId: null` hardcoded; no clip data shown |
| `ExportModal.tsx` | Placeholder — no API calls, no progress |
| `EditorHeader.tsx` | Title input is `readOnly`; undo/redo buttons disabled; export button is an unconnected stub |
| `EditorStatusBar.tsx` | Clip/track counts drilled from `project` prop in `EditorLayout`; doesn't read from store |
| `EditorProviders.tsx` | Passthrough — does nothing (`return <>{children}</>`) |
| `EditorRoutePage.tsx` | Bridge loaded, but `onSaveConflict` is a TODO comment |

**`editor-core` package** (`/packages/editor-core`): NOT imported by the frontend. Not in `package.json`. Out of scope for this phase entirely.

**No Zustand store exists.** `EditorState` and `EditorAction` types are defined in `model/`, but no store, no reducer, no context has been created.

---

## 2. Scope

**In scope:**
- Create a Zustand store + reducer covering all `EditorAction` types
- Wire bridge callbacks in `EditorRoutePage` to dispatch into the store
- Connect all stub UI components to real store state
- Implement `ExportModal` with real API calls + progress polling
- Add `SAVE_REVISION_UPDATED` action to `EditorAction`
- Add `createdAt` field to `EditorDocumentState` (required by bridge autosave)
- Add `startExport` and `getExportStatus` to `editor-api.ts`

**Out of scope:**
- `editor-core` package integration
- Playback preview rendering (canvas / frame decode)
- Drag-to-trim / drag-to-move clip implementation
- Undo/redo history (wire the `UNDO`/`REDO` actions but skip the snapshot logic — `past`/`future` stay empty arrays for now)
- Collaboration / offline sync
- Visual redesign

---

## 3. Architecture

### Store ownership model

A **module-level singleton store** (same pattern as the bridge). Created once per project session, destroyed when the user closes the editor.

```
EditorRoutePage
  ├── bridge.initialize() → onProjectLoaded → initEditorStore(project)
  │                                         → store.subscribe() → bridge.notifyStateChanged()
  ├── onSaveRevisionUpdated → getEditorStore().dispatch(SAVE_REVISION_UPDATED)
  ├── onSaveConflict        → getEditorStore().dispatch(SAVE_CONFLICT_DETECTED)
  └── renders EditorLayout (only after store is ready)
        └── EditorProviders (provides store via context for hook access)
              └── all child components → useEditorStore(selector)
```

### Data ownership summary

| Layer | Owns |
|---|---|
| `editor-store.ts` singleton | All persisted editor state (tracks, title, playback, UI selection, export) |
| `EditorBridge` singleton | API transport: load, autosave, export trigger, revision tracking |
| React components | Read from store via selector; dispatch actions; no local state for shared editor state |
| `EditorRoutePage` | `openProjectId` + `isReady` + `loadError` — lifecycle only, not editor state |

---

## 4. Files to Create

### 4.1 `store/editor-reducer.ts`

Pure function — no side effects, no imports from bridge or API.

```typescript
import type { EditorState } from "../model/editor-document";
import type { EditorAction } from "../model/editor";
import type { Track, Clip, VisualClip } from "../model/editor-domain";

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {

    // ── Document ──────────────────────────────────────────────────────────
    case "LOAD_PROJECT":
      // Not used in normal flow (store is seeded at init time), but guard anyway
      return buildDocumentState(action.project);

    case "LOAD_PROJECT_DOCUMENT":
      return buildDocumentState(action.project);

    case "SET_TITLE":
      return { ...state, title: action.title };

    case "SET_RESOLUTION":
      return { ...state, resolution: action.resolution };

    case "SET_FPS":
      return { ...state, fps: action.fps };

    case "SAVE_REVISION_UPDATED":
      return { ...state, saveRevision: action.saveRevision };

    case "SAVE_CONFLICT_DETECTED":
      return { ...state, isReadOnly: true };

    case "MERGE_TRACKS_FROM_SERVER":
      return { ...state, tracks: mergeTracks(state.tracks, action.tracks) };

    // ── Playback ──────────────────────────────────────────────────────────
    case "SET_CURRENT_TIME":
      return { ...state, currentTimeMs: action.ms };

    case "SET_PLAYING":
      return { ...state, isPlaying: action.playing };

    case "SET_PLAYBACK_RATE":
      return { ...state, playbackRate: action.rate };

    case "SET_ZOOM":
      return { ...state, zoom: action.zoom };

    // ── Selection ─────────────────────────────────────────────────────────
    case "SELECT_CLIP":
      return { ...state, selectedClipId: action.clipId };

    // ── Clip mutations ────────────────────────────────────────────────────
    case "UPDATE_CLIP":
      return { ...state, tracks: updateClipInTracks(state.tracks, action.clipId, action.patch) };

    case "TOGGLE_CLIP_ENABLED":
      return {
        ...state,
        tracks: updateClipInTracks(state.tracks, action.clipId, (c) => ({
          enabled: !("enabled" in c && c.enabled),
        })),
      };

    case "REMOVE_CLIP":
      return { ...state, tracks: removeClipFromTracks(state.tracks, action.clipId) };

    case "MOVE_CLIP":
      return {
        ...state,
        tracks: updateClipInTracks(state.tracks, action.clipId, { startMs: action.startMs }),
      };

    // ── Track mutations ───────────────────────────────────────────────────
    case "TOGGLE_TRACK_MUTE":
      return {
        ...state,
        tracks: state.tracks.map((t) =>
          t.id === action.trackId ? { ...t, muted: !t.muted } : t,
        ),
      };

    case "TOGGLE_TRACK_LOCK":
      return {
        ...state,
        tracks: state.tracks.map((t) =>
          t.id === action.trackId ? { ...t, locked: !t.locked } : t,
        ),
      };

    case "RENAME_TRACK":
      return {
        ...state,
        tracks: state.tracks.map((t) =>
          t.id === action.trackId ? { ...t, name: action.name } : t,
        ),
      };

    // ── Export ────────────────────────────────────────────────────────────
    case "SET_EXPORT_JOB":
      return { ...state, exportJobId: action.jobId };

    case "SET_EXPORT_STATUS":
      return { ...state, exportStatus: action.status };

    // ── Clipboard ─────────────────────────────────────────────────────────
    case "COPY_CLIP": {
      const clip = findClip(state.tracks, action.clipId);
      const trackId = findTrackForClip(state.tracks, action.clipId)?.id ?? null;
      return clip
        ? { ...state, clipboardClip: clip, clipboardSourceTrackId: trackId }
        : state;
    }

    // ── Undo/Redo (history stubs — snapshots not implemented yet) ─────────
    case "UNDO":
    case "REDO":
      return state; // no-op until history snapshots are implemented

    default:
      return state;
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildDocumentState(project: import("../model/editor-domain").EditProject): EditorState {
  return {
    editProjectId: project.id,
    title: project.title ?? "Untitled Edit",
    durationMs: project.durationMs,
    fps: project.fps,
    resolution: project.resolution,
    saveRevision: project.saveRevision,
    createdAt: project.createdAt,
    tracks: project.tracks,
    clipboardClip: null,
    clipboardSourceTrackId: null,
    past: [],
    future: [],
    isReadOnly: project.status === "published",
    currentTimeMs: 0,
    isPlaying: false,
    playbackRate: 1,
    zoom: 80,
    selectedClipId: null,
    exportJobId: null,
    exportStatus: null,
  };
}

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

function removeClipFromTracks(tracks: Track[], clipId: string): Track[] {
  return tracks.map((track) => ({
    ...track,
    clips: track.clips.filter((c) => c.id !== clipId),
  }));
}

function findClip(tracks: Track[], clipId: string): Clip | null {
  for (const track of tracks) {
    const clip = track.clips.find((c) => c.id === clipId);
    if (clip) return clip;
  }
  return null;
}

function findTrackForClip(tracks: Track[], clipId: string): Track | null {
  return tracks.find((t) => t.clips.some((c) => c.id === clipId)) ?? null;
}

function mergeTracks(existing: Track[], fresh: Track[]): Track[] {
  const freshMap = new Map(fresh.map((t) => [t.id, t]));
  const merged = existing.map((t) => freshMap.get(t.id) ?? t);
  const existingIds = new Set(existing.map((t) => t.id));
  const newTracks = fresh.filter((t) => !existingIds.has(t.id));
  return [...merged, ...newTracks];
}
```

### 4.2 `store/editor-store.ts`

```typescript
import { create } from "zustand";
import type { EditorState } from "../model/editor-document";
import type { EditorAction } from "../model/editor";
import { editorReducer } from "./editor-reducer";
import type { EditProject } from "../model/editor-domain";

type EditorStore = EditorState & { dispatch: (action: EditorAction) => void };

let _store: ReturnType<typeof create<EditorStore>> | null = null;

export function initEditorStore(project: EditProject) {
  const initial = editorReducer(
    {} as EditorState, // seed — buildDocumentState called inside reducer
    { type: "LOAD_PROJECT_DOCUMENT", project },
  );
  _store = create<EditorStore>((set) => ({
    ...initial,
    dispatch: (action) =>
      set((s) => ({ ...editorReducer(s, action), dispatch: s.dispatch })),
  }));
  return _store;
}

export function getEditorStore(): ReturnType<typeof create<EditorStore>> {
  if (!_store) throw new Error("EditorStore not initialized");
  return _store;
}

export function destroyEditorStore(): void {
  _store = null;
}

export function useEditorStore<T>(selector: (s: EditorStore) => T): T {
  return getEditorStore()(selector);
}
```

### 4.3 `store/editor-context.tsx`

```typescript
import { createContext, useContext, type ReactNode } from "react";
import type { EditorAction } from "../model/editor";

interface EditorContextValue {
  dispatch: (action: EditorAction) => void;
}

const EditorContext = createContext<EditorContextValue | null>(null);

export function EditorStoreProvider({
  dispatch,
  children,
}: {
  dispatch: (action: EditorAction) => void;
  children: ReactNode;
}) {
  return (
    <EditorContext.Provider value={{ dispatch }}>
      {children}
    </EditorContext.Provider>
  );
}

export function useEditorDispatch(): (action: EditorAction) => void {
  const ctx = useContext(EditorContext);
  if (!ctx) throw new Error("useEditorDispatch must be used inside EditorStoreProvider");
  return ctx.dispatch;
}
```

> **Why context for dispatch but not state?** Zustand subscriptions (`useEditorStore`) are
> already reactive and don't need context. Dispatch goes through context so components can
> be tested without the module singleton.

---

## 5. Files to Modify

### 5.1 `model/editor-document.ts`

Add `createdAt` — required by `bridge.notifyStateChanged`.

```typescript
export interface EditorDocumentState {
  editProjectId: string | null;
  title: string;
  durationMs: number;
  fps: number;
  resolution: string;
  saveRevision: number;
  createdAt: string;           // ← add this
  tracks: Track[];
  clipboardClip: Clip | null;
  clipboardSourceTrackId: string | null;
  past: EditorHistorySnapshot[];
  future: EditorHistorySnapshot[];
  isReadOnly: boolean;
}
```

### 5.2 `model/editor.ts`

Add `SAVE_REVISION_UPDATED` to `EditorAction`:

```typescript
| { type: "SAVE_REVISION_UPDATED"; saveRevision: number }
```

### 5.3 `bridge/editor-api.ts`

Add two new methods:

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

### 5.4 `ui/layout/EditorProviders.tsx`

Provide the store context. The store itself is already initialized by the time `EditorProviders` mounts (initialized in `EditorRoutePage`'s `onProjectLoaded`).

```typescript
import type { ReactNode } from "react";
import { EditorStoreProvider } from "../../store/editor-context";
import { getEditorStore } from "../../store/editor-store";

interface EditorProvidersProps {
  children: ReactNode;
}

export function EditorProviders({ children }: EditorProvidersProps) {
  const dispatch = getEditorStore().getState().dispatch;
  return (
    <EditorStoreProvider dispatch={dispatch}>
      {children}
    </EditorStoreProvider>
  );
}
```

Remove the `project` and `onBack` props (nothing inside needs them via props anymore — they either read from store or receive callbacks directly).

### 5.5 `ui/layout/EditorRoutePage.tsx`

Replace `activeProject` local state with `isReady` boolean. Wire all bridge callbacks to dispatch into the store.

```typescript
import { useEffect, useState } from "react";
import { EditorLayout } from "./EditorLayout";
import { EditorProjectList } from "./EditorProjectList";
import { getEditorBridge, disposeEditorBridge } from "../../bridge";
import {
  initEditorStore,
  destroyEditorStore,
  getEditorStore,
} from "../../store/editor-store";

export interface EditorRouteSearch {
  projectId?: string;
  contentId?: number;
}

export function EditorRoutePage({ search }: { search: EditorRouteSearch }) {
  const [openProjectId, setOpenProjectId] = useState<string | null>(
    search.projectId ?? null,
  );
  const [isReady, setIsReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!openProjectId) {
      destroyEditorStore();
      setIsReady(false);
      return;
    }

    setIsReady(false);
    setLoadError(null);

    const bridge = getEditorBridge();
    bridge.initialize(openProjectId, {
      onProjectLoaded: (project) => {
        const store = initEditorStore(project);
        // Forward relevant mutations to bridge for autosave
        store.subscribe((state, prev) => {
          if (
            state.tracks !== prev.tracks ||
            state.durationMs !== prev.durationMs ||
            state.title !== prev.title
          ) {
            bridge.notifyStateChanged({
              tracks: state.tracks,
              durationMs: state.durationMs,
              title: state.title,
              fps: state.fps,
              resolution: state.resolution,
              saveRevision: state.saveRevision,
              createdAt: state.createdAt,
            });
          }
        });
        setIsReady(true);
      },
      onSaveRevisionUpdated: (saveRevision) => {
        getEditorStore()
          .getState()
          .dispatch({ type: "SAVE_REVISION_UPDATED", saveRevision });
      },
      onSaveConflict: () => {
        getEditorStore()
          .getState()
          .dispatch({ type: "SAVE_CONFLICT_DETECTED" });
      },
      onLoadError: (err) => {
        setLoadError(err.message);
      },
    });

    return () => {
      disposeEditorBridge();
      destroyEditorStore();
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
            destroyEditorStore();
            setOpenProjectId(null);
            setIsReady(false);
          }}
        />
      </div>
    );
  }

  return (
    <EditorProjectList onOpen={(id) => setOpenProjectId(id)} />
  );
}
```

### 5.6 `ui/layout/EditorLayout.tsx`

Remove `project` prop — all data comes from store.

```typescript
import { EditorProviders } from "./EditorProviders";
import { EditorHeader } from "./EditorHeader";
import { EditorWorkspace } from "./EditorWorkspace";
import { EditorStatusBar } from "./EditorStatusBar";
import { TimelineSection } from "../timeline/TimelineSection";
import { EditorDialogs } from "../dialogs/EditorDialogs";

interface Props {
  onBack: () => void;
}

export function EditorLayout({ onBack }: Props) {
  return (
    <EditorProviders>
      <div className="flex flex-col bg-studio-bg overflow-hidden min-w-0 w-full" style={{ height: "100%" }}>
        <EditorHeader onBack={onBack} />
        <EditorWorkspace />
        <TimelineSection />
        <EditorStatusBar />
        <EditorDialogs />
      </div>
    </EditorProviders>
  );
}
```

### 5.7 `ui/layout/EditorWorkspace.tsx`

Remove `project` prop.

```typescript
export function EditorWorkspace() {
  const generatedContentId = useEditorStore((s) => s.editProjectId); // or remove LeftPanel prop
  // ...
}
```

`LeftPanel` needs `generatedContentId` — read from store if needed, or pass `null` for now.

### 5.8 `ui/layout/EditorHeader.tsx`

Wire title, undo/redo, export button. Remove `readOnly` prop (read `isReadOnly` from store).

```typescript
import { useEditorStore } from "../../store/editor-store";
import { useEditorDispatch } from "../../store/editor-context";

export function EditorHeader({ onBack }: { onBack?: () => void }) {
  const title = useEditorStore((s) => s.title);
  const isReadOnly = useEditorStore((s) => s.isReadOnly);
  const canUndo = useEditorStore((s) => s.past.length > 0);
  const canRedo = useEditorStore((s) => s.future.length > 0);
  const dispatch = useEditorDispatch();

  // Open export modal by setting exportJobId to a sentinel (e.g. "open")
  // or add a dedicated OPEN_EXPORT_MODAL action to EditorUIState
  const openExportModal = () => dispatch({ type: "SET_EXPORT_JOB", jobId: "__modal_open__" });

  return (
    // ... existing JSX, replace stubs:
    // title input: value={title}, onChange={(e) => dispatch({ type: "SET_TITLE", title: e.target.value })}
    // undo button: disabled={!canUndo}, onClick={() => dispatch({ type: "UNDO" })}
    // redo button: disabled={!canRedo}, onClick={() => dispatch({ type: "REDO" })}
    // export button onClick={openExportModal}
  );
}
```

**Export modal open signal:** Add `exportModalOpen: boolean` to `EditorUIState`, toggled by a `OPEN_EXPORT_MODAL` / `CLOSE_EXPORT_MODAL` action (or reuse `exportJobId === "__modal_open__"`). Using a dedicated boolean is cleaner:

Add to `model/editor-ui.ts`:
```typescript
exportModalOpen: boolean;
```

Add to `EditorAction`:
```typescript
| { type: "OPEN_EXPORT_MODAL" }
| { type: "CLOSE_EXPORT_MODAL" }
```

### 5.9 `ui/layout/EditorStatusBar.tsx`

Remove props — read from store.

```typescript
export function EditorStatusBar() {
  const tracks = useEditorStore((s) => s.tracks);
  const resolution = useEditorStore((s) => s.resolution);
  const fps = useEditorStore((s) => s.fps);
  const clipCount = tracks.reduce((n, t) => n + t.clips.length, 0);
  const trackCount = tracks.length;
  // ... same JSX
}
```

### 5.10 `ui/timeline/Timeline.tsx`

Replace hardcoded `previewTracks` with store data. Wire handlers to dispatch.

```typescript
export function Timeline({ scrollRef }: { scrollRef?: RefObject<HTMLDivElement | null> }) {
  const tracks = useEditorStore((s) => s.tracks);
  const durationMs = useEditorStore((s) => s.durationMs);
  const zoom = useEditorStore((s) => s.zoom);
  const selectedClipId = useEditorStore((s) => s.selectedClipId);
  const clipboardClip = useEditorStore((s) => s.clipboardClip);
  const dispatch = useEditorDispatch();

  // Replace previewTracks → tracks
  // Replace zoom = 80 → zoom
  // Replace durationMs = 12_000 → durationMs
  // Wire TrackHeader callbacks:
  //   onToggleMute: (trackId) => dispatch({ type: "TOGGLE_TRACK_MUTE", trackId })
  //   onToggleLock: (trackId) => dispatch({ type: "TOGGLE_TRACK_LOCK", trackId })
  //   onDeleteAllClips: out of scope — leave () => undefined
  //   onRename: (trackId, name) => dispatch({ type: "RENAME_TRACK", trackId, name })
  // Wire TimelineClip callbacks:
  //   onSelect: (clipId) => dispatch({ type: "SELECT_CLIP", clipId })
  //   onMove: (clipId, startMs) => dispatch({ type: "MOVE_CLIP", clipId, startMs })
  //   onToggleEnabled: (clipId) => dispatch({ type: "TOGGLE_CLIP_ENABLED", clipId })
  //   onRippleDelete / onDelete: (clipId) => dispatch({ type: "REMOVE_CLIP", clipId })
  //   onCopy: (clipId) => dispatch({ type: "COPY_CLIP", clipId })
  //   isSelected: clip.id === selectedClipId
  //   hasClipboard: clipboardClip !== null
  // Wire TimelineRuler onSeek: (ms) => dispatch({ type: "SET_CURRENT_TIME", ms })
  // Wire Playhead: currentTimeMs from store
}
```

Remove the `previewTracks` constant and the `Props` interface `tracks?` optional (always from store now).

### 5.11 `ui/timeline/TimelineSection.tsx`

Wire zoom actions.

```typescript
export function TimelineSection() {
  const zoom = useEditorStore((s) => s.zoom);
  const dispatch = useEditorDispatch();
  const [snap, setSnap] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <div style={{ height: 340 }} className="flex flex-col shrink-0">
      <TimelineToolstrip
        onZoomIn={() => dispatch({ type: "SET_ZOOM", zoom: Math.min(zoom * 1.25, 400) })}
        onZoomOut={() => dispatch({ type: "SET_ZOOM", zoom: Math.max(zoom * 0.8, 20) })}
        onZoomFit={() => dispatch({ type: "SET_ZOOM", zoom: 80 })}
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

### 5.12 `ui/timeline/Playhead.tsx`

Read `currentTimeMs` and `zoom` from store (instead of props, if it currently uses props). Adjust as needed per file.

### 5.13 `ui/preview/PlaybackBar.tsx`

Replace local `isPlaying` useState with store.

```typescript
export function PlaybackBar() {
  const isPlaying = useEditorStore((s) => s.isPlaying);
  const currentTimeMs = useEditorStore((s) => s.currentTimeMs);
  const durationMs = useEditorStore((s) => s.durationMs);
  const fps = useEditorStore((s) => s.fps);
  const dispatch = useEditorDispatch();

  return (
    // ... same JSX, replace:
    // isPlaying — from store
    // onClick play/pause: dispatch({ type: "SET_PLAYING", playing: !isPlaying })
    // currentTimeMs display: formatHHMMSSFF(currentTimeMs, fps)
    // durationMs: from store
    // jump-start: dispatch({ type: "SET_CURRENT_TIME", ms: 0 })
    // jump-end: dispatch({ type: "SET_CURRENT_TIME", ms: durationMs })
  );
}
```

Remove `durationMs` and `fps` props (now from store).

### 5.14 `ui/inspector/Inspector.tsx`

Wire selected clip to real data.

```typescript
export function Inspector() {
  const selectedClipId = useEditorStore((s) => s.selectedClipId);
  const tracks = useEditorStore((s) => s.tracks);
  const dispatch = useEditorDispatch();
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
    // AdjustTab: selectedClip — pass opacity/contrast/warmth values; onChange dispatches UPDATE_CLIP
    // ...
  );
}
```

**`AdjustTab` wiring example** (pass real values, dispatch on change):
```typescript
<InspectorSliderRow
  label={t("editor_opacity_label")}
  value={selectedClip && "opacity" in selectedClip ? selectedClip.opacity * 100 : 100}
  min={0}
  max={100}
  step={1}
  onChange={(v) =>
    selectedClipId &&
    dispatch({ type: "UPDATE_CLIP", clipId: selectedClipId, patch: { opacity: v / 100 } })
  }
/>
```

### 5.15 `ui/dialogs/ExportModal.tsx`

Full implementation with real API calls and progress polling.

```typescript
import { useState, useEffect, useRef } from "react";
import { useEditorStore } from "../../store/editor-store";
import { useEditorDispatch } from "../../store/editor-context";
import { editorApi } from "../../bridge/editor-api";
import { ResolutionPicker } from "./ResolutionPicker";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/shared/ui/primitives/dialog";
import type { ExportJobStatus } from "../../model/editor-domain";

const POLL_INTERVAL_MS = 2000;

export function ExportModal() {
  const exportModalOpen = useEditorStore((s) => s.exportModalOpen);
  const exportStatus = useEditorStore((s) => s.exportStatus);
  const projectId = useEditorStore((s) => s.editProjectId);
  const defaultResolution = useEditorStore((s) => s.resolution);
  const defaultFps = useEditorStore((s) => s.fps);
  const dispatch = useEditorDispatch();

  const [resolution, setResolution] = useState(defaultResolution);
  const [fps, setFps] = useState<24 | 25 | 30 | 60>(defaultFps as 24 | 25 | 30 | 60);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Poll status while rendering or queued
  useEffect(() => {
    if (!projectId) return;
    const isActive =
      exportStatus?.status === "queued" || exportStatus?.status === "rendering";
    if (!isActive) {
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }
    pollRef.current = setInterval(async () => {
      try {
        const status = await editorApi.getExportStatus(projectId);
        dispatch({ type: "SET_EXPORT_STATUS", status });
        if (status.status === "done" || status.status === "failed") {
          clearInterval(pollRef.current!);
        }
      } catch {
        // silent — next poll will retry
      }
    }, POLL_INTERVAL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [exportStatus?.status, projectId, dispatch]);

  async function handleStartExport() {
    if (!projectId) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await editorApi.startExport(projectId, { resolution, fps });
      dispatch({
        type: "SET_EXPORT_STATUS",
        status: { status: "queued", progress: 0 },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  const close = () => dispatch({ type: "CLOSE_EXPORT_MODAL" });
  const isActive = exportStatus?.status === "queued" || exportStatus?.status === "rendering";
  const isDone = exportStatus?.status === "done";

  return (
    <Dialog open={exportModalOpen} onOpenChange={(open) => { if (!open) close(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Export Video</DialogTitle>
        </DialogHeader>

        {!isActive && !isDone && (
          <div className="flex flex-col gap-4 pt-2">
            <ResolutionPicker value={resolution} onChange={setResolution} />
            {/* fps picker — simple select */}
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button
              onClick={handleStartExport}
              disabled={isSubmitting}
              className="..."
            >
              {isSubmitting ? "Starting…" : "Export"}
            </button>
          </div>
        )}

        {isActive && (
          <div className="flex flex-col gap-2 pt-2">
            <p className="text-sm text-dim-2">
              {exportStatus?.progressPhase ?? "Rendering…"}
            </p>
            <div className="h-2 bg-overlay-sm rounded-full overflow-hidden">
              <div
                className="h-full bg-studio-accent transition-all"
                style={{ width: `${exportStatus?.progress ?? 0}%` }}
              />
            </div>
            <p className="text-xs text-dim-3">{exportStatus?.progress ?? 0}%</p>
          </div>
        )}

        {isDone && exportStatus?.r2Url && (
          <div className="flex flex-col gap-2 pt-2">
            <p className="text-sm text-green-400">Export complete!</p>
            <a href={exportStatus.r2Url} download className="text-studio-accent underline text-sm">
              Download video
            </a>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

### 5.16 `ui/dialogs/EditorDialogs.tsx`

Wire `ExportModal` (currently it likely passes `open={false}` hardcoded). Change to use store:

```typescript
export function EditorDialogs() {
  return <ExportModal />;
}
```

`ExportModal` now reads `exportModalOpen` from the store directly — no props needed.

---

## 6. Export Flow

```
User clicks "Export" in EditorHeader
  → dispatch(OPEN_EXPORT_MODAL)
  → EditorDialogs renders ExportModal with open=true

User picks settings, clicks "Export"
  → editorApi.startExport(projectId, { resolution, fps })
  ← { exportJobId, projectRevisionId }
  → dispatch(SET_EXPORT_STATUS, { status: "queued", progress: 0 })

Poll loop every 2s:
  → editorApi.getExportStatus(projectId)
  → dispatch(SET_EXPORT_STATUS, { status: "rendering", progress: 45, progressPhase: "encoding" })

When status === "done":
  → dispatch(SET_EXPORT_STATUS, { ..., r2Url: "..." })
  → ExportModal shows download link
  → poll loop stops
```

---

## 7. Autosave Flow

```
User edits (e.g. moves a clip)
  → dispatch(MOVE_CLIP)
  → Zustand set() → new state
  → store.subscribe() fires in EditorRoutePage
  → state.tracks !== prev.tracks → true
  → bridge.notifyStateChanged({ tracks, durationMs, title, ... })
  → EditorBridge debounces 2s → flushAutosave()
  → PATCH /api/editor/:id with { expectedSaveRevision, projectDocument }
  ← { saveRevision: n+1 }
  → bridge calls onSaveRevisionUpdated(n+1)
  → dispatch(SAVE_REVISION_UPDATED, n+1)
  → store.saveRevision = n+1
```

---

## 8. Validation Checklist

- [ ] Opening a project shows real tracks in the timeline (not hardcoded preview data)
- [ ] Moving/toggling a clip triggers autosave within 2s
- [ ] Saving increments `saveRevision` in the store (visible via devtools)
- [ ] Concurrent save (open two tabs, edit both) shows `isReadOnly: true` on the losing tab
- [ ] Play/Pause button in `PlaybackBar` reads from and writes to store
- [ ] Selecting a clip in the timeline shows real clip values in Inspector
- [ ] Changing opacity in Inspector dispatches `UPDATE_CLIP` and the clip reflects the change
- [ ] `EditorHeader` undo/redo buttons are enabled/disabled based on `past`/`future` lengths
- [ ] Clicking "Export" opens the modal
- [ ] Export progress bar updates every 2s while rendering
- [ ] Export "done" state shows a download link
- [ ] Closing the editor and reopening a different project loads fresh data (store is destroyed and re-initialized)

---

## 9. Rollback

Phase 5 is additive — it creates new files and wires existing type definitions. If reverted, the hardcoded `previewTracks` can be restored in `Timeline.tsx` and `EditorProviders` can return to its passthrough. No database migrations are involved.
