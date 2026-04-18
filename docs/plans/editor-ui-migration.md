# Editor UI Migration — Plan

> **Date:** 2026-04-17
> **Status:** Draft
> **Deciders:** Kenneth Atchon

---

## 1. Problem Statement

The ReelStudio editor has a functional but visually underdeveloped layout. The current `EditorToolbar` is a single dense bar that mixes playback transport, export controls, title editing, zoom, fps, resolution, and save state into one horizontal strip — making it cognitively overloaded and visually cluttered. The left `MediaPanel` has no icon rail, so switching tabs is hidden behind flat text tabs that collapse awkwardly on smaller viewports. The right `Inspector` has no per-section collapsing, no type badge on the selected element, and no Animate or Effects tabs. The `PreviewCanvas` has no top strip with quality or grid controls, and its transport is stranded in the toolbar far away from the video. The Timeline lacks a dedicated tool strip.

The reference design in `docs/Video Editor/` (codename "Lumen") solves all of these with a clean 5-zone layout: slim header → left icon-rail panel → center preview+timeline column → right properties panel → status bar. The zones are visually distinct, transport is adjacent to the preview, and every panel has a single clear purpose.

The migration is a **complete replacement** of the editor shell: every layout component is deleted and rewritten to match Lumen's structure. All inner code (reducer, engine workers, API hooks, caption system, export system) is untouched.

---

## 2. Goals & Non-Goals

### Goals

| # | Goal | Success Looks Like |
|---|------|--------------------|
| 1 | 5-zone layout matching Lumen | `h-12` header / icon-rail left panel / preview+timeline column / right panel / `h-6` status bar — all rendering correctly at 1440px min-width |
| 2 | Playback transport adjacent to preview | Transport bar directly below `PreviewCanvas`, not in the toolbar |
| 3 | Left panel icon rail | 56px icon rail + 244px content area; tabs are icon buttons in the rail |
| 4 | Timeline tool strip | Dedicated h-10 strip with blade tool, snap toggle, timecode display, and zoom slider |
| 5 | Right panel type-badge + collapsible sections | Selection badge, Adjust/Animate/Effects/Project tabs, collapsible `InspectorSection` |
| 6 | Status bar | Bottom h-6 bar: clip count, autosave time, connection state, resolution/fps |
| 7 | No functionality regression | All reducer actions, API calls, engine/worker plumbing, caption sync, export, and publish flows work identically |

### Non-Goals

| # | Non-Goal | Reason |
|---|----------|--------|
| 1 | Change the color system / brand | Requirement: theme stays the same |
| 2 | Add new editor features | Layout replacement only |
| 3 | Change the backend API | Off-limits |
| 4 | Change the compositor/engine/workers | Only shell UI components change |
| 5 | Rename CSS variables (`--studio-*` → anything else) | Would cascade into every component; separate concern |
| 6 | Add real-time collaboration avatars | Out of scope |
| 7 | Add Color / Audio workspace modes | Single Edit mode for now |

---

## 3. Background & Context

### What Gets Deleted

Every file in `components/layout/` is deleted and replaced. Inspector and panel components are deleted and rewritten. The timeline gains a new strip but the core `Timeline.tsx` internals are preserved.

```
DELETED — replaced completely:
  components/layout/EditorLayout.tsx
  components/layout/EditorWorkspace.tsx
  components/layout/EditorToolbar.tsx
  components/layout/EditorTimelineSection.tsx
  components/panels/MediaPanel.tsx
  components/panels/ShotOrderPanel.tsx
  components/inspector/Inspector.tsx
  components/inspector/InspectorClipMetaPanel.tsx
  components/inspector/InspectorClipVisualPanel.tsx
  components/inspector/InspectorTextAndCaptionPanels.tsx
  components/inspector/InspectorTransitionPanel.tsx
  components/inspector/InspectorPrimitives.tsx

PRESERVED — not touched:
  components/timeline/Timeline.tsx
  components/timeline/TimelineRuler.tsx
  components/timeline/Playhead.tsx
  components/timeline/TimelineClip.tsx
  components/timeline/TrackHeader.tsx
  components/timeline/SortableTrackHeader.tsx
  components/timeline/TransitionDiamond.tsx
  components/timeline/WaveformBars.tsx
  components/timeline/ClipContextMenu.tsx
  components/preview/PreviewCanvas.tsx
  components/dialogs/  (all dialogs)
  components/caption/  (all caption components)
  model/               (all reducer files)
  engine/              (all engine/worker files)
  hooks/               (all hooks)
```

