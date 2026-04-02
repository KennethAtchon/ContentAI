# Research: Industry Patterns for Caption Engines

This document records external research used to inform the new caption engine design. Decisions in the HLD and LLD reference these findings.

---

## 1. Remotion Caption System (`@remotion/captions`)

Remotion is a React-based video rendering framework with the most well-designed open caption system in the browser ecosystem.

### Data Model

```typescript
// From Remotion v4.0.216+ @remotion/captions
interface Caption {
  text: string;
  startMs: number;
  endMs: number;
  timestampMs: number;  // precise word-level anchor
  confidence?: number;
}
```

### Page/Group Concept

`createTikTokStyleCaptions(captions, { combineTokensWithinMilliseconds })` groups individual word tokens into display "pages". A page is a cohesive unit of words that appear together on screen.

```typescript
// Remotion output
interface CaptionPage {
  text: string;
  startMs: number;
  durationMs: number;
  tokens: Array<{
    text: string;
    fromMs: number;
    toMs: number;
  }>;
}
```

### Animation Approach

Remotion uses `spring()` for per-word animation:

```typescript
// React component, per-word scale spring
const scale = spring({
  frame: frame - wordStartFrame,
  fps,
  config: { stiffness: 300, damping: 20, mass: 0.5 },
});
// Applied as CSS transform: scale(scale)
```

**Key insight from Remotion:** The `combineTokensWithinMilliseconds` parameter is the grouping mechanism. High values (1200ms+) = multi-word groups. Low values (200–400ms) = word-by-word animation. This is more flexible than a hard `groupSize: 3` integer.

### What We Take From Remotion

- The `CaptionPage` abstraction (pre-computed groups with word-level timing)
- `groupingMs` as the grouping control instead of `groupSize`
- Spring easing for per-word activation animation
- Separate `tokens[]` within each page for word-level animation

### What We Do Differently

- Remotion renders with React+CSS (its renderer is React-based). We render with Canvas2D for synchronous per-frame control inside the editor timeline.
- Remotion has no concept of multi-line word wrap within a page — it produces single-line groups. We implement proper word wrap.
- Remotion has no preset system. We have a composable preset system with layered styles.

---

## 2. CapCut Caption Architecture (Observed Behavior)

CapCut is the reference product for viral-video caption UX. Its caption system (observed from the product, not source code) implements:

### Preset Library

CapCut has ~50+ caption presets organized by: Glow, Trending, Aesthetic, Highlight, Monoline, Multiline, Word, Frame. Each preset is a complete visual configuration.

Key observations:
- Every preset has **entry animation** (the caption slides, fades, or pops in)
- **Active word** has a distinct visual state (color, scale, or background change)
- Background boxes are per-word (highlighted box moves with the active word) in some presets
- Font weight and family vary per preset
- Some presets have **glow** effects (soft outer bloom on text)

### Word-Level State Machine

CapCut maintains three word states:
1. **upcoming** — words in the current page not yet reached
2. **active** — the word currently being spoken
3. **past** — words in the current page that have been spoken

These three states allow the "karaoke" effect (dim → bright → dim) AND the "hormozi" effect (white → yellow → white) to be unified in one model.

### What We Take From CapCut

- Three-state word model: `upcoming | active | past`
- Per-word background box (movable highlight) as a layer option
- Entry animation as a first-class preset property
- Glow as a style layer type

---

## 3. After Effects / Kinetic Typography Patterns

After Effects' text animation system uses "animators" — composable modifiers applied to ranges of characters. The key pattern: **animations are independent of style**, and multiple animations can stack.

### The Animator Pattern

```
Text Layer
  └── Animator 1: Range { from: 0%, to: 100% }, Properties: { opacity: 0 → 1 }
  └── Animator 2: Range { based on: "words" }, Properties: { scale: 80% → 100% }
  └── Animator 3: Range { based on: "chars" }, Properties: { offset: (0, 20) → (0, 0) }
```

### What We Take From After Effects

