# Phase 9 — Autosave + Persist on Store Subscription

> Move autosave from `useEditorAutosave` (a hook that reads derived state every render) to a single store subscription that fires only on real timeline mutations, off the main thread where possible.
> After this phase: editing a clip mid-playback does not cause frame drops from JSON serialization.

## Goal

1. Autosave driven by `projectStore.subscribe(selector, onChange)`, not a React hook.
2. Debounce + fingerprint remain. No change to server contract.
3. JSON serialization runs in a Web Worker so main thread isn't blocked on large timelines.
4. Flush on `beforeunload` / route change.
5. Conflict detection (version mismatch 409) continues to work — the store holds `lastSavedVersion` and compares.

## Preconditions

- Phase 3 merged (`projectStore` exists, action-based mutations).
- Phases 4–8 merged; engine runtime is in final shape.

## Files Touched

### Implement
- `frontend/src/features/editor/services/autosave-service.ts` — NEW. Singleton with `start(store, options)`, `flush()`, `stop()`.
- `frontend/src/features/editor/services/autosave.worker.ts` — NEW. Worker that serializes + hashes a timeline snapshot. Main thread posts `{ snapshot }`; worker returns `{ json, fingerprint }`.

### Modify
- `frontend/src/features/editor/components/layout/EditorProviders.tsx` — start autosave on mount, stop on unmount (replacing the hook)
- `frontend/src/features/editor/services/save-service.ts` — keep; used by autosave-service to do the HTTP PATCH

### Delete
- `frontend/src/features/editor/hooks/useEditorAutosave.ts` — replaced by `autosave-service.ts`

## Key Implementations

### `autosave-service.ts`

```ts
import { useProjectStore } from "../stores/projectStore";
import { savePatch } from "./save-service";

interface AutosaveOptions {
  projectId: string;
  isReadOnly: boolean;
  debounceMs?: number;       // default 800
  maxIntervalMs?: number;    // default 10_000
}

let worker: Worker | null = null;
let pendingTimer: number | null = null;
let lastFlushWall = 0;
let lastFingerprint: string | null = null;
let unsubscribeStore: (() => void) | null = null;

export function startAutosave(opts: AutosaveOptions): void {
  if (opts.isReadOnly) return;
  worker ??= new Worker(new URL("./autosave.worker.ts", import.meta.url), { type: "module" });

  unsubscribeStore = useProjectStore.subscribe(
    (s) => ({ tracks: s.tracks, subtitles: s.subtitles, caption: s.caption, meta: s.meta }),
    (snapshot) => scheduleFlush(opts, snapshot),
  );
}

function scheduleFlush(opts: AutosaveOptions, snapshot: unknown): void {
  const now = performance.now();
  const debounceMs = opts.debounceMs ?? 800;
  const maxMs = opts.maxIntervalMs ?? 10_000;

  if (pendingTimer) window.clearTimeout(pendingTimer);

  const delay = now - lastFlushWall >= maxMs ? 0 : debounceMs;
  pendingTimer = window.setTimeout(() => {
    pendingTimer = null;
    void flush(opts, snapshot);
  }, delay);
}

async function flush(opts: AutosaveOptions, snapshot: unknown): Promise<void> {
  const { json, fingerprint } = await serializeInWorker(snapshot);
  if (fingerprint === lastFingerprint) return;

  const { version } = useProjectStore.getState().meta;
  try {
    const resp = await savePatch(opts.projectId, { body: json, expectedVersion: version });
    useProjectStore.getState().setVersion(resp.version);
    useProjectStore.getState().setLastSavedAt(new Date());
    lastFingerprint = fingerprint;
    lastFlushWall = performance.now();
  } catch (err) {
    if (isConflict(err)) {
      useProjectStore.getState().setConflict(true);
    } else {
      throw err;
    }
  }
}

export function stopAutosave(): void {
  if (pendingTimer) window.clearTimeout(pendingTimer);
  unsubscribeStore?.(); unsubscribeStore = null;
  worker?.terminate(); worker = null;
}

function serializeInWorker(snapshot: unknown): Promise<{ json: string; fingerprint: string }> {
  return new Promise((resolve) => {
    const msgId = crypto.randomUUID();
    const onMessage = (ev: MessageEvent) => {
      if (ev.data.msgId !== msgId) return;
      worker!.removeEventListener("message", onMessage);
      resolve({ json: ev.data.json, fingerprint: ev.data.fingerprint });
    };
    worker!.addEventListener("message", onMessage);
    worker!.postMessage({ msgId, snapshot });
  });
}
```

### `autosave.worker.ts`

```ts
self.onmessage = (ev: MessageEvent) => {
  const { msgId, snapshot } = ev.data;
  const json = JSON.stringify(snapshot);
  const fingerprint = fnv1a(json);
  (self as unknown as Worker).postMessage({ msgId, json, fingerprint });
};

function fnv1a(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h >>> 0) * 0x01000193;
  }
  return (h >>> 0).toString(16);
}
```

`JSON.stringify` happens off main thread. `fnv1a` is faster than SHA on small payloads. If collisions are a concern later, swap to MurmurHash3 or WASM xxhash — not needed now.

### `beforeunload` flush

```ts
window.addEventListener("beforeunload", () => {
  // Best-effort: sendBeacon with last known snapshot + fingerprint
  const snap = useProjectStore.getState();
  navigator.sendBeacon(`/api/projects/${snap.meta.id}/autosave`, /* json */);
});
```

Keep the existing unload flush behavior, just wired to the new source.

## Step-by-Step

1. Branch `migration/phase-09-autosave`.
2. Implement `autosave.worker.ts` + unit test (post snapshot → get json + fingerprint).
3. Implement `autosave-service.ts`.
4. Wire `startAutosave` / `stopAutosave` from `EditorProviders` (or root layout).
5. Delete `useEditorAutosave.ts` and its consumers.
6. Smoke:
   - Edit a clip — autosave fires within 800 ms.
   - Rapid-edit 10 times — only one save.
   - Long idle then edit — saves within 800 ms despite idle.
   - Playback + edit — no frame drops (that's the whole point of moving to worker).
   - Close tab after edit — save beacon fires, server receives.
7. PR.

## Validation

| Check | How |
| --- | --- |
| No JSON blocking main | Performance Profiler: no long `JSON.stringify` tasks on main thread |
| Autosave still fires | Edit a clip, wait 1s, DevTools Network shows PATCH |
| Fingerprint dedup | Edit-then-revert should not fire an unnecessary PATCH |
| Conflict handling | Force a 409 (another tab saves) — store surfaces `conflict: true` |
| No hook | `grep -rn "useEditorAutosave" frontend/src` → no hits |

## Exit Criteria

- `useEditorAutosave` deleted.
- Autosave runs in a worker.
- Edit during playback does not cause FPS dip.

## Rollback

Revert phase-09 PR. Low blast radius; isolated to save pipeline.

## Estimate

1.5–2 days. Worker plumbing is short; the risk is getting the conflict-detection path right so a slow save doesn't clobber a newer version.

## Perf Budget Gate

- Edit + play simultaneously: FPS dip ≤ 3 FPS during save (worker serialization is off main thread; only network fetch touches main).
- Main-thread `JSON.stringify` calls during editing: zero (all in worker).
