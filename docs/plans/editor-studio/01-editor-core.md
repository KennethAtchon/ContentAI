# 01 -- Editor Core: Timeline, Clips, Tracks

**Priority:** Phase 2 (after Project Model)
**Effort:** Large (3-4 weeks)
**Dependencies:** Phase 1 (Project Model) should land first

---

## User Problem

The editor exists but cannot do the basic things a reel creator expects from a timeline editor. You cannot split a clip at the playhead. Clips do not snap to each other when dragging. The preview shows 16:9 when every reel is 9:16. Audio clips have no waveform visualization so you cannot see where the beats or words are. There is no drag-and-drop from the media panel -- you click to add at the playhead position, which is unintuitive. These gaps make the editor feel unfinished and push creators back to CapCut.

---

## User Stories

- As a creator, I want to split a clip at the playhead so that I can trim and rearrange sections of my video without re-importing.
- As a creator, I want clips to snap to adjacent clip edges so that I can avoid gaps or overlaps in my timeline.
- As a creator, I want the preview to show 9:16 (vertical) by default so that my reel looks correct while editing.
- As a creator, I want to see waveforms on audio and voiceover clips so that I know where speech and beats fall.
- As a creator, I want to drag clips from the media panel onto the timeline so that the add flow feels natural.
- As a creator, I want to drag clips between tracks so that I can move a clip from one position to another.
- As a creator, I want to duplicate a clip on the timeline so that I can repeat a segment without going back to the media panel.

---

## In Scope (MVP)

### 1. Aspect Ratio Fix -- 9:16 Default

**What changes:**
- PreviewArea aspect ratio changes from `16/9` to `9/16`
- Resolution options change: `1080x1920` (default), `720x1280`, `2160x3840`
- The `resolution` field on `EditProject` stores `"1080x1920"` format instead of `"1080p"`
- ffmpeg export output dimensions change to vertical
- Inspector shows resolution as `1080 x 1920` in meta row
- Preview container uses `maxWidth` constraint instead of `maxHeight` since vertical is tall and narrow

**Migration:** Add a one-time migration to convert existing projects. `"1080p"` becomes `"1080x1920"`, `"720p"` becomes `"720x1280"`, `"4k"` becomes `"2160x3840"`. The schema enum expands.

**Implementation notes:**
- The preview area currently uses `style={{ aspectRatio: "16/9" }}` in PreviewArea.tsx. Change to `aspectRatio: "9/16"`.
- The ffmpeg export in `backend/src/routes/editor/index.ts` resolves `[outW, outH]` from resolution. This mapping changes to produce vertical dimensions.
- Add an aspect ratio toggle (9:16 / 16:9 / 1:1) in the toolbar for creators who want horizontal or square formats. Default to 9:16. Store on the project.

### 2. Split Clip at Playhead

**Behavior:**
- User selects a clip, presses `S` or clicks the split button in the toolbar
- If the playhead is within the selected clip's time range, the clip is split into two clips at the playhead position
- The first clip retains the original start and trims to the playhead. The second clip starts at the playhead and trims to the original end.
- Both clips inherit all properties (opacity, speed, volume, etc.) from the original
- The split is added to the undo history as a single action

**Implementation:**

Add a new reducer action `SPLIT_CLIP`:

```typescript
| { type: "SPLIT_CLIP"; clipId: string; atMs: number }
```

The reducer logic:
1. Find the clip by ID across all tracks
2. Verify `atMs` is between `clip.startMs` and `clip.startMs + clip.durationMs`
3. Create clip A: same start, `durationMs = atMs - clip.startMs`, same `trimStartMs`, adjusted `trimEndMs`
4. Create clip B: `startMs = atMs`, `durationMs = (clip.startMs + clip.durationMs) - atMs`, adjusted `trimStartMs`, same `trimEndMs`
5. Replace the original clip with both new clips in the track
6. Push to undo history

Add keyboard shortcut `S` in the EditorLayout keydown handler.

### 3. Clip Snapping

**Behavior:**
- When dragging a clip horizontally, its start and end edges snap to:
  - The start/end edges of other clips on the same track
  - The start/end edges of clips on other tracks (cross-track snapping)
  - The playhead position
  - Time 0
- Snap threshold: 10px (converted to ms using current zoom)
- Visual indicator: a vertical snap line appears at the snap point

**Implementation:**
- Happens in `TimelineClip.tsx` during the `onMouseMove` handler
- Before applying the new `startMs`, check all snap targets within threshold
- If a snap target is found, override `startMs` to snap to it
- Render a `<div>` snap line (absolute positioned, 1px wide, full track height, bright color) when snapping is active
- Hold `Shift` during drag to disable snapping

**Snap target collection:**
```typescript
function collectSnapTargets(tracks: Track[], excludeClipId: string): number[] {
  const targets: number[] = [0]; // always snap to 0
  for (const track of tracks) {
    for (const clip of track.clips) {
      if (clip.id === excludeClipId) continue;
      targets.push(clip.startMs);
      targets.push(clip.startMs + clip.durationMs);
    }
  }
  return [...new Set(targets)].sort((a, b) => a - b);
}
```

### 4. Waveform Visualization

**Behavior:**
- Audio, voiceover, and music clips on the timeline display an SVG waveform inside the clip block
- The waveform is computed client-side from the audio file using Web Audio API
- The waveform is cached per asset ID (computed once, stored in a React context or module-level Map)

**Implementation approach:**

