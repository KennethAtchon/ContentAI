You are a senior software architect working on my video editing application.

## Context

We are building a **new Caption Engine** from scratch. The existing caption system is fundamentally broken in design and implementation.

**Hard requirement:**

* Completely DELETE the old caption system
* No backward compatibility
* No migration layer
* No reuse of old abstractions
* Treat this as a greenfield system

---

## Goal

Design and implement a **modern, extensible caption + text preset engine** similar in capability to professional editors.

This system must support:

* Reusable **text presets** (style + animation + effects)
* High-performance rendering
* Clean separation of concerns (data vs rendering vs animation)
* Future extensibility (user-generated presets, marketplace, etc.)

---

## Core Features

### 1. Caption Model (Data Layer)

Design a normalized schema for captions.

Each caption should support:

* text content
* timing (start, end)
* positioning (x, y, anchor, alignment)
* style (font, size, color, stroke, shadow, background)
* animation (entry, exit, idle)

Define a **Preset schema** that includes:

* typography
* visual effects
* animation keyframes
* easing curves

Presets must be:

* serializable (JSON)
* composable (base preset + overrides)
* reusable across captions

---

### 2. Animation System (Critical)

Design a robust animation engine.

Requirements:

* keyframe-based animation system
* support for:

  * scale
  * position
  * rotation
  * opacity
  * letter-level animation (per character)
* easing functions (easeIn, easeOut, cubic-bezier, spring if possible)
* timeline-driven (time-based, not frame-based)

Strongly prefer:

* declarative animation definitions
* deterministic playback

---

### 3. Rendering Layer

Design how captions are rendered.

Account for my stack and choose the best approach:

* If web: Canvas2D vs WebGL
* If React Native: Skia preferred

Must support:

* layered text rendering (fill, stroke, shadow, glow)
* batching for performance
* real-time preview during scrubbing

---

### 4. Preset System (Key Feature)

We are NOT copying external presets.

Instead:

* replicate the *concept* of presets
* define 5–10 built-in presets inspired by modern kinetic typography:

  * pop/bounce
  * slide-in
  * fade + scale
  * glitch
  * subtitle highlight

Each preset should be defined in JSON using your schema.

---

### 5. External Assets (Option 2 Integration)

We will use licensed/open assets:

* fonts (e.g., Google Fonts)
* optional motion inspiration from marketplaces

Design the system so:

* fonts are pluggable
* presets are not tied to proprietary assets

---

### 6. API Design

Design a clean API:

Examples:

* createCaption()
* applyPreset(captionId, presetId)
* updateKeyframes()
* renderFrame(time)

---

### 7. Performance Constraints

* Must handle dozens of captions simultaneously
* Smooth playback at 30–60fps
* Efficient memory usage
* Avoid unnecessary re-renders

---

### 8. Developer Experience

* Strong typing (if applicable)
* Easy to add new presets
* Easy to debug animations
* Clear separation of:

  * data
  * animation logic
  * rendering

---

## Deliverables

1. High-level architecture diagram (textual is fine)
2. Data models (TypeScript or relevant language)
3. Animation system design
4. Rendering approach recommendation (with reasoning)
5. Example preset definitions (JSON)
6. Example usage flow (create caption → apply preset → render)
7. Tradeoffs and decisions explained

---

## Constraints

* No legacy code
* No hacks
* No "temporary" abstractions
* Optimize for long-term scalability over short-term speed

---

## Tone

Be decisive and opinionated. If there are multiple approaches, pick the best one and justify it.

Avoid vague answers. Provide concrete structures and examples.