### Current Layout (ASCII) — what we're replacing

```
┌──────────────────────────────────────────────────────────────────────┐
│ EditorToolbar (fat, all controls crammed in one row)                 │
├──────────┬─────────────────────────────────────────┬─────────────────┤
│ Media    │                                         │                 │
│ Panel    │        PreviewCanvas                    │   Inspector     │
│ (flat    │        (flex-1)                         │   (flat panels) │
│  tabs)   │                                         │                 │
├──────────┴─────────────────────────────────────────┴─────────────────┤
│ Timeline (h-296px, no tool strip)                                    │
└──────────────────────────────────────────────────────────────────────┘
```

### Target Layout (ASCII) — what we're building

```
┌──────────────────────────────────────────────────────────────────────┐
│ EditorHeader (h-12): logo · title · undo/redo · save · export ·     │
│ publish                                                              │
├────┬─────┬───────────────────────────────────────────┬──────────────┤
│    │     │  PreviewTopStrip (h-10): rec · quality ·  │              │
│ I  │     │  grid · safe areas                        │              │
│ c  │ Con ├───────────────────────────────────────────┤  Inspector   │
│ o  │ t   │                                           │  (320px)     │
│ n  │ e   │     PreviewCanvas (flex-1)                │              │
│    │ n   │                                           │  — selection │
│ r  │ t   │                                           │    badge     │
│ a  │     ├───────────────────────────────────────────┤  — tabs:     │
│ i  │ 2   │  PlaybackBar (h-14): transport · timecode │    Adjust    │
│ l  │4   │  · volume                                  │    Animate   │
│    │ 4   ├───────────────────────────────────────────┤    Effects   │
│ 5  │ p   │  TimelineToolstrip (h-10): blade · snap · │    Project   │
│ 6  │ x   │  timecode · zoom                          │              │
│ p  │     ├───────────────────────────────────────────┤  — collap-   │
│ x  │     │  Timeline (flex-1): ruler + tracks        │    sible     │
│    │     │                                           │    sections  │
├────┴─────┴───────────────────────────────────────────┴──────────────┤
│ EditorStatusBar (h-6): clips · tracks · autosave · fps · resolution │
└──────────────────────────────────────────────────────────────────────┘
```

### Constraints

- **Theme tokens stay**: `--studio-bg`, `--studio-surface`, `--studio-topbar`, `--studio-accent`, `--studio-purple`, `--text-dim-*`, `--overlay-*`. Do **not** rename or add new CSS variables.
- **Reducer untouched**: No new actions, no structural changes to `EditorState`.
- **Route unchanged**: `/studio/editor` with `projectId` + `contentId` search params.
- **i18n**: All user-visible strings through `react-i18next`, added to `en.json`.

---

## 4. Research Summary

**Professional video editor layout conventions**
Adobe Premiere Pro, DaVinci Resolve, and CapCut all share the same 5-zone pattern: top toolbar, left media browser with icon rail, center preview+timeline column, right properties, bottom status. The icon rail is the key differentiator — it lets the left panel expand to show any one category without showing all category tabs simultaneously. Resolve's Inspector uses collapsible sections; Premiere's Effect Controls does the same. Both are studied in UX research as "efficient panel layouts" for complex applications.
- Key insight: The icon rail pattern is specifically designed for editors where the user rapidly switches between media library, text tools, and uploads. A flat tab bar forces all categories to share the same label width and collapses on narrow viewports.

**Transport bar placement**
Eye-tracking research consistently shows users look at the preview while reaching for transport controls. When transport is in the top toolbar (far from preview), users scan a longer distance between the playhead and the play button. Placing transport immediately below the preview (as Lumen and most NLEs do) reduces that scan distance to near-zero.
- Key insight: Moving transport from toolbar to `PlaybackBar` directly below `PreviewCanvas` is a validated UX pattern, not stylistic preference.

