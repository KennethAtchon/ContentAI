# ContentAI Editor Studio — Product Specification

**Author:** Product
**Date:** 2026-03-24
**Status:** Approved for engineering
**Covers:** All queued improvements across the editor, caption system, assembly pipeline, and data layer

---

## Executive Summary

ContentAI's core promise is simple: you describe a reel, the AI builds it, you post it. Right now that promise breaks at the most important handoff — when the AI finishes generating and the user tries to actually use what was created. The editor opens disconnected from the pipeline. Generated clips land in the wrong places. The AI chat button does nothing. Captions don't exist. What should be the most satisfying moment of the product (seeing your reel come together) is instead a frustrating puzzle.

This spec covers a phased set of improvements that fix the broken handoffs, upgrade the editor's core tools to professional quality, and introduce the caption system that every reel creator considers table-stakes. These are not nice-to-haves — they are the difference between a platform people use once and a platform they return to daily.

---


## Section 3 — Editor Core Quality

These are the features that separate a toy editor from a professional tool. Without them, creators hit a ceiling and go back to CapCut.

### 3.1 9:16 Preview (Vertical by Default)

Every reel, TikTok, and YouTube Short is vertical (9:16). The current editor preview is 16:9 (horizontal). Creators are editing in the wrong shape. They cannot judge framing, text position, or caption placement accurately because the preview does not match what they will actually post.

**The fix:** Default all editor previews, projects, and exports to 9:16 vertical. Existing projects get migrated. An aspect ratio toggle (9:16 / 16:9 / 1:1) allows horizontal content creators to change it. But 9:16 is the default, always.

### 3.2 Split Clip

The most basic timeline operation after trim. Press `S` with a clip selected and the playhead inside it — the clip splits at the playhead into two separate clips. Each inherits all the original's properties. Essential for removing a middle section (split, delete the middle segment, rejoin).

### 3.3 Clip Snapping

Dragging clips currently produces gaps and overlaps because there is no magnetic alignment. Clips should snap to: adjacent clip edges on any track, the playhead position, and time zero. Hold Shift to bypass snapping for fine positioning. A vertical snap line appears at the snap point as visual feedback.

### 3.4 Drag-and-Drop from Media Panel

Currently, adding a clip from the media panel requires clicking, which adds the clip at the playhead. Drag-and-drop is the intuitive behavior — drag a clip from the panel, drop it onto a track lane at the desired position. The drop target highlights to confirm the track accepts the asset type.

### 3.5 Clip Duplication

Select a clip, press `Cmd+D`. A copy of the clip appears immediately after the original. Same properties, new ID. Useful for repeating a shot or creating a variant.

---

## Section 4 — Project Model and Data Layer

### 4.2 One Editor Project Per Content Item

Each piece of generated content should have exactly one editor project. Opening the editor from the queue should open *that project* — pre-populated with the AI-generated shots, voiceover, and music in the correct order — not a blank canvas.

If the user makes edits and then goes back to the queue and reassembles (e.g., after generating a new shot), the editor project should update automatically to reflect the new assembly. The user should not have to manually rebuild.

### 4.4 The Queue as a Live Dashboard

The queue currently shows static state — it reflects the world as of when the assets were created and goes dark after assembly. It should show:
- Whether an editor project exists and its status (draft / published)
- Whether an export job is in progress or complete
- A direct "Open in Editor" button that navigates to the pre-populated editor project

The queue should be the place a creator goes to see the full state of everything they're working on, not just the generation pipeline phase.


## Section 6 — Effects and Transitions

### 6.1 Transitions Between Clips

Five transition types: Fade, Slide Left, Slide Up, Dissolve, Wipe Right. Duration 200ms-2000ms. Transitions appear as diamond icons between adjacent clips on the timeline. Click the diamond to configure in the inspector.

The preview shows an approximate CSS-animated version. Export uses ffmpeg's `xfade` filter for accurate rendering.

### 6.2 Color Filter Presets

The existing Effects tab has presets defined but they are no-ops. Wire them to actually apply warmth, contrast, and opacity values to selected clips. This is a small engineering task (the sliders and reducer actions already exist — just need to connect them) but a visible quality upgrade.

---
