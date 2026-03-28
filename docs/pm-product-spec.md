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

### 4.1 The Disconnected Editor Problem

Today the editor and the generation pipeline are two separate systems. You generate a reel in chat → the reel appears in the queue → to edit it in the editor, you open the editor and manually re-add all the clips. There is no automatic link.

This breaks the product's core promise. The point of AI-generated clips is that they flow into a ready-to-edit timeline, not that you build the timeline from scratch yourself.

### 4.2 One Editor Project Per Content Item

Each piece of generated content should have exactly one editor project. Opening the editor from the queue should open *that project* — pre-populated with the AI-generated shots, voiceover, and music in the correct order — not a blank canvas.

If the user makes edits and then goes back to the queue and reassembles (e.g., after generating a new shot), the editor project should update automatically to reflect the new assembly. The user should not have to manually rebuild.

### 4.3 Draft and Published States

Right now, editor projects exist in permanent limbo — they are always editable, there is no concept of "done." Creators need a clear moment of finality:

- **Draft** — work in progress. Editable. Only the creator can see it.
- **Published** — finalized. Locked from further edits. A snapshot of what was posted. If changes are needed, the creator creates a new draft version (which copies the timeline as a starting point).

Publishing requires a successful export. You cannot publish a reel that has not been rendered.

### 4.4 The Queue as a Live Dashboard

The queue currently shows static state — it reflects the world as of when the assets were created and goes dark after assembly. It should show:
- Whether an editor project exists and its status (draft / published)
- Whether an export job is in progress or complete
- A direct "Open in Editor" button that navigates to the pre-populated editor project

The queue should be the place a creator goes to see the full state of everything they're working on, not just the generation pipeline phase.

### 4.5 Eliminate localStorage for Job Tracking

Video generation job state is currently stored in `localStorage`. This means:
- Closing the browser tab loses the job state
- Opening a second tab shows a different state
- The queue and editor have no visibility into ongoing jobs

Job state must live on the server (already exists in the `video_jobs` table). The frontend polls it via the existing `use-video-job` hook. `localStorage` is removed.

---

## Section 5 — Assembly System

### 5.1 Assemble Should Mean "Build My Timeline," Not "Produce My Final Video"

The current "Assemble" button is a black box: click it, wait, get a final video. No control over timing, no ability to review before the render, no way to change a shot after assembly.

The new model: "Assemble" means "take my AI-generated shots and put them on the editor timeline in order." The user then reviews the timeline in the editor, makes any adjustments, and exports when satisfied. The editor's export is the canonical render — not the assembly pipeline.

This is a better product: the user always has a review step before the final render. It is also simpler engineering: one rendering system instead of two.

### 5.2 Shot Order Management

The timeline *is* the shot order. Dragging clips on the video track reorders shots. But for users who prefer a higher-level view, a "Shots" panel shows thumbnails of each shot that can be drag-reordered without touching the timeline. Reordering in the Shots panel automatically adjusts clip positions on the video track.

### 5.3 Single Shot Regeneration

After reviewing an assembled timeline, the user may find one shot is weak. They should be able to right-click that shot → "Regenerate this shot" → the AI generates a new clip for that shot position → the timeline clip is swapped in place without losing any other edits.

### 5.4 Assembly Presets

When the editor first opens for a piece of content, offer quick layout presets:
- **Standard** — shots in order, voiceover full duration, music at 30% volume
- **Fast Cut** — shots trimmed to 2-3 seconds each
- **Cinematic** — 0.5s fade transitions between shots

These set the initial timeline arrangement. The user can always adjust from there.

---

## Section 6 — Effects and Transitions

### 6.1 Transitions Between Clips

Five transition types: Fade, Slide Left, Slide Up, Dissolve, Wipe Right. Duration 200ms-2000ms. Transitions appear as diamond icons between adjacent clips on the timeline. Click the diamond to configure in the inspector.

The preview shows an approximate CSS-animated version. Export uses ffmpeg's `xfade` filter for accurate rendering.

### 6.2 Color Filter Presets

The existing Effects tab has presets defined but they are no-ops. Wire them to actually apply warmth, contrast, and opacity values to selected clips. This is a small engineering task (the sliders and reducer actions already exist — just need to connect them) but a visible quality upgrade.

---

## Section 7 — Phasing and Priority

| Priority | Initiative | Rationale |
|---|---|---|
| **P0 — Fix now** | Section 1 bugs (dead buttons, wrong tracks, stacking, offscreen toggles, missing waveforms) | Active regressions. Users encounter these immediately. |
| **P1 — Next sprint** | Unified data layer (1.1, 4.1-4.5) | Foundational. Everything downstream depends on the editor opening pre-populated. |
| **P2 — Following sprint** | Editor core quality (Section 3) | Makes the editor usable for real work. Without split, snap, and 9:16 it feels like a toy. |
| **P3** | Caption system overhaul (Section 2) | Highest-value feature for creators. Locks in retention vs. CapCut. |
| **P4** | Assembly system (Section 5) | Converts the "Assemble" black box into an editor-integrated workflow. |
| **P5** | Effects and transitions (Section 6) | Polish. Adds competitive parity without unlocking new workflows. |

---

## Success Metrics

| Metric | Current | Target | How Measured |
|---|---|---|---|
| Editor open rate from queue | Unknown (button broken) | >60% of queue items | Click events on "Open in Editor" |
| Reel completion rate (assembly → export) | Low (pipeline disconnected) | >40% of assembled projects exported | Export job creation events |
| Caption adoption | 0% (feature missing) | >30% of exported reels use captions | Caption clip present in export |
| Time to first preview (after assembly) | N/A (broken) | <5 seconds | Time from navigation to first frame rendered |
| Editor NPS | Not measured | ≥40 | In-product survey after first export |

---

## Non-Goals

- **Collaborative editing** — multiple users editing the same project simultaneously
- **Direct publishing to Instagram/TikTok** — social platform API integration is a separate product initiative
- **AI re-editing via chat** ("make this punchier" edits the timeline) — long-term vision, not this cycle
- **Multi-language caption translation** — transcription in English only for now
- **LUT/professional color grading** — not the target audience
- **Mobile editing** — desktop-only remains the constraint

---

## Open Questions

1. **TTS word timestamps:** Does our TTS provider (ElevenLabs or equivalent) return word-level timestamps in its response? If so, we skip the Whisper call for auto-captions and use the TTS timestamps directly. Needs engineering investigation.

2. **Multiple video tracks and preview compositing:** Stacking two `<video>` elements works for preview. Does the ffmpeg export pipeline correctly composite multiple video tracks? Needs validation.

3. **"Open AI Chat" routing:** Is the chat session ID stored on the `generated_content` row or looked up via `chat_messages`? Determine the correct lookup path to implement the button fix.

4. **Assembly preset as default:** Should "Standard" always be the default assembly, or should the system detect content type (e.g., voiceover-heavy = Voiceover Focus preset)? Start with Standard, consider smart default in Phase 4b.
