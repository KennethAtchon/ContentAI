# Red Team Report: Editor feature (`frontend/src/features/editor`)

**Artifact type:** Mixed (React feature code + related backend routes)  
**Scope reviewed:** Editor layout/state, timeline/preview/media/inspector, hooks (`useEditorStore`, `usePlayback`, `use-waveform`), utilities, `services/editor-api.ts`, feature folder naming/exports/organization, and representative backend routes in `backend/src/routes/editor/index.ts` (auth, patch, publish, export).  
**Total findings:** 31 (🔴 0 critical · 🟠 7 high · 🟡 12 medium · 🔵 9 low · ⚪ 3 info)

---

## Findings

### 🟠 HIGH — Audio preview `targetTime` ignores `clip.speed` while video respects it — `PreviewArea.tsx` (~219–244 vs ~190–200)

**What:** Video sync uses `((currentTimeMs - clip.startMs) / 1000) * (clip.speed || 1) + trimStartMs` when calculating the seek target. Audio uses `(currentTimeMs - clip.startMs) / 1000 + trimStartMs` with no speed factor. Note: `el.playbackRate = clip.speed || 1` **is** set for audio, so the playback speed itself is correct — the bug is confined to the seek/resync path.

**Why it matters:** When scrubbing or jumping the playhead, the audio element is seeked to the wrong source position. For a clip at `startMs=0` playing at 2×, seeking to timeline position 10 s targets source frame 10 s instead of the correct 20 s. The discrepancy is invisible during uninterrupted playback (where `playbackRate` keeps pace) but surfaces on every seek. **Export also omits audio tempo** (see separate finding on `runExportJob`).

**Proof / Example:** Set a music clip to 2× speed; scrub the playhead — audio re-syncs to the wrong offset relative to video.

**Fix direction:** Align audio `targetTime` with the same speed math as video; pair with ffmpeg `atempo` (or equivalent) in export.

---

### 🟠 HIGH — `parseTimecode` mis-parses common three-part input — `EditorLayout.tsx` (~82–90)

**What:** For `parts.length === 3`, the code assigns `[mm, ss, ff] = parts`, treating input as minutes:seconds:frames. Users typically enter **HH:MM:SS** (no frames).

**Why it matters:** Jumping the playhead via timecode produces wrong positions (e.g. `01:30:00` interpreted as 1 min 30 sec + 0 frames instead of 1 hour 30 min).

**Proof / Example:** Enter `00:01:00` expecting 1 minute; behavior depends on whether the user meant 1:00.00 at 30fps vs 0h1m0s.

**Fix direction:** Support explicit formats (documented), or separate fields for HH:MM:SS vs HH:MM:SS:FF; add unit tests for parsing.

---

### 🟠 HIGH — Paste shortcut picks target track by still-present source clip id — `EditorLayout.tsx` (~510–520)

**What:** Cmd/Ctrl+V finds `ownerTrack` by searching for a clip whose `id` equals `clipboardClip.id` (the original clip’s id). If the user copied then **deleted** the source clip, no track matches and paste falls back to `"video"`.

**Why it matters:** Paste lands on the wrong track (e.g. music onto video), corrupting layout and auto-save payload.

**Proof / Example:** Copy a music clip, delete it, paste — clip goes to video track.

**Fix direction:** Store `sourceTrackId` (or `trackType`) on copy in reducer state, not inferred from timeline membership.

---

### 🟠 HIGH — Publish “flush” races the debounced `save` mutation — `EditorLayout.tsx` (~811–824)

**What:** On publish, pending debounce is cleared and `save(patch)` is invoked, then `publishProject()` runs immediately. `save` is a React Query `mutate` — not awaited.

**Why it matters:** Publish can proceed before PATCH completes; server may lock **published** state on an older timeline (especially on slow networks).

**Fix direction:** `await` a flush API (e.g. `mutateAsync` or dedicated `flushSave`) before calling publish, or combine into one server transaction.

---

### 🟠 HIGH — Preview mounts every timeline video with `preload="auto"` — `PreviewArea.tsx` (~302–363)

**What:** All video clips render as sibling `<video>` elements, each with `preload="auto"`.

**Why it matters:** Memory, decode work, and network contention scale **O(n)** with clip count. Long projects risk jank, battery drain, and mobile tab crashes.

**Fix direction:** Only mount/active-load clips near the playhead (windowing), use `preload="metadata"` or lazy `src` for off-screen clips, or a single compositor path.

