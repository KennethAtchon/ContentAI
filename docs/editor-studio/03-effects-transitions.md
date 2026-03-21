# 03 -- Effects and Transitions

**Priority:** Phase 5 (last)
**Effort:** Medium (2-3 weeks)
**Dependencies:** Editor Core (Phase 2) and Assembly System (Phase 4)

---

## User Problem

The editor only supports hard cuts between clips. Every clip transition is an instant jump. For short-form content, hard cuts are actually fine most of the time -- TikTok and Reels culture favors fast cuts. But creators expect at least a few transition options (fade, slide) and basic effects (color filters, speed ramps) because every competing tool offers them.

This is Phase 5 because it adds polish, not capability. A creator can make and post a reel without transitions. They cannot make and post a reel without captions or without the ability to load their generated content into the editor.

---

## User Stories

- As a creator, I want to add fade-in and fade-out transitions between clips so that my reel flows smoothly instead of hard-cutting.
- As a creator, I want to apply color filter presets (warm, cool, B&W, vintage) to clips so that my reel has a consistent visual style.
- As a creator, I want to apply a speed ramp (smooth speed change) to a clip so that I can create dramatic slow-motion or fast-forward effects.
- As a creator, I want to see transitions rendered in the preview so that I can judge how they look before exporting.

---

## In Scope (MVP)

### 1. Transitions Between Clips

**Supported transition types (MVP):**

| Type | Description | ffmpeg filter |
|------|-------------|---------------|
| `fade` | Opacity crossfade between clip A end and clip B start | `xfade=transition=fade` |
| `slide-left` | Clip B slides in from the right, pushing clip A left | `xfade=transition=slideleft` |
| `slide-up` | Clip B slides in from the bottom | `xfade=transition=slideup` |
| `dissolve` | Pixel-level dissolve | `xfade=transition=dissolve` |
| `wipe-right` | Vertical wipe line moves left to right | `xfade=transition=wiperight` |

**Duration:** Configurable, 200ms to 2000ms, default 500ms.

**Data model:**

Transitions are properties of the gap between two adjacent clips on the same track, not properties of the clips themselves. Add to the `Track` type:

```typescript
interface Transition {
  id: string;
  type: "fade" | "slide-left" | "slide-up" | "dissolve" | "wipe-right" | "none";
  durationMs: number;
  // The transition occurs between clipAId (ending) and clipBId (starting)
  clipAId: string;
  clipBId: string;
}

interface Track {
  // existing fields...
  transitions: Transition[];
}
```

**Why transitions live on the track, not the clip:** A transition is a relationship between two clips. If you delete clip B, the transition should disappear. If you reorder clips, transitions need to be recalculated. Storing them on the track as a separate array (keyed by clip pair) is cleaner than attaching them to individual clips.

**Timeline UI:**

- Transitions render as a small diamond-shaped icon between adjacent clips on the timeline
- Click the diamond to select the transition and show options in the Inspector
- Right-click the gap between two clips shows "Add transition" context menu
- Drag the diamond edges to adjust transition duration
- The overlapping region of the two clips is shown with a cross-hatch pattern

**Preview rendering:**

For preview, transitions are hard. True cross-fading between two `<video>` elements requires compositing them both simultaneously with animated opacity or clip-path. This is doable with CSS but not perfectly synced.

**MVP approach:** In the preview, approximate transitions with CSS animations:
- Fade: animate `opacity` from 1 to 0 on clip A and 0 to 1 on clip B simultaneously
- Slide: use CSS `transform: translateX()` animation on clip B over clip A
- For preview, both clips' `<video>` elements are visible during the transition window

**Export rendering:**

ffmpeg `xfade` filter handles this natively. The filtergraph changes from simple `concat` to:

```
[v0][v1]xfade=transition=fade:duration=0.5:offset=4.5[vx01];
[vx01][v2]xfade=transition=slideleft:duration=0.5:offset=9.5[vx12];
```

Where `offset` is the time (in the output timeline) where the transition begins. This is calculated from the clip positions and transition duration.

### 2. Color Filter Presets

**What exists today:** The Inspector has Opacity, Warmth, and Contrast sliders. The Effects tab in the Media Panel lists preset names but the `applyEffect` function is a no-op.

**What to build:**

Wire the existing Effects tab presets to actually modify the selected clip's properties:

```typescript
const applyEffect = (effect: typeof EFFECTS[0]) => {
  if (!selectedClipId) return;
  onUpdateClip(selectedClipId, {
    contrast: effect.contrast ?? 0,
    warmth: effect.warmth ?? 0,
    opacity: effect.opacity ?? 1,
  });
};
```

This is mostly already designed -- the code has the presets defined, the Inspector has the sliders, and the reducer handles `UPDATE_CLIP`. The only missing piece is passing the `selectedClipId` and `onUpdateClip` into the MediaPanel component so the effects tab can call them.

**Additional filters (post-MVP):**
- Saturation
- Brightness
- Blur (background blur for vertical video with horizontal source)
- Grain/noise overlay