**Collapsible inspector sections**
Radix Collapsible and headless-ui Disclosure are the standard approach for dense property panels. Collapsible state is local UI state — it doesn't need to persist across sessions or enter the reducer.
- Key insight: Collapsible behavior lives entirely in the component; zero reducer changes required.

---

## 5. Options Considered

### Option A: Status Quo — Do Nothing

Keep the current layout, continue bolting controls onto the existing flat toolbar.

| Dimension | Assessment |
|-----------|------------|
| Complexity | None now, compounding debt later |
| Stack fit | Poor — toolbar already at max capacity |

**Why rejected:** Every new feature (Animate tab, Effects tab, blade tool) requires the same restructuring work, done later under worse conditions.

---

### Option B: Minimal — Toolbar Split Only

Split `EditorToolbar` into a slim header + transport bar below preview. Leave left panel, right panel, and timeline unchanged.

| Dimension | Assessment |
|-----------|------------|
| Complexity | Low (~1 day) |
| Coverage | Solves ~20% of the layout problem |

**Why rejected:** Doesn't address the icon rail, timeline toolstrip, or inspector improvements. Will need revisiting within 1–2 months. Two partial migrations cost more than one complete one.

---

### Option C (Recommended): Complete Shell Replacement

Delete every layout/panel/inspector component and write replacements matching the Lumen 5-zone structure. All inner engine/reducer/API code stays.

| Dimension | Assessment |
|-----------|------------|
| Complexity | Medium — ~12 files deleted, ~15 new components written |
| Performance | No change — no new network calls or reducer changes |
| Reliability | Medium risk — layout restructuring can introduce scroll/resize bugs; mitigated by phased delivery |
| Cost | ~4 days |
| Reversibility | Easy — changes are entirely in shell UI; engine/reducer untouched |
| Stack fit | Excellent — follows existing Tailwind + component conventions |

---

## 6. Recommendation

**We recommend Option C: Complete Shell Replacement.**

Over Option A: toolbar is already full. The next feature request forces the same work anyway.

Over Option B: a partial migration solves one of six problems. Doing all six in one pass avoids re-opening the same files twice.

**Key assumptions:**
1. `PreviewCanvas` ResizeObserver remeasures automatically when its parent changes — no internal code changes needed.
2. Existing CSS variables support the new layout without additions.

**Conditions that would change this:**
- If ResizeObserver is parent-sensitive → Phase 3 needs a patch to `PreviewCanvas.tsx`; still fine.
- Hard deadline preventing 4 days → fall back to Option B as fast path.

---

## 7. Implementation Plan

Each phase deletes the old code and replaces it with new. No phase patches or extends existing components — it removes them.

---

### Phase 1: Replace EditorToolbar → EditorHeader (Day 1, ~4h)

**Goal:** Delete `EditorToolbar.tsx`. Write `EditorHeader.tsx` from scratch as a slim h-12 bar.

**Replaces:** `EditorToolbar.tsx` → `EditorHeader.tsx`

**Done criteria:** Header is exactly h-12. Title editable inline. Save state indicator (unsaved dot + timestamp). Undo/redo buttons with disabled state. Export and Publish buttons on the right. Zero transport, zoom, or resolution controls in header.

**Deliverables:**
- [ ] Delete `EditorToolbar.tsx`
- [ ] Write `EditorHeader.tsx`:
  - Left: logo mark + `APP_NAME` label + divider + editable project title inline input + save state dot
  - Center: empty (reserved for mode tabs in a future iteration)
  - Right: undo button (disabled when no past) + redo button (disabled when no future) + divider + share ghost button + save subtle button + export primary button + publish primary button
  - All wired to `useEditorContext()` (title dispatch `SET_TITLE`, undo/redo `UNDO`/`REDO`, export opens `ExportModal`)
- [ ] Write new `EditorLayout.tsx` that renders `EditorHeader` at top
- [ ] Add i18n keys: `editor_header_save`, `editor_header_export`, `editor_header_publish`, `editor_header_undo`, `editor_header_redo`

