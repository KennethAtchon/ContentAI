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



## Section 6 — Effects and Transitions

### 6.1 Transitions Between Clips

Five transition types: Fade, Slide Left, Slide Up, Dissolve, Wipe Right. Duration 200ms-2000ms. Transitions appear as diamond icons between adjacent clips on the timeline. Click the diamond to configure in the inspector.

The preview shows an approximate CSS-animated version. Export uses ffmpeg's `xfade` filter for accurate rendering.

### 6.2 Color Filter Presets

The existing Effects tab has presets defined but they are no-ops. Wire them to actually apply warmth, contrast, and opacity values to selected clips. This is a small engineering task (the sliders and reducer actions already exist — just need to connect them) but a visible quality upgrade.

---
