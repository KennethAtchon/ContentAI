# Phase 2 — Scaffold

> Create the shell that the new OpenReel-style engine will live in.
> After this phase: new folders and interfaces exist, the editor still runs on the OLD engine, but new code paths are reachable.

## Goal

Build the skeleton:
1. `frontend/src/editor-core/` — pure TS engine namespace with subfolders matching OpenReel's `packages/core/`.
2. Stub interfaces and classes that future phases implement.
3. Single `engineStore` (Zustand) that holds engine handles.
4. Bridge folder with empty classes per domain.
5. ESLint rule banning React imports from `editor-core/`.

No behavior change. Old `PreviewEngine.ts` still drives playback.

## Preconditions

- Phase 1 merged.
- `bun run type-check` clean on baseline.

## Target Folder Layout

```
frontend/src/
  editor-core/                         # NEW — zero React
    index.ts                           # public API surface
    README.md                          # "no React imports below this line"
    types/
      timeline.ts                      # Timeline, Track, Clip, Subtitle, Transform
      render.ts                        # RenderedFrame, RendererConfig, GPULayer, etc.
      export.ts                        # ExportSettings, ExportProgress
    playback/
      MasterTimelineClock.ts           # AudioContext clock (stub ok)
      PlaybackController.ts            # play/pause/seek → drives clock
    video/
      VideoEngine.ts                   # renderFrame(project, t, w, h) (stub)
      renderer-factory.ts              # WebGL2 / Canvas2D selector (stub)
      Webgl2Renderer.ts                # moved later from engine/compositor/
      Canvas2dRenderer.ts              # moved later
      GpuCompositor.ts                 # z-order + blend (stub)
      FrameCache.ts                    # LRU (stub)
      ParallelFrameDecoder.ts          # workers (later phase)
    text/
      SubtitleEngine.ts                # CRUD + SRT (stub)
      renderCaptionFrame.ts            # pure fn (stub)
      TitleEngine.ts                   # text clips (stub)
    timeline/
      ClipManager.ts                   # add/move/split/remove
      TrackManager.ts                  # add/lock/mute
      actions.ts                       # Action type + ActionExecutor (stub)
    export/
      ExportEngine.ts                  # frame loop → encoder (stub)
    storage/
      serialize.ts                     # project <-> JSON

  features/editor/
    bridges/                           # NEW
      index.ts
      RenderBridge.ts                  # React canvas ↔ VideoEngine (stub)
      PlaybackBridge.ts                # React play/pause/seek ↔ PlaybackController (stub)
      TextBridge.ts                    # React caption UI ↔ SubtitleEngine/renderCaption (stub)
      MediaBridge.ts                   # asset map + URL lifecycle (stub)
    stores/                            # NEW
      engineStore.ts                   # Zustand; holds engine instances
    ... (existing contents unchanged)
```

## Files Touched

### New files (all stubs — each exports a typed class/fn that throws `"not implemented"` or returns a sane default)

- `frontend/src/editor-core/index.ts`
- `frontend/src/editor-core/README.md`
- `frontend/src/editor-core/types/timeline.ts`
- `frontend/src/editor-core/types/render.ts`
- `frontend/src/editor-core/types/export.ts`
- `frontend/src/editor-core/playback/MasterTimelineClock.ts`
- `frontend/src/editor-core/playback/PlaybackController.ts`
- `frontend/src/editor-core/video/VideoEngine.ts`
- `frontend/src/editor-core/video/renderer-factory.ts`
- `frontend/src/editor-core/video/GpuCompositor.ts`
- `frontend/src/editor-core/video/FrameCache.ts`
- `frontend/src/editor-core/text/SubtitleEngine.ts`
- `frontend/src/editor-core/text/renderCaptionFrame.ts`
- `frontend/src/editor-core/text/TitleEngine.ts`
- `frontend/src/editor-core/timeline/ClipManager.ts`
- `frontend/src/editor-core/timeline/TrackManager.ts`
- `frontend/src/editor-core/timeline/actions.ts`
- `frontend/src/editor-core/export/ExportEngine.ts`
- `frontend/src/editor-core/storage/serialize.ts`
- `frontend/src/features/editor/bridges/index.ts`
- `frontend/src/features/editor/bridges/RenderBridge.ts`
- `frontend/src/features/editor/bridges/PlaybackBridge.ts`
- `frontend/src/features/editor/bridges/TextBridge.ts`
- `frontend/src/features/editor/bridges/MediaBridge.ts`
- `frontend/src/features/editor/stores/engineStore.ts`