```typescript
async function generateWaveform(audioUrl: string, numBars: number): Promise<number[]> {
  const response = await fetch(audioUrl);
  const arrayBuffer = await response.arrayBuffer();
  const audioContext = new AudioContext();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  const channelData = audioBuffer.getChannelData(0);
  const blockSize = Math.floor(channelData.length / numBars);
  const bars: number[] = [];
  for (let i = 0; i < numBars; i++) {
    let sum = 0;
    for (let j = 0; j < blockSize; j++) {
      sum += Math.abs(channelData[i * blockSize + j]);
    }
    bars.push(sum / blockSize);
  }
  // Normalize to 0-1
  const max = Math.max(...bars);
  return bars.map((b) => b / (max || 1));
}
```

- Render as an SVG `<rect>` bar chart inside `TimelineClip`
- Number of bars = clip width in pixels / 3 (one bar every 3px)
- Recalculate when zoom changes (bar count changes)
- Use a `WaveformCache` context to avoid re-decoding the same audio file

**Limitations:**
- Web Audio API `decodeAudioData` can fail for unsupported formats. Gracefully fall back to a flat line.
- Large audio files (10+ minutes) may be slow to decode. Show a loading shimmer until the waveform is ready.
- Cross-origin issues: the audio URL must be accessible. R2 signed URLs already allow this.

### 5. Drag-and-Drop from Media Panel

**Behavior:**
- User drags a media item (video, audio, music) from the media panel and drops it onto a track lane in the timeline
- The clip is created at the drop position (time derived from horizontal pixel position and zoom)
- Drop zones highlight when a draggable item is over them
- Only valid drops are accepted (video assets on video tracks, audio on audio tracks, etc.)

**Implementation:**
- Use HTML5 Drag and Drop API (`draggable`, `onDragStart`, `onDrop`, `onDragOver`)
- In MediaPanel, set `draggable="true"` on each asset card. `onDragStart` sets `dataTransfer` with asset JSON.
- In Timeline, each track lane listens for `onDragOver` (check track type vs asset type) and `onDrop` (create clip at drop position)
- Drop position calculation: `const timeMs = ((e.clientX - trackLaneLeft + scrollLeft) / zoom) * 1000`
- Maintain click-to-add as the fallback for users who do not discover drag-and-drop

### 6. Clip Duplication

**Behavior:**
- Select a clip, press `Cmd+D` (or right-click > Duplicate)
- A copy of the clip is created immediately after the original on the same track
- The duplicate has a new ID but identical properties

**Implementation:**
- New reducer action: `DUPLICATE_CLIP`
- New clipboard: copy clip to an in-memory reference, paste at playhead
- Keyboard shortcut: `Cmd+D`

---

## Out of Scope (Defer)

- **Multi-track video compositing** (picture-in-picture, overlays) -- the current model has one video track. Adding multiple video tracks requires a compositing engine. Defer to post-assembly-system.
- **Keyframe animation** (animate opacity, position over time) -- requires a keyframe curve editor UI. Substantial effort for limited reel use.
- **Audio ducking** (automatically lower music volume when voiceover is active) -- useful but not critical for MVP.
- **Clip grouping** (select multiple clips and move as a group) -- nice-to-have for complex edits, not needed for typical 15-60s reels.
- **Custom playback speed on preview** (0.5x, 2x preview) -- the speed slider in Inspector changes clip speed, not preview speed. Preview speed control is low value.

---

## Technical Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Waveform decoding blocks UI thread for large files | Medium | Use `OffscreenCanvas` + `AudioContext` in a Web Worker. If Web Worker AudioContext is not available (Firefox), decode on main thread but chunk the processing. |
| Drag-and-drop conflicts with timeline clip dragging | Medium | Use different drag data types. Media panel drag uses `application/x-contentai-asset`, timeline clip drag uses internal mouse event handlers (not DnD API). |
| Snap calculation performance with 50+ clips | Low | Snap targets are just a sorted array of numbers. Binary search for nearest target. O(log n) per frame is fine. |
| Aspect ratio change breaks existing projects | Medium | Migration script converts resolution strings. ffmpeg pipeline must handle both old and new format strings during transition. |

---

## Competitive Reference

| Feature | CapCut Web | Descript | ContentAI Target |
|---------|-----------|---------|-------------------|
| Split clip | Yes (S key) | Yes (Cmd+E) | Yes (S key) |
| Snap to grid | Yes (with visual guides) | Yes | Yes |
| Waveform on audio | Yes | Yes (speech + audio) | Yes (audio only) |
| Drag to timeline | Yes | Yes | Yes |
| 9:16 preview | Yes (default for TikTok) | No (horizontal default) | Yes (default) |
| Keyframe animation | Yes | No | Deferred |
| Multi-track video | Yes (unlimited) | No | Deferred |

---

## Implementation Sequence

1. Aspect ratio fix (PreviewArea + ffmpeg export + schema migration) -- 2 days
2. Split clip (reducer action + keyboard shortcut + toolbar button) -- 1 day
3. Clip snapping (drag handler update + snap line rendering) -- 2 days
4. Drag-and-drop from media panel (DnD API + drop zone highlighting) -- 2 days
5. Waveform visualization (Web Audio decode + SVG rendering + cache) -- 3 days
6. Clip duplication (reducer action + keyboard shortcut) -- 0.5 day
7. Testing and edge cases -- 2 days

**Total estimated effort:** ~12-13 working days