**Dependencies:** None.

**Risks:** Old `EditorToolbar` may have been the only place dispatching some actions. Audit `EditorToolbar.tsx` before deleting — move any orphaned dispatches into the new header or the phase where they belong (transport → Phase 3, zoom → Phase 4).

**Rollback:** Restore `EditorToolbar.tsx` from git; revert `EditorLayout.tsx`.

---

### Phase 2: Replace MediaPanel → LeftPanel with Icon Rail (Day 1–2, ~3h)

**Goal:** Delete `MediaPanel.tsx` and `ShotOrderPanel.tsx`. Write `LeftPanel.tsx` from scratch with a 56px icon rail + 244px content column.

**Replaces:** `MediaPanel.tsx` + `ShotOrderPanel.tsx` → `LeftPanel.tsx`

**Done criteria:** Icon rail shows four icons (Media, Audio, Generate, Uploads). Clicking each shows correct content panel. Active icon highlighted. Search input filters assets in Media and Audio tabs. Panel total width exactly 300px.

**Deliverables:**
- [ ] Delete `MediaPanel.tsx`
- [ ] Delete `ShotOrderPanel.tsx`
- [ ] Write `LeftPanel.tsx`:
  - Outer: `w-[300px] shrink-0 flex bg-studio-surface border-r border-overlay-sm`
  - Icon rail (`w-[56px]`): icon buttons for Media (`film`), Audio (`wave`), Generate (`sparkle`), Uploads (`upload`) + active highlight state
  - Content column (`flex-1`): title + asset count badge + search input + scrollable content area + (for Media/Audio) storage footer
  - Media tab: grid/list toggle, asset cards with drag-to-insert, shot order sort button that shows an inline reorderable list
  - Audio tab: voiceover list + music list
  - Generate tab: same UI as current Generate tab
  - Uploads tab: drag-drop zone + recent uploads list
- [ ] Update `EditorWorkspace.tsx` (being rewritten in Phase 3) to slot `LeftPanel` on the left

**Dependencies:** Phase 1 complete (layout height stable).

**Risks:** Asset drag-to-timeline uses `onInsertAsset` callback. New `LeftPanel` must pass the same callback interface. Verify the drag-drop wire is intact after rewrite.

**Rollback:** Restore `MediaPanel.tsx` + `ShotOrderPanel.tsx` from git.

---

### Phase 3: Replace PreviewCanvas wrapper → PreviewArea (Day 2, ~4h)

**Goal:** Delete `EditorWorkspace.tsx`. Write a new `EditorWorkspace.tsx` that arranges `LeftPanel` + `PreviewArea` + `Inspector`. Write `PreviewArea.tsx`, `PreviewTopStrip.tsx`, and `PlaybackBar.tsx` from scratch. Move all transport controls out of `EditorHeader` and into `PlaybackBar`.

**Replaces:** `EditorWorkspace.tsx` (layout) → new `EditorWorkspace.tsx` + `PreviewArea.tsx` + `PreviewTopStrip.tsx` + `PlaybackBar.tsx`

**Done criteria:** `PreviewTopStrip` shows rec indicator, resolution label, quality seg (Full/½/¼), grid toggle, safe-areas toggle. `PlaybackBar` shows jump-to-start, step-back, play/pause, step-fwd, jump-to-end, timecode display (current/total), volume slider. `PreviewCanvas` fills remaining height and ResizeObserver produces correct canvas scale at all viewport widths.

**Deliverables:**
- [ ] Delete `EditorWorkspace.tsx`
- [ ] Write `EditorWorkspace.tsx`: `flex flex-1 min-h-0` row of `LeftPanel` + `PreviewArea` (flex-1) + `Inspector`
- [ ] Write `PreviewTopStrip.tsx`:
  - Left: `● REC · PREVIEW` label + resolution string from store
  - Right: quality seg `['Full','½','¼']` (local state — does not touch compositor yet), grid toggle, safe-areas toggle, fullscreen button