### Modify
- `frontend/eslint.config.*` or `frontend/.eslintrc.*` — add restricted imports for `editor-core/`
- `frontend/tsconfig.json` — add path alias `"@editor-core/*": ["src/editor-core/*"]`
- `frontend/vite.config.ts` — mirror the alias in Vite's resolver
- **Nothing else.** Do not touch the existing engine.

## Stub Content Examples

### `editor-core/types/timeline.ts`
Copy the existing `features/editor/types/editor.ts` shape for now — DO NOT rename fields. This phase is structural only. Rename to OpenReel conventions in a dedicated later phase so diffs stay focused.

```ts
// Re-export existing types under the new path for now.
// A later phase will rename to OpenReel conventions (inPoint/outPoint, etc.).
export type { Track, Clip, VideoClip, TextClip, Transition } from "@/features/editor/types/editor";
```

### `editor-core/playback/MasterTimelineClock.ts`
Stub with the real shape; implementation in phase 3.

```ts
export type ClockState = "stopped" | "playing" | "paused";

export interface ClockSubscription {
  unsubscribe(): void;
}

export class MasterTimelineClock {
  private audioContext: AudioContext | null = null;
  private state: ClockState = "stopped";
  private startAudioContextTime = 0;
  private startTimelineMs = 0;
  private playbackRate = 1;
  private listeners = new Set<(ms: number) => void>();

  get currentMs(): number {
    if (!this.audioContext || this.state !== "playing") return this.startTimelineMs;
    const elapsedSec = (this.audioContext.currentTime - this.startAudioContextTime) * this.playbackRate;
    return this.startTimelineMs + elapsedSec * 1000;
  }

  // Real methods in phase 3.
  attach(_ctx: AudioContext): void { throw new Error("not implemented"); }
  play(_fromMs: number): void { throw new Error("not implemented"); }
  pause(): void { throw new Error("not implemented"); }
  seek(_toMs: number): void { throw new Error("not implemented"); }

  subscribe(cb: (ms: number) => void): ClockSubscription {
    this.listeners.add(cb);
    return { unsubscribe: () => this.listeners.delete(cb) };
  }
}
```

### `editor-core/video/VideoEngine.ts`
Shape-only.

```ts
import type { Track } from "@/features/editor/types/editor";

export interface RenderedFrame {
  readonly image: ImageBitmap | OffscreenCanvas | HTMLCanvasElement;
  readonly timestampMs: number;
  readonly width: number;
  readonly height: number;
}

export interface RenderFrameArgs {
  readonly tracks: Track[];
  readonly subtitles: readonly unknown[]; // refined in phase 6
  readonly timelineMs: number;
  readonly width: number;
  readonly height: number;
}

export class VideoEngine {
  async renderFrame(_args: RenderFrameArgs): Promise<RenderedFrame> {
    throw new Error("VideoEngine.renderFrame not implemented (phase 4)");
  }
}
```

### `features/editor/stores/engineStore.ts`

```ts
import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import type { MasterTimelineClock } from "@editor-core/playback/MasterTimelineClock";
import type { PlaybackController } from "@editor-core/playback/PlaybackController";
import type { VideoEngine } from "@editor-core/video/VideoEngine";
import type { SubtitleEngine } from "@editor-core/text/SubtitleEngine";

interface EngineState {
  initialized: boolean;
  clock: MasterTimelineClock | null;
  playback: PlaybackController | null;
  video: VideoEngine | null;
  subtitles: SubtitleEngine | null;

  initialize(): Promise<void>;
  dispose(): void;
}

export const useEngineStore = create<EngineState>()(
  subscribeWithSelector((_set) => ({
    initialized: false,
    clock: null,
    playback: null,
    video: null,
    subtitles: null,
    async initialize() { /* wired in phase 3 */ },
    dispose() {},
  })),
);
```

