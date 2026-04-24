# Perf Budgets — Gate Conditions Per Phase

> Every implement-phase has a gate. Merge only if the numbers below hold. If a phase introduces a regression, fix before merge.

## Baseline (pre-migration, phase 0)

Captured from user report + `docs/bugs/issues.md`:

| Metric | Value |
| --- | --- |
| Preview FPS (3-clip 1080p) | 5–10 |
| React commits / 10s playback | ~300 |
| Main-thread ms/frame | ~31 |
| Memory growth after 1h | unbounded |
| Preview ↔ export parity | diverges |

## Targets By Phase

| After phase | Preview FPS | Commits/10s | ms/frame | Scrub p95 | Memory 1h |
| --- | --- | --- | --- | --- | --- |
| 1 — Cleanse | 8–15 | ~280 | ~26 | — | unchanged |
| 2 — Scaffold | unchanged | unchanged | unchanged | — | unchanged |
| 3 — Clock | 25–35 | ≤ 30 | ~18 | — | unchanged |
| 4 — Render pipeline | **≥ 55** | ≤ 30 | ≤ 12 | ≤ 120 ms | unchanged |
| 5 — Frame cache | ≥ 55 | ≤ 30 | ≤ 12 | **≤ 80 ms** | **≤ 500 MB** |
| 6 — Captions | ≥ 55 | ≤ 20 | ≤ 10 | ≤ 80 ms | ≤ 500 MB |
| 7 — Unified export | ≥ 55 | ≤ 20 | ≤ 10 | ≤ 80 ms | ≤ 500 MB (+ pixel parity ΔE < 2) |
| 8 — Contexts | ≥ 55 | **≤ 10 per interaction** | ≤ 10 | ≤ 80 ms | ≤ 500 MB |
| 9 — Autosave | ≥ 55 during save | ≤ 10 | ≤ 10 | ≤ 80 ms | ≤ 500 MB |
| 10 — Cutover | **≥ 58** | ≤ 10 | ≤ 8 | ≤ 50 ms | ≤ 350 MB |

## How To Measure

### FPS
- Chrome DevTools → Performance → record 10 s of continuous playback on a 3-clip 1080p project.
- Read the FPS meter on top of the recording.
- Median, not peak.

### Commits
- React DevTools → Profiler → start, play for 10 s, stop.
- Sum of commit counts across all components in the list.

### Main-thread ms/frame
- Performance panel → "Main" thread → sum of scripting + rendering + painting per frame. Average over the 10-s sample.

### Scrub p95
- Add a small timing wrapper in dev mode: on a mousedown on the timeline ruler, record timestamp; on the first `renderFrame` call that returns, record timestamp. Difference = scrub latency. Run 20 scrubs, sort, take the 19th.

### Memory 1 h
- Open editor, start playback in a loop (or leave idle with playback ticking).
- Chrome DevTools → Performance Monitor → "JS heap size" + "Documents".
- Record max minus initial after 1 hour.

### Pixel ΔE
- Run `ffmpeg -ss N -vframes 1 out.mp4 frame.png` for N ∈ {0, 1, 2, 5, 10}.
- Screenshot preview canvas at same times (`canvas.toDataURL`).
- Diff with `magick compare -metric AE ...` or custom pixel walk. ΔE is CIEDE2000 if you care; simple RGB diff is acceptable.

## Reference Projects

Keep these saved in dev fixtures for repeatable benchmarking:

- `bench-3clip.json` — 3 video clips, one cut, no captions. The "clean room" baseline.
- `bench-10clip-captions.json` — 10 clips with 2 tracks, overlay text, karaoke captions, one transition.
- `bench-hour.json` — long timeline for memory tests (3600 s of footage from a single long source with 30 cuts).

## Don't Merge If

- FPS drops more than 3 relative to previous phase.
- Commit count doubles from previous phase.
- Memory grows instead of shrinking (monotonic within ±10% is fine).
- Pixel parity ΔE > 2 anywhere (post-phase-7).