For preview: CSS `filter` property already handles `contrast()` and `opacity`. Add `saturate()` and `brightness()` to the video element's inline style.

For export: ffmpeg `eq` filter handles brightness/contrast/saturation. Map the preset values to ffmpeg filter parameters.

### 3. Speed Ramps

**What exists today:** Each clip has a `speed` property (0.25x to 4x). The Inspector has a speed control. The ffmpeg export applies `setpts` for constant speed changes.

**What to add:** Speed ramps -- smooth transitions between two speed values over a time range within a clip.

**Data model extension:**

```typescript
interface SpeedRamp {
  startMs: number;   // Relative to clip start
  endMs: number;     // Relative to clip start
  startSpeed: number;
  endSpeed: number;
  curve: "linear" | "ease-in" | "ease-out" | "ease-in-out";
}

interface Clip {
  // existing fields...
  speedRamps?: SpeedRamp[];
}
```

**Preview:** During the rAF playback loop, check if the current time falls within a speed ramp. If so, adjust the `playbackRate` of the video element dynamically:

```typescript
function getEffectiveSpeed(clip: Clip, relativeTimeMs: number): number {
  if (!clip.speedRamps?.length) return clip.speed;
  for (const ramp of clip.speedRamps) {
    if (relativeTimeMs >= ramp.startMs && relativeTimeMs <= ramp.endMs) {
      const progress = (relativeTimeMs - ramp.startMs) / (ramp.endMs - ramp.startMs);
      const easedProgress = applyEasing(progress, ramp.curve);
      return ramp.startSpeed + (ramp.endSpeed - ramp.startSpeed) * easedProgress;
    }
  }
  return clip.speed;
}
```

**Export:** ffmpeg speed ramps are complex. The `setpts` filter applies a constant speed change. For variable speed, you need to pre-calculate the PTS (presentation timestamp) mapping and apply a custom PTS expression. This is doable but non-trivial:

```
setpts='if(between(T,2,4), PTS*lerp(1.0,0.5,(T-2)/2), PTS*1.0)'
```

**Recommendation:** Defer speed ramps to post-MVP. Constant speed changes (already implemented) cover 90% of use cases. Speed ramps add significant complexity to both preview and export for a feature most reel creators do not use.

---

## Out of Scope (Defer)

- **Custom transition effects** (user-created transitions) -- too complex, too niche
- **3D transitions** (cube rotate, sphere) -- gimmicky, not worth the engineering cost
- **LUT (Look-Up Table) support** -- professional color grading. Not the target audience for MVP.
- **Green screen / chroma key** -- requires background removal pipeline. Major effort for a niche feature.
- **Motion tracking** (text follows object in video) -- requires computer vision. Way out of scope.
- **Speed ramps** -- as discussed above, defer to post-MVP
- **Audio effects** (reverb, echo, pitch shift) -- ffmpeg can do these but the UI complexity is not worth it for reel content

---

## Technical Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| ffmpeg `xfade` filter requires matching resolution/framerate between clips | High | Pre-normalize all clips to the same resolution and framerate before applying xfade. Already partially done (the `scale` and `pad` filters in the export pipeline). |
| Transition preview desync between CSS approximation and ffmpeg result | Medium | Accept that preview is approximate. Add a disclaimer "Preview is approximate -- export for final result." This is what CapCut Web does too. |
| `xfade` offset calculation with variable-length clips and multiple transitions | Medium | Build a utility function that walks the clip array and calculates cumulative offsets accounting for transition overlap durations. Unit test extensively. |
| Speed ramps in ffmpeg require complex PTS expressions | High | Defer speed ramps entirely. Constant speed is sufficient for MVP. |

---

## Competitive Reference

| Feature | CapCut Web | Descript | ContentAI Target |
|---------|-----------|---------|-------------------|
| Transition effects | 40+ types | None (cut only) | 5 types |
| Color filters | 20+ presets + manual | Limited | 5 presets + manual sliders |
| Speed ramps | Yes (curve editor) | No | Deferred |
| Video filters (blur, grain) | Yes | No | Deferred |
| LUT support | Yes | No | Deferred |

The target is not to match CapCut's breadth. It is to have enough that creators do not feel the tool is missing something obvious. Five transitions and five color presets clear that bar.

---

## Implementation Sequence

1. Wire existing Effects tab to actually apply presets to selected clip -- 0.5 day
2. Transition data model (add `transitions` array to Track type, reducer actions) -- 1 day
3. Transition UI on timeline (diamond icons, click to select, Inspector section) -- 2 days
4. Transition preview (CSS-based approximate rendering) -- 2 days
5. Transition export (ffmpeg `xfade` filtergraph generation) -- 3 days
6. Additional color filter sliders (saturation, brightness) + CSS preview + ffmpeg mapping -- 2 days
7. Testing (transition timing, export quality, edge cases with single clip) -- 2 days

**Total estimated effort:** ~12-13 working days