---

### 🟠 HIGH — Export ignores `clip.speed` on audio (video only gets `setpts`) — `backend/src/routes/editor/index.ts` (~1126–1154 vs ~1258–1276)

**What:** Video filter graph applies `setpts=${(1 / clip.speed)}*PTS` when `speed !== 1`. Audio inputs are wired with `volume=` only — no `atempo` / `rubberband` chain for `clip.speed`.

**Why it matters:** Published exports disagree with timeline intent for sped-up/slowed voiceover or music; preview (once fixed) and ffmpeg still won’t match.

**Proof / Example:** Set music to 0.5×; export — music plays at original speed in output file.

**Fix direction:** Apply matching tempo filters per audio clip (chaining `atempo` for ffmpeg’s 0.5–2.0 limit, or `rubberband` where available).

---

### 🟠 HIGH — Full editor subtree re-renders on every playhead tick — `EditorLayout.tsx` + children

**What:** `usePlayback` calls `onTick` → `setCurrentTime` every animation frame while playing. `EditorLayout` owns that state and passes `currentTimeMs` into `Timeline`, `PreviewArea`, `MediaPanel`, etc., without memoization boundaries.

**Why it matters:** At 60fps, React does large reconciliations (timeline clips, waveforms, preview sync). This caps scalability of complex timelines.

**Fix direction:** Lift playhead into a ref + `requestAnimationFrame` subscriber for heavy children, `React.memo` with narrow props, or split “transport time” from reducer-driven structural state.

---

### 🟡 MEDIUM — Server merge `useEffect` dependencies are incomplete — `EditorLayout.tsx` (~137–164)

**What:** Effect depends on `[polledPayload?.project?.updatedAt]` but reads `store.state`, `polledPayload?.project`, and calls `store.dispatch` without listing them.

**Why it matters:** Stale closure risk if polling shape changes without `updatedAt` changing; harder to reason about and `exhaustive-deps` is suppressed in practice.

**Fix direction:** Depend on stable `serverProject` identity, use `useQuery`’s `select`, or move merge into a query `onSuccess` / dedicated hook with explicit merge versioning.

---

### 🟡 MEDIUM — `MERGE_TRACKS_FROM_SERVER` never merges the `text` track — `useEditorStore.ts` (~565–617)

**What:** Merge handles `video`, `audio`, and `music`; other track types fall through with `return localTrack`.

**Why it matters:** Server-side updates to captions/text clips (e.g. regeneration) may not appear in the client while video/audio do, causing split-brain until full reload.

**Fix direction:** Define merge rules for `text` (placeholders, caption words, server vs `locallyModified`).

---

### 🟡 MEDIUM — Track mute/lock bypass undo history — `useEditorStore.ts` (`TOGGLE_TRACK_MUTE`, `TOGGLE_TRACK_LOCK`)

**What:** Those actions mutate `tracks` without pushing to `past` / clearing `future`.

**Why it matters:** Undo/redo stack is inconsistent — users undo a clip move but not a mute they toggled right before.

**Fix direction:** Either push snapshots for mute/lock or document as intentional and exclude from undo UX.

---

---

### 🟡 MEDIUM — `useWaveform` depends on `container` snapshot — `TimelineClip.tsx` (~82–89) + `use-waveform.ts` (~44–84)

**What:** `useWaveform({ container: waveformContainerRef.current, ...})` — `ref.current` is `null` on first render until a **subsequent** render runs the effect with a non-null container.

**Why it matters:** If the parent does not re-render after ref attach (e.g. paused editor, no query update), waveform init can be delayed or skipped until some unrelated state change.

**Fix direction:** Callback ref + `useState`/`useLayoutEffect` to attach container, or pass a ref object the hook reads in layout effect.

---

### 🟡 MEDIUM — Timeline horizontal canvas grows without virtualisation — `Timeline.tsx` (~78–79)

**What:** `totalWidthPx = Math.max((durationMs / 1000) * zoom + 4000, 4000)` — very long timelines produce huge scroll width and many DOM nodes (clips × tracks).

**Why it matters:** Performance and memory degrade on 30+ minute edits at high zoom.

**Fix direction:** Virtualize horizontal clip rendering (only clips intersecting viewport + margin).

---

### 🟡 MEDIUM — `editor-api.ts` appears unused — `frontend/src/features/editor/services/editor-api.ts`

**What:** No imports of this module were found elsewhere in `frontend/`; mutations duplicate `useAuthenticatedFetch` + inline URLs in components.

