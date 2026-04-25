# Perf Budgets — Gate Conditions Per Phase

> Every implement-phase has a gate. Merge only if the numbers hold. If a phase regresses, fix before merge.

## Baseline (pre-migration, phase 0)

| Metric | Value |
| --- | --- |
| Preview FPS (3-clip 1080p) | 5–10 |
| React commits / 10 s playback | ~300 |
| Main-thread ms / frame | ~31 |
| Memory growth after 1 h | unbounded |
| Preview ↔ export parity | diverges |
| Undo stack memory (100-edit project) | ~50 × full-state |

## Targets By Phase

| After phase | Preview FPS | Commits / 10 s | ms / frame | Scrub p95 | Mem 1 h | Undo mem (100 edits) |
| --- | --- | --- | --- | --- | --- | --- |
| 1 — Cleanse | 8–15 | ~280 | ~26 | — | unchanged | unchanged |
| 2 — Scaffold | unchanged | unchanged | unchanged | — | unchanged | unchanged |
| **3 — State foundation** | **15–25** | **≤ 60 (non-playback) / ≤ 120 (playback)** | **~22** | **—** | **unchanged** | **200 × ~small (action tuples)** |
| 4 — Clock | 25–35 | ≤ 20 | ~18 | — | unchanged | — |
| 5 — Render pipeline | **≥ 55** | ≤ 20 | ≤ 12 | ≤ 120 ms | unchanged | — |
| 6 — Frame cache | ≥ 55 | ≤ 20 | ≤ 12 | **≤ 80 ms** | **≤ 500 MB** | — |
| 7 — Captions | ≥ 55 | ≤ 15 | ≤ 10 | ≤ 80 ms | ≤ 500 MB | — |
| 8 — Unified export | ≥ 55 | ≤ 15 | ≤ 10 | ≤ 80 ms | ≤ 500 MB (+ ΔE ≤ 2) | — |
| 9 — Autosave | ≥ 55 during save | ≤ 15 | ≤ 10 | ≤ 80 ms | ≤ 500 MB | — |
| 10 — Cutover | **≥ 58** | **≤ 10** | **≤ 8** | **≤ 50 ms** | **≤ 350 MB** | — |

Notes on phase 3 budgets (the state foundation phase):
- Playback is still on the old engine, so FPS during playback is not dramatically better; the win shows up in **editing** commits and bundle size.
- "Commits / 10 s (non-playback)" measures editing operations — dragging a clip, typing in the inspector. Target **≤ 60**. Today: hundreds.
- "Commits / 10 s (playback)" is still polluted by the old engine's 250 ms publish cycle. That cycle is killed in phase 4. Expect ≤ 120.
- **Per-clip selector test (blocking for phase 3)**: with N timeline clips, dragging clip X causes only `<TimelineClip clipId="X">` to commit. N − 1 clip components must show 0 commits in the Profiler. If they don't, the selector is wrong and the phase fails its gate.

## How To Measure

### FPS
- Chrome DevTools → Performance → record 10 s of continuous playback on a 3-clip 1080p project.
- Read the FPS meter on top of the recording. Median, not peak.

### Commits
- React DevTools → Profiler → start, perform the measured interaction for 10 s, stop.
- Sum commit counts across all components. Break down by component for the "per-clip selector" test.

### Main-thread ms / frame
- Performance panel → Main thread → sum of scripting + rendering + painting per frame. Average over the 10 s sample.

### Scrub p95
- Instrument `RenderBridge.renderAt`: record `(now, timelineMs)` on each call; record seek-requested time on timeline mousedown. Scrub latency = first rAF tick after seek where requested-ms was rendered. 20 scrubs → sort → 19th.

### Memory 1 h
- Open editor, loop playback (or leave idle ticking).
- Performance Monitor → "JS heap size" + "Documents".
- Record max minus initial.

### Pixel ΔE
- `ffmpeg -ss N -vframes 1 out.mp4 frame.png` for N ∈ {0, 1, 2, 5, 10}.
- Screenshot preview canvas at same times (`canvas.toDataURL`).
- `magick compare -metric AE` for per-pixel ΔE, or CIEDE2000 if you care.

### Undo memory
- Load a 10-clip project.
- Perform 100 edits (mix: add, remove, update).
- Snapshot `JSON.stringify(undoStack).length` — this is an upper bound on action memory.
- Compare to `JSON.stringify(state).length × 100` — the cost of snapshot-based undo would have been this.

## Reference Projects

Save these as dev fixtures:

- `bench-3clip.json` — 3 video clips, one cut, no captions.
- `bench-10clip-captions.json` — 10 clips, 2 tracks, overlay text, karaoke captions, one transition.
- `bench-hour.json` — hour-long timeline, 30 cuts. Memory test.

## Don't Merge If

- FPS regresses more than 3 vs previous phase.
- Commit count doubles vs previous phase.
- Memory trends up instead of stable.
- Per-clip selector test fails (phase 3 onward): any N−1 clip re-renders on drag of clip X.
- Pixel parity ΔE > 2 anywhere (post phase 8).
- `bun run build` output grows (net deletion expected through phase 10).
