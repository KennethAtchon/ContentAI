# Phase 0: Delete the Old Runtime

**Goal:** Every file in the old preview runtime is gone. The editor compiles. The preview area shows a gray canvas placeholder. No seek-correction logic remains anywhere.

**Done criteria:**
- `bun run type-check` passes with zero errors
- `bun run dev` starts and the editor opens
- The preview area shows a gray rectangle with "Preview engine loading" text
- No references to `usePreviewPlaybackBridge`, `usePreviewMediaSync`, `usePreviewMediaRegistry`, `derivePreviewScene`, or `PreviewStageRoot` remain in the codebase

---

## Step 1 — Delete the six old files

Run these in `frontend/`:

```
rm src/features/editor/runtime/usePreviewPlaybackBridge.ts
rm src/features/editor/runtime/usePreviewMediaSync.ts
rm src/features/editor/runtime/usePreviewMediaRegistry.ts
rm src/features/editor/scene/preview-scene.ts
rm src/features/editor/renderers/PreviewStageSurface.tsx
rm src/features/editor/preview-root/PreviewStageRoot.tsx
```

> **Note:** `runtime/usePreviewSurfaceSize.ts` is NOT deleted — it handles the ResizeObserver sizing logic we will reuse in `PreviewCanvas.tsx`.

---

## Step 2 — Create `PreviewCanvas.tsx` (the placeholder)

Create `frontend/src/features/editor/components/PreviewCanvas.tsx`:

```tsx
import { useRef, useEffect, useState, forwardRef, useImperativeHandle } from "react";
import { useTranslation } from "react-i18next";

export interface PreviewCanvasHandle {
  getCanvas(): HTMLCanvasElement | null;
}

interface PreviewCanvasProps {
  resolution: string;
}

/**
 * Placeholder canvas that owns the preview surface.
 *
 * Phase 0: renders a gray background with a loading label.
 * Phase 2+: receives an OffscreenCanvas transfer from CompositorWorker
 * and paints ImageBitmap results into this canvas.
 */
export const PreviewCanvas = forwardRef<PreviewCanvasHandle, PreviewCanvasProps>(
  function PreviewCanvas({ resolution }, ref) {
    const { t } = useTranslation();
    const outerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const [resW, resH] = (resolution || "1080x1920").split("x").map(Number);
    const [previewSize, setPreviewSize] = useState<{ w: number; h: number } | null>(null);

    // Fit the canvas within the available container space, preserving aspect ratio.
    useEffect(() => {
      const el = outerRef.current;
      if (!el) return;
      const compute = () => {
        const availW = el.clientWidth;
        const availH = el.clientHeight - 40; // Reserve space for the label above
        if (availW <= 0 || availH <= 0) return;
        const ratio = resW / resH;
        if (availW / availH >= ratio) {
          setPreviewSize({ w: availH * ratio, h: availH });
        } else {
          setPreviewSize({ w: availW, h: availW / ratio });
        }
      };
      compute();
      const obs = new ResizeObserver(compute);
      obs.observe(el);
      return () => obs.disconnect();
    }, [resW, resH]);

    // Phase 0 placeholder: paint a static gray frame so the UI is not blank.
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas || !previewSize) return;
      canvas.width = resW;
      canvas.height = resH;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.fillStyle = "#1a1a1a";
      ctx.fillRect(0, 0, resW, resH);
      ctx.fillStyle = "rgba(255,255,255,0.15)";
      ctx.font = `${Math.round(resH * 0.02)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText("Preview engine loading", resW / 2, resH / 2);
    }, [previewSize, resW, resH]);

    useImperativeHandle(ref, () => ({
      getCanvas: () => canvasRef.current,
    }));

    return (
      <div
        ref={outerRef}
        className="flex-1 flex flex-col items-center justify-center bg-studio-bg overflow-hidden px-2 py-2 min-w-0"
      >
        <p className="text-[10px] font-semibold text-dim-3 mb-2 tracking-widest uppercase">
          {t("editor_preview_label")}
        </p>

        <div
          className="relative bg-black"
          style={{
            width: previewSize?.w ?? 0,
            height: previewSize?.h ?? 0,
          }}
        >
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full"
            aria-label={t("editor_preview_label")}
          />
        </div>

        <div className="w-full flex justify-between mt-1 px-3">
          <span className="text-xs text-dim-3">0:00 / 0:00</span>
          <span className="text-xs text-dim-3">{resW} × {resH}</span>
        </div>
      </div>
    );
  }
);
```

---

## Step 3 — Update `useEditorLayoutRuntime.ts`

**Remove** the `usePreviewPlaybackBridge` import and usage. Replace `previewCurrentTimeMs` with a passthrough of `store.state.currentTimeMs`.

**File:** `frontend/src/features/editor/hooks/useEditorLayoutRuntime.ts`

Remove line 15:
```ts
// DELETE this line:
import { usePreviewPlaybackBridge } from "../runtime/usePreviewPlaybackBridge";
```

Remove lines 84–92:
```ts
// DELETE this block:
const onEnd = useCallback(() => store.setPlaying(false), [store.setPlaying]);
const { previewCurrentTimeMs } = usePreviewPlaybackBridge({
  isPlaying: store.state.isPlaying,
  currentTimeMs: store.state.currentTimeMs,
  durationMs: store.state.durationMs,
  playbackRate: store.state.playbackRate,
  onPublishCurrentTime: store.setCurrentTime,
  onPlaybackEnd: onEnd,
});
```

Replace the return value at line 122. Change:
```ts
return {
  state: store.state,
  previewCurrentTimeMs,
  store,
  // ...
```

To:
```ts
return {
  state: store.state,
  // previewCurrentTimeMs is now owned by usePreviewEngine (Phase 3).
  // Until then, wire it directly to the reducer's currentTimeMs.
  previewCurrentTimeMs: store.state.currentTimeMs,
  store,
  // ...
```

> The `useCallback` import may become unused after removing `onEnd`. If `useCallback` is only used for `onEnd`, remove it from the imports too. Run `bun run lint` to confirm.

---

## Step 4 — Update `EditorWorkspace.tsx`

Replace the `PreviewStageRoot` import and usage with `PreviewCanvas`.

**File:** `frontend/src/features/editor/components/EditorWorkspace.tsx`

Change the import at line 4:
```ts
// REMOVE:
import { PreviewStageRoot } from "../preview-root/PreviewStageRoot";

// ADD:
import { PreviewCanvas } from "./PreviewCanvas";
```

Remove these props from the `EditorWorkspaceProps` interface — they were only needed by `PreviewStageRoot` and are no longer passed at this layer:
```ts
// REMOVE from interface:
isPlaying: boolean;
playbackRate: number;
effectPreview: { clipId: string; patch: Partial<Clip> } | null;
```

> **Wait** — `isPlaying`, `playbackRate`, and `effectPreview` are used by `Inspector` too (via context). Keep them in the interface. Only the JSX changes.

Replace the JSX in the return value. Change:
```tsx
// REMOVE:
<PreviewStageRoot
  tracks={tracks}
  currentTimeMs={previewCurrentTimeMs}
  isPlaying={isPlaying}
  playbackRate={playbackRate}
  durationMs={durationMs}
  resolution={resolution}
  effectPreviewOverride={effectPreview}
/>
```

To:
```tsx
// ADD:
<PreviewCanvas resolution={resolution} />
```

Remove unused props that are no longer passed to `PreviewStageRoot`. Specifically remove `previewCurrentTimeMs`, `durationMs`, `tracks` from the interface and the function signature **only if** they are not used elsewhere in this component. Check that `MediaPanel` and `Inspector` usages are still wired.

After the edit, `EditorWorkspace.tsx` should look approximately like:

```tsx
import type { Clip, EditProject, Track, Transition } from "../types/editor";
import type { TabKey } from "./MediaPanel";
import { MediaPanel } from "./MediaPanel";
import { PreviewCanvas } from "./PreviewCanvas";
import { Inspector } from "./Inspector";
import { useEditorContext } from "../context/EditorContext";

interface EditorWorkspaceProps {
  project: EditProject;
  tracks: Track[];
  currentTimeMs: number;
  previewCurrentTimeMs: number; // kept — will be used by PreviewCanvas in Phase 3
  isPlaying: boolean;
  playbackRate: number;
  durationMs: number;
  resolution: string;
  selectedTransition: Transition | null;
  effectPreview: { clipId: string; patch: Partial<Clip> } | null;
  mediaActiveTab: TabKey;
  pendingAdd: { trackId: string; startMs: number } | null;
  isReadOnly: boolean;
  onSetEffectPreview: (value: { clipId: string; patch: Partial<Clip> } | null) => void;
  onSetMediaActiveTab: (tab: TabKey) => void;
  onClearPendingAdd: () => void;
  onAddClip: (trackId: string, clip: Clip) => void;
}

export function EditorWorkspace({
  project,
  currentTimeMs,
  isPlaying,
  playbackRate,
  resolution,
  selectedTransition,
  effectPreview,
  mediaActiveTab,
  pendingAdd,
  isReadOnly,
  onSetEffectPreview,
  onSetMediaActiveTab,
  onClearPendingAdd,
  onAddClip,
}: EditorWorkspaceProps) {
  const { state } = useEditorContext();

  return (
    <div className="flex flex-1 overflow-hidden min-h-0">
      <MediaPanel
        generatedContentId={project.generatedContentId}
        currentTimeMs={currentTimeMs}
        onAddClip={onAddClip}
        readOnly={isReadOnly}
        activeTab={mediaActiveTab}
        onTabChange={onSetMediaActiveTab}
        pendingAdd={pendingAdd}
        onClearPendingAdd={onClearPendingAdd}
      />

      <PreviewCanvas resolution={resolution} />

      <Inspector
        onEffectPreview={(patch) =>
          onSetEffectPreview(
            patch && state.selectedClipId
              ? { clipId: state.selectedClipId, patch }
              : null
          )
        }
        selectedTransition={selectedTransition}
      />
    </div>
  );
}
```

---

## Step 5 — Verify

```bash
cd frontend
bun run type-check   # must pass with zero errors
bun run lint         # fix any unused-import warnings
bun run dev          # open the editor — preview area shows gray canvas
```

Open a project. The timeline, inspector, autosave, and all controls should work normally. The preview area shows the gray placeholder canvas.

---

## Rollback

All deleted files are in git. `git checkout HEAD -- <path>` on each file restores this phase entirely.