**Why it matters:** Drift between “canonical” API helpers and real callers; dead code confuses contributors.

**Fix direction:** Wire routes through this service or delete/consolidate with project fetch patterns.

---

### 🟡 MEDIUM — i18n rule violations (hardcoded user-facing strings)

**What:** Examples include `EditorLayout.tsx` toolbar `title="Back"`, `"Timeline"`, `"Tracks"`; `PreviewArea.tsx` `"Preview"`, `"Add clips to the timeline"`; `MediaPanel.tsx` effect/preset labels (`"Color Grade"`, `"Title Text"`, etc.); `ExportModal.tsx` `"Resolution"`, `"Frame Rate"`, resolution labels.

**Why it matters:** Violates project CLAUDE.md / localization standards; blocks locale rollout.

**Fix direction:** Add keys to `en.json` (and use `t()` everywhere in editor UI).

---

### 🟡 MEDIUM — Publish DB update omits `userId` in WHERE — `backend/src/routes/editor/index.ts` (~633–636)

**What:** After ownership is checked, `update(editProjects).where(eq(editProjects.id, id))` updates by id only.

**Why it matters:** Defense-in-depth gap: future refactors could call this path without the prior check. UUID ids reduce exploit likelihood but pattern is inconsistent with PATCH/DELETE.

**Fix direction:** Use `and(eq(editProjects.id, id), eq(editProjects.userId, auth.user.id))` on all mutating updates.

---

### 🔵 LOW — Fixed `minWidth: 1280` on editor shell — `EditorLayout.tsx` (~596)

**What:** Layout enforces a wide minimum width.

**Why it matters:** Small laptops/tablets get horizontal scroll; accessibility and responsive goals suffer.

**Fix direction:** Responsive breakpoints (stack timeline, collapsible panels) per adapt/normalize skills.

---

### 🔵 LOW — Browser `confirm()` for publish — `EditorLayout.tsx` (~812)

**What:** Native confirm dialog for destructive/important action.

**Why it matters:** Inconsistent with design system and poor a11y. (The string is translated via `t("editor_publish_confirm")`, so localization is not a concern here.)

**Fix direction:** Use existing `AlertDialog` pattern like script reset.

---

### 🔵 LOW — Duplicated timecode helpers — `EditorLayout.tsx` + `PreviewArea.tsx`

**What:** `formatHHMMSSFF` (and related) duplicated across files; `parseTimecode` and `formatHHMMSSFF` also sit at the top of `EditorLayout.tsx` above a very large component, so the file mixes transport/UI wiring with pure time math.

**Why it matters:** Divergent fixes (e.g. parse vs format), extra bundle noise, and a harder-to-scan module layout.

**Fix direction:** Shared `utils/timecode.ts` with tests; keep `EditorLayout` focused on composition.

---

### 🔵 LOW — `assetUrlMap` uses `(item as any)` — `EditorLayout.tsx` (~183–186)

**What:** Library items cast to `any` for URL fields.

**Why it matters:** Typing gaps hide missing fields or renames at compile time.

**Fix direction:** Narrow type from `useMediaLibrary` or a shared `AssetLike` interface.

---

### 🔵 LOW — AI assemble success replaces tracks without server persistence — `EditorLayout.tsx` (`aiAssemble` onSuccess)

**What:** `store.loadProject({ ...project, tracks: res.timeline })` updates client; relies on subsequent auto-save to persist.

**Why it matters:** If user navigates away before debounce, or save fails silently, work is lost.

**Fix direction:** Explicit save after assemble or server returns persisted project.

---

### ⚪ INFO — Module-level WaveSurfer cache — `use-waveform.ts` (`waveformCache`)

**What:** Global `Map` keyed by URL, shared across component instances.

**Why it matters:** Multiple editor tabs or future split views could contend for the same instance; usually OK but worth documenting limits.

**Fix direction:** Document lifecycle; optionally key by `url + instanceId`.

---

### ⚪ INFO — Transition styling coverage vs reducer types

**What:** Preview implements a subset of transition visual behavior (`getOutgoingTransitionStyle` / `getIncomingTransitionStyle`); not all types behave identically in UI vs export.

**Why it matters:** Users may see different results in ffmpeg output than in preview.

**Fix direction:** Matrix-test transition types across preview + export.

---

## Codebase structure, naming, and readability