- [ ] Write `PlaybackBar.tsx`:
  - Transport: jump-to-start, step-back, play/pause (round button), step-fwd, jump-to-end — all via `useEditorTransport()`
  - Timecode pill: `formatTC(currentTimeMs/1000, fps) / formatTC(durationMs/1000, fps)` in monospace
  - Volume: icon + range slider (local state for now)
  - Right: Split button (`SPLIT_CLIP` at `currentTimeMs`)
- [ ] Write `PreviewArea.tsx`: `flex flex-col flex-1 min-h-0` containing `PreviewTopStrip` + `PreviewCanvas` (flex-1) + `PlaybackBar`
- [ ] `PreviewCanvas.tsx` is **not touched** — it slots in unchanged
- [ ] Test: resize window 1280→1920 while video plays — canvas must scale correctly

**Dependencies:** Phase 1 + 2.

**Risks:** ResizeObserver in `PreviewCanvas` uses the bounding rect of its container element. If the new parent changes the available height (because `PlaybackBar` h-14 and `PreviewTopStrip` h-10 now consume space above/below), the scale calculation will be slightly off. If it doesn't auto-correct: subtract `(10+14)*scale` from the available height in the ResizeObserver callback — a one-line fix inside `PreviewCanvas.tsx`.

**Rollback:** Restore old `EditorWorkspace.tsx`; remove `PreviewArea.tsx`, `PreviewTopStrip.tsx`, `PlaybackBar.tsx`.

---

### Phase 4: Replace EditorTimelineSection → TimelineSection with Toolstrip (Day 3, ~3h)

**Goal:** Delete `EditorTimelineSection.tsx`. Write `TimelineSection.tsx` from scratch with a `TimelineToolstrip` above `Timeline`.

**Replaces:** `EditorTimelineSection.tsx` → `TimelineSection.tsx` + `TimelineToolstrip.tsx`

**Done criteria:** Toolstrip (h-10) renders above the ruler with select tool, blade tool, snap toggle, magnetic toggle, timecode display, zoom range slider. `Timeline.tsx` inner component is unchanged. Track headers are `w-[188px]`. Timeline body height is sufficient (at least 250px of track area visible).

**Deliverables:**
- [ ] Delete `EditorTimelineSection.tsx`
- [ ] Write `TimelineToolstrip.tsx`:
  - Left: select tool icon button (always active for now), blade/split icon button, link/unlink icon button (stub), divider, snap toggle button, magnetic toggle button
  - Center: spacer
  - Right: timecode display (`formatTC`), divider, zoom-out icon + range slider (min 6, max 200, step 1, value from store zoom) wired to `useEditorTransport().setZoom()`, zoom-in icon, px/s readout
  - `snap` and `magnetic` are local state inside `TimelineToolstrip` — passed down to `Timeline` via props
- [ ] Write `TimelineSection.tsx`: `flex flex-col h-[340px] shrink-0` containing `TimelineToolstrip` + `Timeline`
- [ ] Audit `Timeline.tsx`: confirm track header column width is `w-[188px]`; update if different
- [ ] Update `EditorLayout.tsx` to render `TimelineSection` instead of old section

**Dependencies:** Phase 1–3.

**Risks:** `Timeline.tsx` may currently receive `snap` as a prop from the old section wrapper. If `snap` was previously in the old `EditorTimelineSection`, it moves to `TimelineToolstrip`. If it was in the reducer or a hook, read it from there instead.

**Rollback:** Restore `EditorTimelineSection.tsx`; remove `TimelineSection.tsx` + `TimelineToolstrip.tsx`.

---

### Phase 5: Replace Inspector shell (Day 3–4, ~5h)

**Goal:** Delete `Inspector.tsx`, `InspectorClipMetaPanel.tsx`, `InspectorClipVisualPanel.tsx`, `InspectorTextAndCaptionPanels.tsx`, `InspectorTransitionPanel.tsx`, `InspectorPrimitives.tsx`. Write all from scratch.

**Replaces:** All 6 inspector files → new `Inspector.tsx` + `InspectorHeader.tsx` + `InspectorSection.tsx` + `InspectorPropRow.tsx` + `AdjustTab.tsx` + `AnimateTab.tsx` + `EffectsTab.tsx` + `ProjectTab.tsx` + clip-type sub-panels

