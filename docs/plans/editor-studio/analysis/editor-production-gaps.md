# Editor Production Gaps — Analysis & Roadmap

_Last updated: 2026-03-23_
_Companion to: `docs/editor-timeline-analysis.md` (red team report + library evaluation)_

This document is the living planning reference for bringing the ContentAI editor to production quality. It covers:
- All currently non-functional or partially-functional controls
- Right-click context menu design
- Industry standard comparison (DaVinci Resolve / Premiere Pro / Final Cut Pro)
- Identified gaps and the specific fixes required for each

---

## Table of Contents

1. [Broken / Non-Functional Controls Inventory](#1-broken--non-functional-controls-inventory)
2. [Right-Click Context Menu Design](#2-right-click-context-menu-design)
3. [Industry Standard Comparison](#3-industry-standard-comparison)
4. [Gap Analysis & Fix Roadmap](#4-gap-analysis--fix-roadmap)
5. [Reference Implementations](#5-reference-implementations)

---

## 1. Broken / Non-Functional Controls Inventory

### 1.1 Inspector Panel

| Control | Status | What's Wrong |
|---|---|---|
| Speed dropdown (0.25× – 4×) | 🟡 Partial | Sets `clip.speed` and `el.playbackRate` — video plays at the right speed. But `usePlayback.ts` always advances `currentTimeMs` at wall-clock rate. Playhead desync at non-1× speeds. |
| Warmth slider | 🟡 Partial | Now applies a CSS `sepia()+saturate()` approximation (fixed in last session). Not perceptually accurate — needs SVG feColorMatrix or canvas-based LUT. |
| Opacity slider | ✅ Works | Applied correctly in PreviewArea. |
| Contrast slider | ✅ Works | Applied via CSS `contrast()`. |
| Scale / Rotation / Position | 🟡 Video only | Applied to video elements via CSS transform. Text clips and audio clips have these properties in the data model but nothing renders them. |
| Mute toggle (clip) | ✅ Works | Sets `clip.muted`, now respected by audio elements (fixed in last session). |
| Volume slider (clip) | ✅ Works | Sets `clip.volume`, now respected by audio elements (fixed in last session). |
| Remove Transition button | 🔴 Missing | `onRemoveTransition` prop exists and is passed to Inspector but is renamed `_onRemoveTransition` (unused). No delete button rendered in the transition section. Users can only set type to "none" — the transition record remains in state permanently. |
| Text content textarea | 🔴 Not visible in preview | Text clips from the Text tab have `textContent` but no `captionWords`. PreviewArea only renders text track clips that have `captionWords` (via caption canvas). Plain text clips are entirely invisible during preview. |
| Caption position Y slider | 🔴 Not in UI | `captionPositionY` exists on the data model (defaulting to 80) and is read by `use-caption-preview.ts`. There is no control for it in the Inspector. |

### 1.2 Toolbar Buttons

| Control | Status | What's Wrong |
|---|---|---|
| Undo (Cmd+Z) | ✅ Works | — |
| Redo (Cmd+Shift+Z / Y) | ✅ Works | — |
| Jump to Start | ✅ Works | — |
| Rewind 5s | ✅ Works | — |
| Play / Pause | ✅ Works | — |
| Fast Forward 5s | ✅ Works | — |
| Jump to End | ✅ Works | — |
| Zoom In / Out | ✅ Works | — |
| Zoom Fit | ✅ Fixed | Was using hardcoded 800px. Now reads actual container width via ref. |
| Timecode display | 🟡 Display only | Industry standard: click to enter a timecode value and jump there. Ours is a `<span>`, not interactive. |
| Export | ✅ Works | Resolution + fps selection, polling for status, download link. |
| Publish | ✅ Fixed | Now flushes debounced save before locking. |
| AI Assemble | ✅ Works | Platform picker + mutation. |

### 1.3 Timeline Controls

| Control | Status | What's Wrong |
|---|---|---|
| Drag clip to move | ✅ Works | DOM-direct during drag, single commit on mouseUp, snap support. |
| Trim left handle | ✅ Fixed | Now buffers values, single dispatch on mouseUp, clamps against previous clip. |
| Trim right handle | ✅ Fixed | Now buffers values, single dispatch on mouseUp, clamps against next clip. |
| Track mute button | 🔴 Partial | Toggles `track.muted` in state. Video tracks: unimplemented entirely. Audio tracks: `PreviewArea` audio elements only check `clip.muted`, not `track.muted`. Muting a whole track has no effect on playback. |
| Track lock button | ✅ Works | Prevents drag/trim on clips. |
| Transition diamond | ✅ Fixed | No longer creates spurious undo entries on click. Only renders between adjacent clips (≤500ms gap). |
| Playhead scrub | ✅ Works | Drag handle, seeks timeline. |
| Ruler click to seek | ✅ Works | — |
| Right-click anywhere | 🔴 Missing | No context menus exist anywhere in the editor. |

### 1.4 Keyboard Shortcuts

| Shortcut | Status | What's Wrong |
|---|---|---|
| Space (play/pause) | ✅ Works | — |
| ← / → (frame step) | ✅ Works | — |
| Cmd+Z / Cmd+Shift+Z | ✅ Works | — |
| Delete / Backspace | ✅ Works | Removes selected clip. |
| S (split at playhead) | ✅ Works | — |
| Cmd+D (duplicate) | ✅ Works | — |
| Cmd+C / Cmd+V (copy/paste) | 🔴 Missing | No clipboard support for clips. |
| [ / ] (trim to playhead) | 🔴 Missing | Common NLE shortcut. |
| M (add marker) | 🔴 Missing | Markers not implemented. |
| J / K / L (JKL scrub) | 🔴 Missing | Industry standard variable-speed scrubbing. |
| Escape (deselect) | 🔴 Missing | Click on empty space deselects, but Escape doesn't. |

### 1.5 MediaPanel

| Control | Status | What's Wrong |
|---|---|---|
| Video asset click | ✅ Works | Adds at `currentTimeMs`. |
| Video asset drag to timeline | ✅ Works | MIME type validated, position calculated. |
| Library item click | ✅ Works | — |
| Library item drag | 🔴 Missing | Library items have `onClick` only. No `draggable` + `onDragStart`. Cannot drag library items to timeline. |
| Audio asset click | ✅ Works | Adds to correct track. |
| Audio asset drag | ✅ Works | — |
| Effects apply | ✅ Works | Sets contrast/warmth/opacity on selected clip. |
| Effects preview on hover | 🔴 Missing | No visual thumbnail preview of what each effect does. |
| Text preset click | 🟡 Partial | Creates text clip. But text clips don't render in preview (see 1.1). |

---

## 2. Right-Click Context Menu Design

Right-click menus are the single highest-leverage UX improvement for the timeline. Every major NLE uses them. Here is the full design for implementation.

### 2.1 On a Clip (non-placeholder)

```
┌─────────────────────────────────┐
│  Split at Playhead        S     │
│  Duplicate               Cmd+D  │
│  ─────────────────────────────  │
│  Copy                    Cmd+C  │
│  Paste                   Cmd+V  │
│  ─────────────────────────────  │
│  Enable / Disable               │  ← toggle clip.enabled (new field)
│  ─────────────────────────────  │
│  Speed >                        │  ← submenu: 0.25× 0.5× 1× 1.5× 2× 4×
│  ─────────────────────────────  │
│  Ripple Delete                  │  ← delete + close gap
│  Delete                  Del    │  ← delete, leave gap
└─────────────────────────────────┘
```

### 2.2 On a Placeholder Clip

```
┌─────────────────────────────────┐
│  Replace with asset…            │  ← opens asset picker
│  Delete placeholder             │
└─────────────────────────────────┘
```

### 2.3 On the Timeline Track Area (empty space)

```
┌─────────────────────────────────┐
│  Paste                   Cmd+V  │  ← paste at click position
│  ─────────────────────────────  │
│  Add Marker here         M      │
└─────────────────────────────────┘
```

### 2.4 On a Transition Diamond

```
┌─────────────────────────────────┐
│  Remove Transition              │
└─────────────────────────────────┘
```

### 2.5 On a Track Header

```
┌─────────────────────────────────┐
│  Mute Track                     │
│  Lock Track                     │
│  ─────────────────────────────  │
│  Select All Clips in Track      │
│  Delete All Clips in Track      │
└─────────────────────────────────┘
```

### 2.6 Implementation Approach

Use a shared `<ContextMenu>` Radix UI component (already in the project's shadcn/ui set). Pattern:
- Add `onContextMenu` handler to `TimelineClip`, track `<div>`, `TrackHeader`, `TransitionDiamond`
- Pass a `onContextMenu` callback up through the component tree (similar to how `onSelect`/`onMove` are passed)
- `EditorLayout` controls a single `contextMenuState: { type, clipId, trackId, positionMs, x, y } | null`
- Render one `<ContextMenu>` portal at the bottom of `EditorLayout`
- Actions dispatch to the same store actions already defined (split, duplicate, remove, etc.)
- New actions needed: `ENABLE_CLIP`, `RIPPLE_DELETE_CLIP`, `PASTE_CLIP`

---

## 3. Industry Standard Comparison

Reference editors: **DaVinci Resolve 19**, **Adobe Premiere Pro 2024**, **Final Cut Pro 10.8**

### 3.1 Timeline Mechanics

| Feature | DaVinci / Premiere / FCP | ContentAI Editor | Gap |
|---|---|---|---|
| Magnetic timeline (auto-close gaps) | ✅ (FCP default, toggle in others) | ❌ | High |
| Clip overlap prevention | ✅ | ✅ Fixed | — |
| Multi-select (Shift/Cmd+click) | ✅ | ❌ | High |
| Lasso / rubber-band select | ✅ | ❌ | Medium |
| Ripple delete | ✅ | ❌ | High |
| Rolling edit (trim both sides simultaneously) | ✅ | ❌ | Medium |
| Slip edit (move trim in/out without moving clip) | ✅ | ❌ | Low |
| Slide edit (move clip, auto-adjust neighbors) | ✅ | ❌ | Low |
| Snap to grid | ✅ | Partial (snap to clips + playhead) | Low |
| Timeline markers | ✅ | ❌ | Medium |
| Auto-scroll to playhead | ✅ | ❌ | Medium |
| Adjustable track height | ✅ | ❌ | Low |
| Nested sequences / compound clips | ✅ | ❌ | Low (future) |

### 3.2 Playback

| Feature | Industry | ContentAI | Gap |
|---|---|---|---|
| JKL scrubbing | ✅ | ❌ | Medium |
| Variable-speed playback display | ✅ | Partial (speed stored, playhead doesn't account for it) | High |
| Proxy playback | ✅ | ❌ | Low (future) |
| Loop region | ✅ | ❌ | Low |
| Audio playback during scrub | ✅ | ❌ | Medium |

### 3.3 Clip Operations

| Feature | Industry | ContentAI | Gap |
|---|---|---|---|
| Copy / Paste clips | ✅ | ❌ | High |
| Paste attributes (paste only specific properties) | ✅ | ❌ | Low |
| Enable / Disable clip | ✅ | ❌ | Medium |
| Link / Unlink video+audio | ✅ | N/A (tracks are separate by design) | — |
| Group clips | ✅ | ❌ | Low |
| Right-click context menu | ✅ | ❌ | Critical |
| Timecode input (click to type time) | ✅ | ❌ | Medium |

### 3.4 Effects & Color

| Feature | Industry | ContentAI | Gap |
|---|---|---|---|
| Per-clip color correction | ✅ | Partial (contrast + warmth approximation) | High |
| LUT import / apply | ✅ | ❌ | Low (future) |
| Keyframe animation | ✅ | ❌ | Low (future) |
| Effect preview on hover | ✅ | ❌ | Medium |
| Dissolve / Wipe transitions | ✅ | Defined but not implemented | High |
| Transition preview in timeline | ✅ | Note says "export only" | High |

### 3.5 Audio

| Feature | Industry | ContentAI | Gap |
|---|---|---|---|
| Per-track mute affecting playback | ✅ | 🔴 Broken (track muted doesn't affect audio elements) | High |
| Audio mixing (multiple tracks) | ✅ | Partial (volume per clip, now plays in preview) | Medium |
| Audio scrubbing | ✅ | ❌ | Low |
| Waveform per clip | ✅ | ✅ (WaveSurfer) | — |
| Audio gain automation / keyframes | ✅ | ❌ | Low (future) |

### 3.6 Export

| Feature | Industry | ContentAI | Gap |
|---|---|---|---|
| Resolution presets | ✅ | ✅ (720p/1080p portrait + 1080p landscape) | — |
| Custom framerate | ✅ | ✅ (24/30/60) | — |
| Codec selection | ✅ | ❌ (server-side, not exposed) | Low |
| Watermark option | ✅ | ❌ | Low |
| Export queue | ✅ | Single export at a time | Medium |

---

## 4. Gap Analysis & Fix Roadmap

Ordered by impact × effort ratio. Immediate = this sprint. Near-term = next 1-2 sprints. Future = backlog.

### 4.1 Immediate — Critical UX

#### [A] Right-click context menus
_Highest leverage, touches every workflow._

**Files to create/modify:**
- New: `components/ClipContextMenu.tsx` — Radix `ContextMenu` with clip actions
- New: `components/TrackContextMenu.tsx` — Radix `ContextMenu` with track actions
- Modify: `TimelineClip.tsx` — add `onContextMenu` prop
- Modify: `Timeline.tsx` — add `onContextMenu` on track area div, wire up track header menu
- Modify: `EditorLayout.tsx` — manage context menu state, pass callbacks down
- New reducer action: `RIPPLE_DELETE_CLIP` — delete clip + shift subsequent clips left
- New reducer action: `PASTE_CLIP` — insert clipboard clip at specified position

**New state needed:**
```ts
clipboardClip: Clip | null  // in EditorState
```

#### [B] Track mute affecting audio playback
_Trivially broken — track.muted never propagates to audio elements._

**Fix:** In `PreviewArea.tsx`, when syncing audio elements, check `track.muted` in addition to `clip.muted`:
```ts
el.muted = clip.muted || track.muted;
```
Pass `audioTrack` and `musicTrack` to the audio sync loop so `track.muted` is accessible.

#### [C] Remove Transition button in Inspector
_`_onRemoveTransition` is wired up but never called. No button exists._

**Fix:** In `Inspector.tsx`, render a "Remove" button in the transition section that calls `onRemoveTransition(transTrack.id, selectedTransition.id)`. Rename the prop from `_onRemoveTransition` back to `onRemoveTransition`.

#### [D] Text clips invisible in preview
_Text presets added from the Media Panel render nothing in preview._

**Two options:**
1. **Canvas path:** Give text clips a synthetic `captionWords` array derived from `textContent` with full-clip timing, so the existing caption renderer picks them up.
2. **DOM path:** Render text track clips as absolutely positioned `<div>` overlays in `PreviewArea`, styled from `clip.textStyle`.

Option 2 is simpler and allows CSS transforms to apply to text — consistent with the Transform section in Inspector.

### 4.2 Near-term — High-Value UX

#### [E] Ripple Delete
Standard in every NLE. Delete clip and shift all subsequent clips on the same track left by the deleted clip's duration.

```ts
case "RIPPLE_DELETE_CLIP": {
  // Find clip, remove it, shift all clips with startMs > clip.startMs left by clip.durationMs
}
```

Add to: keyboard shortcut `Shift+Delete`, context menu.

#### [F] Copy / Paste clips (Cmd+C / Cmd+V)
Add `clipboardClip: Clip | null` to `EditorState`. `COPY_CLIP` stores it. `PASTE_CLIP` inserts it at `currentTimeMs` (or at right-click position) with a new UUID.

#### [G] Library items draggable to timeline
`MediaPanel.tsx` library item buttons lack `draggable` and `onDragStart`. Three-line fix — same pattern as generated assets.

#### [H] Speed control: playhead advancement
`usePlayback.ts` advances at wall-clock time regardless of active clip speed. To fix properly: when ticking, find the active video clip at `currentTimeMs`, read its `speed`, and apply it to `elapsed` before advancing. This is complex with overlapping clips (use the first active clip's speed, or the highest-priority track's active clip).

#### [I] Dissolve + Wipe-Right transitions
`getTransitionStyle` returns `{}` for dissolve and wipe-right. These need CSS implementation:
- **Dissolve:** identical to fade but applies to _incoming_ clip (fade in), not outgoing. Requires rendering both the outgoing clip (fading out) and the incoming clip (fading in) simultaneously.
- **Wipe-Right:** `clipPath: inset(0 ${(1-progress)*100}% 0 0)` on the incoming clip.

#### [J] Auto-scroll timeline to follow playhead
During playback, if the playhead moves past the right edge of the visible scroll area, auto-scroll. In `EditorLayout.tsx` or `Timeline.tsx`, watch `currentTimeMs` and compare to `scrollRef.current.scrollLeft + scrollRef.current.clientWidth`. If playhead is out of view, set `scrollLeft`.

#### [K] Escape key deselects
One-line keyboard shortcut addition. `if (e.code === "Escape") { store.selectClip(null); setSelectedTransitionKey(null); }`

#### [L] Caption position Y control in Inspector
`captionPositionY` is in the data model and read by `use-caption-preview.ts`. Add a `SliderRow` in Inspector's caption clip section for `captionPositionY` (range 0–100, step 1).

### 4.3 Near-term — Correctness

#### [M] Warmth filter: accurate implementation
CSS `sepia()+saturate()` is a bad approximation of color temperature. Options:
1. **SVG feColorMatrix** — `<feColorMatrix>` with a warm/cool color matrix applied via CSS filter reference. Accurate but complex.
2. **Canvas processing** — render the video to a canvas, apply per-pixel LUT. Accurate but expensive.
3. **CSS hue-rotate + saturate** — `hue-rotate(${warmth > 0 ? 20 : -20}deg) saturate(${1 + Math.abs(warmth)/200})` — better approximation, still not photographic.

Recommend option 3 as a cheap improvement, with a comment noting it's an approximation.

#### [N] Transition preview in timeline (not just export)
The current note "Transitions preview in export only" is technically inaccurate — fade, slide-left, slide-up do preview live. The note should be removed for those types. For dissolve/wipe-right (once implemented), the note remains valid.

### 4.4 Future — Completeness

#### [O] JKL scrubbing
J = reverse play, K = pause, L = forward play. Each L press doubles speed (1×, 2×, 4×). Industry standard for power users.

#### [P] Timeline markers
Named markers stored on `EditProject`. Snap targets include marker positions. Keyboard shortcut M to add. Visible as colored notches on the ruler.

#### [Q] Multi-select clips
Hold Shift or Cmd to add clips to a selection set. All move/delete operations apply to all selected clips. Requires changing `selectedClipId: string | null` to `selectedClipIds: string[]` — a significant state refactor.

#### [R] Keyframe animation for Look/Transform
Per-property keyframes stored as `{ timeMs: number, value: number }[]` on the clip. The Inspector gets a timeline mini-view per property. `PreviewArea` interpolates between keyframe values at `currentTimeMs`.

#### [S] Timecode input field
Make the timecode display clickable / editable. On click, turn it into an `<input>` with `HH:MM:SS:FF` format mask. On Enter, parse and seek.

---

## 5. Reference Implementations

These are open-source codebases with notable patterns to learn from. None are drop-in solutions (covered in `editor-timeline-analysis.md`) but they contain useful reference implementations for specific problems.

### 5.1 Ripple Delete Pattern
**Remotion source:** `packages/player/src/timeline`
- Stores clips as sorted arrays, mutation helpers that shift subsequent clips.
- Reference for the `RIPPLE_DELETE_CLIP` reducer action.

### 5.2 Right-Click Context Menus in React
**Radix UI ContextMenu** (already a project dep via shadcn/ui):
```tsx
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "@/shared/components/ui/context-menu";
```
The component already exists in the shadcn install. No new dependencies required.

### 5.3 Clipboard / Copy-Paste for Clips
Pattern from **OpenCut** (open-source Next.js video editor, 2024):
- Clipboard stored in Zustand global (or in our case, `EditorState.clipboardClip`)
- `COPY_CLIP` — deep-clones clip, strips `id` (new UUID on paste), stores in state
- `PASTE_CLIP` — inserts at `currentTimeMs`, clamped to free space

GitHub: `openvideodev/openvideo` — look at `store/timeline-store.ts` for clipboard pattern.

### 5.4 JKL Scrubbing
From **Kdenlive** codebase pattern (adapted for React):
```ts
// In keyboard handler:
if (e.key === 'j') setPlaybackRate(isPlaying ? -rate : -1);
if (e.key === 'k') { setPlaying(false); setPlaybackRate(1); }
if (e.key === 'l') setPlaybackRate(isPlaying ? rate * 2 : 1);
```
Requires adding `playbackRate` to `EditorState` and factoring it into the rAF tick.

### 5.5 Auto-Scroll Timeline to Playhead
From **react-timeline-editor** source:
```ts
// In the tick callback, after updating currentTimeMs:
const playheadPx = (newTimeMs / 1000) * zoom;
const { scrollLeft, clientWidth } = scrollRef.current;
if (playheadPx > scrollLeft + clientWidth - 80) {
  scrollRef.current.scrollLeft = playheadPx - 80;
}
```
Wire this into `EditorLayout.tsx`'s `onTick` callback, passing `scrollRef` from the `Timeline` component.

### 5.6 Dissolve / Wipe-Right Transitions
From **Remotion** `@remotion/transitions` source:
- **Dissolve** = two clips overlap; outgoing clips out 0→1, incoming fades in 1→0. Requires rendering both simultaneously with `opacity` on each.
- **Wipe-right** = `clipPath: inset(0 ${(1-progress)*100}% 0 0)` on the incoming clip, rendered on top of the outgoing clip.

In `PreviewArea.tsx` this means rendering clips that are "entering" a transition window even before their `startMs` (they start rendering when the transition window begins for their predecessor).

### 5.7 Text Clip DOM Rendering Pattern
From **Twick** `@twick/studio` source (adapted):
```tsx
// In PreviewArea, alongside video elements:
{textTrack?.clips.map((clip) => {
  const isActive = currentTimeMs >= clip.startMs && currentTimeMs < clip.startMs + clip.durationMs;
  if (!isActive || !clip.textContent) return null;
  return (
    <div
      key={clip.id}
      className="absolute pointer-events-none"
      style={{
        color: clip.textStyle?.color ?? "#fff",
        fontSize: clip.textStyle?.fontSize ?? 32,
        fontWeight: clip.textStyle?.fontWeight ?? "normal",
        textAlign: clip.textStyle?.align ?? "center",
        transform: `scale(${clip.scale ?? 1}) translate(${clip.positionX ?? 0}px, ${clip.positionY ?? 0}px)`,
        opacity: clip.opacity ?? 1,
        // ... etc
      }}
    >
      {clip.textContent}
    </div>
  );
})}
```

---

## Appendix: Files by Fix Area

Quick reference for where to make each change.

| Fix | Primary Files |
|---|---|
| Right-click context menus | `TimelineClip.tsx`, `Timeline.tsx`, `TrackHeader.tsx`, `TransitionDiamond.tsx`, `EditorLayout.tsx`, new `ClipContextMenu.tsx` |
| Track mute → audio playback | `PreviewArea.tsx` |
| Remove transition button | `Inspector.tsx` |
| Text clips in preview | `PreviewArea.tsx` |
| Ripple delete | `useEditorStore.ts`, `EditorLayout.tsx` (keyboard), `ClipContextMenu.tsx` |
| Copy / paste | `useEditorStore.ts`, `EditorLayout.tsx` (keyboard), `ClipContextMenu.tsx` |
| Library items draggable | `MediaPanel.tsx` |
| Speed: playhead sync | `usePlayback.ts`, `EditorLayout.tsx` |
| Dissolve / Wipe transitions | `PreviewArea.tsx` |
| Auto-scroll playhead | `Timeline.tsx`, `EditorLayout.tsx` |
| Escape deselects | `EditorLayout.tsx` |
| Caption position Y UI | `Inspector.tsx` |
| Warmth filter accuracy | `PreviewArea.tsx` |
| JKL scrubbing | `useEditorStore.ts`, `EditorLayout.tsx`, `usePlayback.ts` |
| Timeline markers | `useEditorStore.ts`, `Timeline.tsx`, `TimelineRuler.tsx`, types |
| Multi-select | `useEditorStore.ts` (state refactor), `TimelineClip.tsx`, `Timeline.tsx`, `EditorLayout.tsx` |
| Timecode input | `EditorLayout.tsx` |