### 🟡 MEDIUM — Inconsistent file naming for hooks — `hooks/use-waveform.ts`, `hooks/use-captions.ts` vs `hooks/usePlayback.ts`, `hooks/useEditorProject.ts`

**What:** Some hooks use **kebab-case** filenames (`use-waveform`, `use-captions`), others use **PascalCase/camelCase** segment (`usePlayback`, `useEditorStore`, `useEditorProject`). The monorepo CLAUDE.md does not define a single convention for this folder.

**Why it matters:** Imports and search are harder to predict; code review churn (“which style is correct?”); automated tooling (glob-based codemods, barrel generators) behaves inconsistently.

**Fix direction:** Pick one rule (e.g. all `useThing.ts` camelCase) and rename files in a single PR; document in CLAUDE.md or a feature README.

---

### 🟡 MEDIUM — Module name does not match primary export — `hooks/useEditorStore.ts` → `useEditorReducer`

**What:** The file is named `useEditorStore.ts` but the public API is `useEditorReducer()` (and type `EditorStore`). There is no Zustand/Jotai store — it is a `useReducer` facade.

**Why it matters:** New contributors look for “the editor store” and mis-mental-model state; grep/`import` paths read as misleading documentation.

**Fix direction:** Rename to `useEditorReducer.ts` (or `editor-reducer.ts`) and re-export from a thin `useEditorStore.ts` shim temporarily if you need a deprecation window.

---

### 🟡 MEDIUM — Non-hook code lives under `hooks/` — `hooks/use-caption-preview.ts` (`drawCaptionsOnCanvas`)

**What:** `drawCaptionsOnCanvas` is a **pure canvas drawing function**, not a React hook, but it sits beside `usePlayback`, `useWaveform`, etc.

**Why it matters:** Violates the “hooks are hooks” expectation; tree-shaking and test placement are unclear (`utils/` or `lib/` would signal “callable from anywhere”).

**Fix direction:** Move to `utils/caption-canvas.ts` or `components/preview/caption-draw.ts`; keep a tiny hook wrapper if needed.

---

### 🟡 MEDIUM — “God files” concentrate behavior — `useEditorStore.ts`, `EditorLayout.tsx`, `ClipContextMenu.tsx`

**What:** `useEditorStore.ts` bundles the full reducer, undo snapshots, merge-from-server, transitions, captions, and dozens of `useCallback` dispatchers (~800+ lines). `EditorLayout.tsx` orchestrates queries, mutations, autosave, polling merge, keyboard shortcuts, dialogs, and layout (~980 lines). `ClipContextMenu.tsx` exports **five** distinct menu components (`ClipContextMenu`, `PlaceholderContextMenu`, `TrackAreaContextMenu`, etc.) in one file.

**Why it matters:** Hard to review, test in isolation, or onboard; merge conflicts cluster on the same files; cognitive load when debugging a single concern (e.g. “paste” vs “export”).

**Fix direction:** Split reducer into `editorReducer.ts` + `editorActions.ts` or domain slices; extract hooks from `EditorLayout` (see backlog); split context menus by track/role or one folder with one component per file.

---

### 🔵 LOW — Duplicate ad-hoc `Asset` interfaces — `EditorLayout.tsx`, `MediaPanel.tsx`

**What:** Nearly identical `interface Asset { id; type; r2Url?; ... }` is declared at the top of multiple components instead of a shared type (or reuse of the API response type from the assets route).

**Why it matters:** Field drift (one file adds `audioUrl`, another forgets); refactors require touching several copies.

**Fix direction:** `types/editor-assets.ts` or import from a generated/shared API type aligned with `/api/assets`.

---

### 🔵 LOW — No feature-level barrel (`index.ts`) — `frontend/src/features/editor/`

**What:** There is no `index.ts` re-exporting the public entry points (`EditorLayout`, types, hooks used by routes). Route files import deep paths like `@/features/editor/components/EditorLayout`.

**Why it matters:** The **intended public surface** of the feature is implicit; harder to enforce “app imports only these symbols” and to refactor internals.

**Fix direction:** Add a minimal `index.ts` exporting only what routes and sibling features need; keep internals unexported.

---

### 🔵 LOW — Domain tables embedded in view components — `MediaPanel.tsx`, `Timeline.tsx`

**What:** Presets and routing tables (`EFFECTS`, `TEXT_PRESETS`, `ASSET_TYPE_TO_TRACK`) live inside large components instead of `constants/` or `config/`.