### `features/editor/bridges/RenderBridge.ts`

```ts
export class RenderBridge {
  private canvas: HTMLCanvasElement | null = null;
  setCanvas(el: HTMLCanvasElement | null): void { this.canvas = el; }
  async renderAt(_timelineMs: number): Promise<void> { /* phase 4 */ }
}
export const renderBridge = new RenderBridge();
```

(Same skeleton for the other three bridges.)

## ESLint Boundary

Add to frontend lint config:

```js
// frontend/eslint.config.* — adapt to project's config style
{
  files: ["src/editor-core/**/*.{ts,tsx}"],
  rules: {
    "no-restricted-imports": ["error", {
      paths: [
        { name: "react", message: "editor-core must not import React" },
        { name: "react-dom", message: "editor-core must not import react-dom" },
      ],
      patterns: [
        { group: ["@/features/editor/components/**"], message: "editor-core must not reach into React components" },
        { group: ["@/features/editor/hooks/**"], message: "editor-core must not import React hooks" },
        { group: ["@/features/editor/context/**"], message: "editor-core must not import React context" },
        { group: ["@tanstack/*"], message: "editor-core must not import TanStack libs (React-coupled)" },
        { group: ["zustand", "zustand/*"], message: "Zustand stores live in features/editor/stores/ only" },
      ],
    }],
  },
},
```

The negative-list is important: keep engine free of *all* React-adjacent deps, not just `react`.

## Path Aliases

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["src/*"],
      "@editor-core/*": ["src/editor-core/*"]
    }
  }
}
```

`vite.config.ts`:

```ts
resolve: {
  alias: {
    "@": path.resolve(__dirname, "./src"),
    "@editor-core": path.resolve(__dirname, "./src/editor-core"),
  },
}
```

## Step-by-Step

1. Branch `migration/phase-02-scaffold`.
2. Create `editor-core/` tree with all stub files.
3. Create `bridges/` and `stores/engineStore.ts`.
4. Add tsconfig + vite alias.
5. Add ESLint block.
6. Verify `bun run type-check`, `bun run lint`, `bun test` — all green.
7. Run `bun run dev`, open editor, **confirm no regressions** (old engine still owns everything).
8. Commit. Suggested message:
   ```
   feat(editor): scaffold editor-core, bridges, engineStore (no behavior change)
   ```
9. PR.

## Validation

| Check | How |
| --- | --- |
| Stub imports resolve | `bun run type-check` |
| ESLint boundary works | Add a temporary `import React from "react"` inside `editor-core/` — must fail lint. Remove before PR. |
| Old engine untouched | `git diff --stat` shows NO changes under `features/editor/engine/`, `features/editor/caption/`, `features/editor/hooks/` |
| Bundle size | `bun run build` size delta ≈ 0 (stubs are tree-shaken or tiny) |
| Editor still works | Open → play → save → export |

## Exit Criteria

- `editor-core/` exists with all stub files.
- ESLint forbids React imports inside it (verified with a throwaway violation).
- `engineStore` + 4 bridges exist and are imported *nowhere* yet (just exports).
- Editor behavior bit-identical to before.

## Rollback

Revert single PR. Scaffold-only, no consumers → zero coupling to remove.

## Estimate

1 day. Mostly typing. Main risk: ESLint config varies by project; may need 15 min to match ContentAI's existing config style.

## Out of Scope

- Implementing any of the stubs (phases 3–9).
- Moving existing engine code into `editor-core/`. That happens in the implement phases; some of the current engine code (e.g. `CompositorWorker`, `DecoderPool`) **will be moved** into `editor-core/video/` in phase 4 without logic changes, but only once the new interfaces are proven.