**Done criteria:** Selection badge shows `VIDEO`/`AUDIO`/`MUSIC`/`TEXT`/`CAPTION`/`TRANSITION` in correct track color. Tab strip: Adjust | Animate | Effects | Project. Every section header has a chevron that collapses its body. Adjust tab shows same properties as current (timing, opacity, position, speed, caption style). Animate and Effects tabs show stub "Coming soon" content. Project tab shows fps, resolution, duration read-only.

**Deliverables:**
- [ ] Delete all 6 inspector files
- [ ] Write `InspectorSection.tsx`: title bar (uppercase tracking-wider label + chevron button) + collapsible body; `defaultOpen` prop (default true); collapse state is local
- [ ] Write `InspectorPropRow.tsx`: label + control in a flex row; replaces old `InspectorPropRow` primitive
- [ ] Write `InspectorHeader.tsx`:
  - Top row: kind badge (colored pill: VIDEO/AUDIO/etc.) + clip name (truncated) + lock/eye/more icon buttons
  - Tab row: Adjust | Animate | Effects | Project — tab state is local
- [ ] Write `Inspector.tsx`: `w-[320px] shrink-0 flex flex-col bg-studio-surface border-l border-overlay-sm`; renders `InspectorHeader` + scrollable content area; routes content by active tab and selected clip type
- [ ] Write `AdjustTab.tsx`: contains all current adjust panels rewritten using new `InspectorSection` + `InspectorPropRow`
  - `ClipTimingSection` (start, duration, speed selector, enabled toggle)
  - `ClipVisualSection` (opacity, warmth, contrast, position X/Y, scale, rotation)
  - `ClipTextSection` (text content + style — for TextClip only)
  - `CaptionSection` (preset picker, style overrides, transcript editor — for CaptionClip only)
  - `TransitionSection` (type selector, duration — for transitions)
  - All wired to same hooks as before (`useEditorClipActions`, `useEditorContext`, caption hooks)
- [ ] Write `AnimateTab.tsx`: stub with a grid of animation preset tiles (visual only, no dispatch)
- [ ] Write `EffectsTab.tsx`: stub with effect stack list (visual only)
- [ ] Write `ProjectTab.tsx`: read-only display of `title`, `fps`, `resolution`, `durationMs` from store + scratch notes textarea (local state)
- [ ] Add i18n keys: `editor_inspector_tab_adjust`, `editor_inspector_tab_animate`, `editor_inspector_tab_effects`, `editor_inspector_tab_project`
- [ ] **Test every clip type**: select video clip → Adjust shows timing + visual. Select audio clip → timing + volume. Select text clip → timing + text style. Select caption clip → caption preset + transcript. Select transition → type + duration. No selection → empty state.

**Dependencies:** Phase 1–4.

**Risks:** `InspectorTextAndCaptionPanels.tsx` contains complex caption conditional logic. When rewriting, preserve every `if (clip.type === 'caption')` branch exactly. If unsure about a branch, copy the logic verbatim from the deleted file.

**Rollback:** Restore all 6 inspector files from git.

---

### Phase 6: Add EditorStatusBar (Day 4, ~1h)

**Goal:** Write `EditorStatusBar.tsx` from scratch. Render it at the bottom of `EditorLayout`.

**Replaces:** Nothing (new component).

**Done criteria:** h-6 bar visible at bottom. Shows clip count + track count. Shows autosave state (last saved N seconds ago / saving… / unsaved). Shows fps + resolution. Shows connection dot.

**Deliverables:**
- [ ] Write `EditorStatusBar.tsx`:
  - Left: `{clipCount} clips · {trackCount} tracks` — derived from `store.tracks`
  - Center: save state string — derived from existing autosave hook
  - Right: `{resolution} · {fps} fps` + `● connected`
- [ ] Update `EditorLayout.tsx` to render `EditorStatusBar` at bottom (after `TimelineSection`)

**Dependencies:** All prior phases.

**Risks:** Minimal. Adding h-6 reduces total usable height by 24px. If timeline or preview feels cramped, increase `TimelineSection` height to 360px.

**Rollback:** Remove `EditorStatusBar` from `EditorLayout.tsx`; delete the file.