- Animations are separate from style (they modify properties rather than being embedded in the style definition)
- Range-based animation (apply to "all chars in active word", "all words in page", etc.)
- Stagger as a first-class animation parameter

### What We Don't Take

- After Effects' animator model is too complex for our use case. We don't need arbitrary range selectors. We need three scopes: page-level (entry/exit), word-level (activation), optional char-level (for future).

---

## 4. OffscreenCanvas + Worker Architecture

Research finding: OffscreenCanvas allows Canvas2D rendering in a Web Worker, moving caption rendering work off the main thread. That makes it a good future path for keeping scrubbing and editor interactions responsive.

```javascript
// Main thread
const offscreen = canvas.transferControlToOffscreen();
worker.postMessage({ canvas: offscreen }, [offscreen]);

// Worker
self.onmessage = ({ data: { canvas } }) => {
  const ctx = canvas.getContext('2d');
  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // draw captions
    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);
};
```

**Browser support (2026):** OffscreenCanvas is Baseline 2023 and broadly supported in modern Chrome, Firefox, and Safari releases. It is a reasonable target for a future optimization pass.

### Implication for Our Architecture

The current caption renderer blocks the main thread. For the scrubber (fast seek + many redraws), this matters. The new renderer is designed as a pure function `render(ctx, page, timeMs, preset, canvasSize)` — it can be moved to an OffscreenCanvas worker in a future pass without changing the render logic.

---

## 5. ASS Subtitle Format — Capabilities and Limits

ASS (Advanced SubStation Alpha) is the richest subtitle format supported by FFmpeg's `ass` filter. Key capabilities:

### What ASS Can Do

- Per-word color changes via `{\c&HCOLOR&}` inline override tags
- Karaoke timing via `{\k<centiseconds>}` and `{\kf<centiseconds>}` (fill wipe)
- Bold, italic, underline, strikeout
- Font family and size per dialogue line
- Precise vertical positioning via `MarginV`
- Opaque background box via `BorderStyle: 3`
- Shadow and outline

### What ASS Cannot Do

- **Rounded corners** — `BorderStyle: 3` produces a hard rectangle. No `border-radius` equivalent.
- **Per-word scale animation** — There is no ASS tag for scaling individual words.
- **Spring/bounce animations** — No ASS equivalent. The closest is `\t()` (transform over time) but it only supports color/alpha transitions.
- **Glow effect** — No CSS `filter: blur()` equivalent. Shadow is the closest approximation.
- **Per-word background boxes that move** — A single `BorderStyle: 3` covers the whole line.
- **Entry/exit slide animations** — `\move()` exists but is coarse (line-level, not word-level).

### Export Parity Strategy

The new architecture acknowledges this gap. Presets define an `exportMode` that controls how ASS is generated when the Canvas effect cannot be reproduced:

- `"approximate"` — Generate the closest ASS approximation (e.g., use `\kf` for highlight, hard box for rounded box)
- `"static"` — Export as static subtitle (no animation) — only for presets with entry animations that ASS cannot represent

No caption effect will be silently dropped. The export will always produce valid ASS. Complex per-word scale animations will fall back to the `approximate` mode.

---

## 6. Font Loading in Canvas

Research finding: `ctx.font = "900 56px Inter"` is a race condition. The canvas will silently use the browser's fallback font if `Inter` is not yet loaded.

The correct pattern:

```typescript
// Load font before first paint
const font = new FontFace('Inter', 'url(https://fonts.gstatic.com/...')');
await font.load();
document.fonts.add(font);
// Now canvas can use Inter
```

For the editor preview, fonts must be loaded before the canvas renders. The `FontLoader` utility handles this. Font load state is exposed via a `fontReady` boolean that the canvas renderer checks before painting.

---

## 7. Text Measurement and Multi-Line Word Wrap

Canvas2D does not have native word wrap. The standard approach:

```typescript
function wrapWords(
  ctx: CanvasRenderingContext2D,
  words: string[],
  maxWidth: number,
): string[][] {
  const lines: string[][] = [];
  let current: string[] = [];

  for (const word of words) {
    const candidate = [...current, word].join(' ');
    if (ctx.measureText(candidate).width > maxWidth && current.length > 0) {
      lines.push(current);
      current = [word];
    } else {
      current.push(word);
    }
  }
  if (current.length > 0) lines.push(current);
  return lines;
}
```

**Key insight:** Word wrap must happen at layout time, not render time. The result is a `CaptionLayout` — a pre-computed structure that maps each word to its `(line, x, y)` position. The renderer uses this layout without recomputing it every frame.

---

## 8. Spring Easing Implementation

A spring function produces realistic bounce/elastic animations without explicit keyframes. A damped harmonic oscillator is the usual mental model. The simplified example below is illustrative rather than production-ready:

```typescript
// Simplified spring (critically/overdamped) — no overshoot variant
function spring(t: number, stiffness: number, damping: number): number {
  // Critically damped spring
  const omega = Math.sqrt(stiffness);
  return 1 - Math.exp(-damping * omega * t) * (Math.cos(omega * t) + (damping / Math.sqrt(1 - damping * damping)) * Math.sin(omega * t));
}
```

For the new preset system, spring parameters are exposed as:
- `stiffness` (100–500) — how fast it snaps
- `damping` (0.5–1.0) — how much it oscillates (< 1 = bounce, = 1 = no bounce)
- `mass` (0.5–2.0) — inertia

---

## 9. OpusClip / Short-Form Video Caption UX Patterns

OpusClip (a direct competitor) implements:

- **Auto-caption on upload** — Captions are generated in the background immediately after upload, without user action
- **Style picker as the primary caption UI** — The preset selector is the dominant UI, not the "generate" button
- **Highlight word** — A single word at a time is highlighted in bright color (yellow or brand color)
- **Emoji insertion** — Auto-placed emojis at emotionally resonant moments (future feature)

**Implication for our UX:** Auto-caption on insert is a strong pattern in social-first tools like OpusClip. However, whether to trigger automatically on voiceover insertion versus on a deliberate one-step action is a product decision to validate with UX testing, not an industry requirement. The architectural commitment is tight clip linkage and idempotency. The Inspector should present the style picker as the primary UI, with caption generation triggered either automatically on voiceover add or through a one-step explicit action. We will also stop sending the raw AI-generated voiceover script through this flow and instead rely on auto-transcription to derive caption text and create separate clips for each transcribed segment.

---

## 10. Kinetic Typography Engine Research Paper

*"The Kinetic Typography Engine: An Extensible System for Animating Expressive Text"* (Forlizzi et al.) defines a formal model for text animation that maps cleanly to our design:

| Paper Concept | Our System Equivalent |
|--------------|----------------------|
| Effect | `AnimationDef` |
| Scope (char/word/sentence) | `scope: "char" | "word" | "page"` |
| Motion path | `translateX/Y` property in `AnimationDef` |
| Timing function | `EasingFunction` |
| Parallel/sequential composition | Multiple `AnimationDef[]` in a preset |

The paper's key finding: text animations are most expressive when scope (what moves) is decoupled from property (how it moves) and timing (when/how fast). Our `AnimationDef` implements this decoupling.

---

## Summary: Key Decisions Derived from Research

| Decision | Source |
|---------|--------|
| `CaptionPage` with `tokens[]` | Remotion |
| `groupingMs` instead of `groupSize` | Remotion |
| Three word states (`upcoming/active/past`) | CapCut |
| Per-word background box as a layer option | CapCut |
| Entry/exit as first-class preset properties | AE / CapCut |
| Glow as a style layer | CapCut |
| `AnimationDef` with `scope` + `property` | AE / Kinetic Typography Engine |
| Spring easing built-in | Remotion |
| Pre-computed `CaptionLayout` for rendering | Word wrap research |
| `exportMode: "approximate" | "static"` | ASS capabilities analysis |
| `FontLoader` before first paint | Font loading research |
| Pure renderer function (OffscreenCanvas-ready) | OffscreenCanvas research |
