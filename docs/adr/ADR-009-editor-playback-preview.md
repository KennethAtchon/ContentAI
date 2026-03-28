# ADR-009: Editor timeline playback vs HTML media preview

## Status

Accepted

## Context

The manual editor has two coupled clocks:

1. **Timeline playhead** — advanced by `usePlayback` while `isPlaying` is true, using a global `playbackRate` (JKL transport: forward, reverse, up to ±8× in the UI).
2. **`<video>` / `<audio>` elements** in `PreviewArea` — `currentTime` is **seek-synced** to the playhead using `getClipSourceTimeSecondsAtTimelineTime` (trim + per-clip `speed`). `HTMLMediaElement.playbackRate` is set separately.

Without a documented rule, JKL scrubbing and per-clip speed interact in confusing ways (browser codec limits, reverse playback, A/V drift).

## Decision

- **Source frame mapping** — Always use shared helpers in `frontend/src/features/editor/utils/editor-composition.ts` (`getClipSourceTimeSecondsAtTimelineTime`, active-clip rules, transition preload windows) for preview. Timeline clips (`TimelineClip`) use the same `isClipActiveAtTimelineTime` for playhead-under-clip highlighting.
- **Element `playbackRate`** — Set to `effectiveHtmlMediaPlaybackRate(timelinePlaybackRate, clip.speed)` so global transport rate multiplies per-clip speed, clamped to a browser-safe range (±16). The playhead still advances only from `usePlayback`; seeks correct large drift.
- **Export / server** — FFmpeg export in `backend/src/routes/editor/index.ts` (`runExportJob`) encodes trim + `setpts` for speed; it is not TypeScript-shared with the SPA but must be **kept logically in sync** with `editor-composition` when timing rules change (see comment on `runExportJob`).

## Consequences

- Fast-forward at 2× with a 2× clip yields a 4× effective element rate until the browser clamps; preview may fall back to seek-heavy behavior for extreme combinations.
- Reverse JKL remains dependent on codec and browser support; we do not guarantee professional-NLE parity.
- New timing features should add tests under `__tests__/unit/features/editor/` and update this ADR if the model changes.