---

### Phase 7: Integration & Cleanup (Day 4, ~2h)

**Goal:** Verify the complete replacement compiles, passes lint + type-check, and all user flows work end-to-end.

**Deliverables:**
- [ ] `bun run type-check` — zero errors
- [ ] `bun run lint` — zero warnings in new files
- [ ] Delete any residual dead imports or orphaned files from old layout
- [ ] Manual flow: play a video, scrub timeline, select clip, adjust opacity, split clip, undo/redo
- [ ] Manual flow: create caption clip, edit transcript, check sync badge
- [ ] Manual flow: open export modal, set resolution, enqueue — verify export dispatches correctly
- [ ] Manual flow: open publish dialog
- [ ] Viewport test: 1280px — no overflow, no hidden controls
- [ ] Viewport test: 1920px — layout fills correctly, no awkward stretching
- [ ] Audit `en.json` — all new keys from Phases 1–6 present

**Rollback:** N/A — individual phase rollbacks apply.

---

## 8. Risk Register

| # | Risk | Likelihood | Impact | Mitigation |
|---|------|-----------|--------|------------|
| 1 | PreviewCanvas scale wrong after parent restructure | Low | High | Phase 3 includes explicit resize test; one-line fix if needed |
| 2 | Timeline track area too short after Toolstrip (340px total) | Medium | Medium | Increase `TimelineSection` height to 360px if empirically needed |
| 3 | Caption/text inspector rewrite breaks conditional rendering | Medium | High | Copy caption logic verbatim from deleted file; test all clip types |
| 4 | Drag-to-timeline breaks after LeftPanel rewrite | Low | High | Verify `onInsertAsset` callback wire before finishing Phase 2 |
| 5 | Orphaned dispatch calls when EditorToolbar deleted | Low | Medium | Audit all dispatches in old toolbar before deleting; place each in its correct new phase |

---

## 9. Success Criteria

| Goal | Metric | Baseline | Target | How Measured |
|------|--------|----------|--------|--------------|
| Header h-12 | Computed height | ~50px (variable) | 48px | DevTools |
| Transport below preview | Play button location | In header | In PlaybackBar below canvas | Visual |
| Left panel icon rail | Rail visible | Not present | 56px rail + 244px content | Visual |
| Timeline toolstrip | Tool controls above ruler | Not present | h-10 strip present | Visual |
| Inspector collapsible | Sections toggle | Flat, no toggle | All sections collapse/expand | Click test |
| Status bar | Bottom bar | Not present | h-6 bar with correct data | Visual |
| Zero type errors | `bun run type-check` | Pass | Pass | CI |
| No functionality regression | Full user flow | All working | All working | Manual |

---

## 10. Open Questions

| # | Question | Owner | Needed By | Status |
|---|----------|-------|-----------|--------|
| 1 | Does `PreviewCanvas` ResizeObserver auto-remeasure after parent DOM change, or does it need an explicit trigger? | Kenneth | Phase 3 day 1 | Open — test on first render |
| 2 | Should the quality selector (Full/½/¼) throttle the compositor worker, or stay UI-only for now? | Kenneth | Phase 3 | Open — stub as local state initially |
| 3 | Is the blade tool wired in Phase 4 (dispatches `SPLIT_CLIP`) or stubbed visual-only? | Kenneth | Phase 4 | Open — `SPLIT_CLIP` already exists; wiring is easy |
| 4 | Is 340px enough total timeline height after adding the 40px toolstrip? | Kenneth | Phase 4 | Open — test empirically; bump to 360px if needed |

---

## 11. Alternatives Rejected

| Option | Why Rejected |
|--------|-------------|
| Status quo | Toolbar already at capacity; next feature forces same work anyway |
| Toolbar-only split (Option B) | Solves 20% of the layout problem; leaves icon rail, timeline toolstrip, inspector unreleased |
| Adopt Lumen CSS variable naming (`--c-base`, `--c-panel`) | Theme migration is a separate concern; keeping `--studio-*` avoids cascading changes across all existing components |
| Storybook + component library before migrating | Over-engineering for a solo dev on an active-development app with no production users |