**Why it matters:** Harder to unit test without mounting UI; harder to reuse (e.g. server-side validation or docs); component files read as “layout + product catalog” mixed.

**Fix direction:** `constants/editor-effects.ts`, `constants/asset-track-routing.ts` with stable imports.

---

### 🔵 LOW — Duplicated magic numbers for autosave debounce — `EditorLayout.tsx`, `hooks/useEditorProject.ts`

**What:** Both use a `2000` ms debounce pattern for saving (separate `saveTimerRef` implementations).

**Why it matters:** Tuning save behavior requires two edits; risk of subtle divergence (one path 2s, another 1.5s after a partial refactor).

**Fix direction:** `const EDITOR_AUTOSAVE_DEBOUNCE_MS = 2000` in `constants/editor.ts` or shared `useDebouncedEditorSave` hook.

---

### ⚪ INFO — `export function` for components is consistent

**What:** Editor components overwhelmingly use named `export function Component` rather than default exports.

**Why it matters:** Refactors and “jump to definition” stay predictable; this is a **positive** pattern to preserve when splitting files.

**Fix direction:** None required; extend the same rule to new editor modules.

---

## Summary

**Top 3 risks to address immediately:**

1. **Audio speed ignored in preview and in ffmpeg export** — systematic A/V desync and wrong final renders.  
2. **Paste-to-track inference breaks after deleting the source clip** — silent wrong-track edits and bad saves.  
3. **Playhead-driven full-tree re-renders + N× `preload="auto"` videos** — performance ceiling for real projects.

**Patterns observed:**

- **Monolithic orchestration** in `EditorLayout` (queries, mutations, merge, save, keyboard, dialogs) fights testability and performance isolation.  
- **Implicit conventions** (undo scope, merge per track type, timecode formats) are undocumented and easy to get wrong.  
- **Duplicate / dead API layers** (`editor-api.ts` vs inline mutations) increase drift risk.  
- **Structural inconsistency**: hook filenames mix kebab-case and camelCase; `useEditorStore.ts` names a reducer; presets and `Asset` shapes are duplicated across files instead of shared modules.

**What’s actually solid:**

- **Backend PATCH/GET** generally enforce `userId` alongside project id; JSON validation with zod is thorough for clip/track shape.  
- **Placeholder polling + script reset dialog** show thoughtful conflict handling for async generation.  
- **`usePlayback` + ref-based keyboard handler** avoid re-subscribing listeners every frame — good pattern to extend to other hot paths.

---

## Improvement backlog (performance · scalability · modularity)

Use this as a prioritized engineering backlog (not all items are defects; many are structural improvements).

| Theme | Recommendation |
|--------|----------------|
| **Performance** | Window video/audio elements by playhead; reduce `preload`; memoize `Timeline`/`TimelineClip` rows; move playhead to ref-driven subscribers for subcomponents. |
| **Performance** | Virtualize timeline horizontally; debounce or throttle waveform creation for off-screen clips. |
| **Scalability** | Cap undo stack memory (currently full `tracks` snapshots × 50 — large JSONB projects are expensive); consider structural sharing or patch-based undo. |
| **Modularity** | Extract `useEditorServerSync`, `useEditorAutosave`, `useEditorKeyboard`, `useEditorMutations` from `EditorLayout`. |
| **Modularity** | Split reducer into slice reducers or use a small state machine for merge vs local edit modes. |
| **Correctness** | Single source of truth for timecode parse/format; tests for edge cases (fps change, midnight-length timelines). |
| **Correctness** | Copy/paste model: store `trackId` + clip payload; paste respects locked tracks and target focus. |
| **API consistency** | Use `editor-api.ts` (or delete it) so CSRF/auth/error handling stay uniform. |
| **i18n** | Sweep editor for hardcoded strings; align with `en.json` keys. |
| **A11y** | Replace `confirm`; ensure keyboard shortcuts don’t fire in contenteditable; focus management for AI menu. |
| **Testing** | Component tests for merge reducer, parseTimecode, paste track selection; integration test publish-after-save ordering. |
| **Readability / conventions** | Standardize hook file naming; rename `useEditorStore.ts` → `useEditorReducer.ts`; move non-hook helpers out of `hooks/`. |
| **Readability / conventions** | Split `ClipContextMenu` and reducer into smaller files; add `constants/` for presets and debounce ms; optional feature `index.ts` barrel. |

---

*Generated as an adversarial / red-team style review of the editor feature. Severity labels follow the red-team reviewer scale (critical → info).*
