# Editor Preview Playback Stabilization — Plan

> **Date:** 2026-04-08
> **Status:** Draft
> **Deciders:** Studio frontend owner, editor/backend owner, product owner

## 1. Problem Statement

The Studio editor preview currently fails at the most important moment in the editing loop: steady playback of video clips. Users report that clips do play, but the video visibly lags and embedded clip audio sounds choppy. Source review shows why this is plausible. The preview drives a local playhead with `requestAnimationFrame`, republishes reducer time every 150 ms, and then continuously "corrects" mounted HTML media elements back toward that JavaScript clock when drift exceeds 100 ms. At the same time, the preview mounts original signed asset URLs directly, not editor-specific proxy renditions, and video clip audio is emitted from the same `<video>` elements whose `currentTime` is being seek-corrected. This is a fragile combination: it ties audible playback to the same elements we keep nudging for visual sync, while also forcing frame-rate-scale React activity through the editor shell.

This needs to be fixed now because preview trust is the editor's foundation. If playback is unreliable, users cannot confidently trim, reorder, or judge clip timing. The recent preview refactor on April 8, 2026 created better module boundaries (`PreviewStageRoot`, `usePreviewMediaSync`, `usePreviewPlaybackBridge`, `preview-scene`), which makes this the right moment to correct the runtime model before more caption, effects, and AI-assembly work piles on top of unstable playback behavior. If we do nothing, every new visual feature increases main-thread pressure and makes the current sync strategy more brittle.

## 2. Goals & Non-Goals

**Goals**

| # | Goal | Success Looks Like |
|---|------|--------------------|
| 1 | Smooth steady-state preview playback | At 1x forward playback, active clips no longer visibly hitch every few hundred milliseconds and audible clip audio is continuous. |
| 2 | Stable audio strategy | Embedded clip audio is no longer coupled to a seek-heavy visual path; preview audio behavior is explicit and predictable. |
| 3 | Preserve editor semantics | Scrub, trim, transitions, multi-track layering, and published/export timing rules remain logically aligned with the existing timeline model. |
| 4 | Add observability | We can measure hard seeks, dropped frames, waiting/stalled events, drift, and proxy/original selection instead of debugging from anecdotes. |
| 5 | Keep rollout reversible | Each stage ships behind a flag or isolated seam so we can fall back without corrupting projects or changing export data. |

**Non-Goals**

| # | Non-Goal | Reason |
|---|----------|--------|
| 1 | Build a full browser NLE with perfect frame-accurate editing parity | That would require a much larger custom media engine than this bug warrants. |
| 2 | Redesign export from scratch | Export timing parity matters, but export itself is not the root cause of the laggy preview. |
| 3 | Guarantee high-fidelity reverse playback at all transport rates | Browser media primitives remain limited here; we should document graceful degradation instead. |
| 4 | Solve every editor performance issue | This plan is focused on playback smoothness, audio continuity, and the runtime model directly responsible for them. |

## 3. Background & Context

The execution path from "working state" to "broken behavior" is reasonably clear from the current code. Timeline math itself is not the likely fault boundary: `editor-composition.ts` maps timeline time to source time consistently, and asset resolution is straightforward. The divergence happens after that, inside the preview runtime that translates playhead time into imperative media element behavior.

### Verified working boundary

1. The editor reducer stores timeline clips, trims, durations, and playback rate correctly.
2. `getClipSourceTimeSecondsAtTimelineTime()` computes source time deterministically from `startMs`, `trimStartMs`, and `speed`.
3. Asset URLs resolve to signed source files through `/api/assets` and `/api/media`.
4. The break appears after those steps, when the preview runtime repeatedly seeks audible media toward a JS-owned playhead.

### Reliable reproduction shape

1. Open the editor with one or more video clips that have embedded audio.
2. Press play and let the preview run at 1x.
3. The issue is expected to worsen with denser timelines, heavier source assets, overlapping tracks, or any main-thread pressure from captions/effects.

### Last known good

Unknown. Git history shows a major preview refactor in commit `364826c` on 2026-04-08, but the seek-sync model predates that refactor. We should treat the exact regression point as unconfirmed rather than assume the new architecture introduced the entire bug.

### Current system facts from the codebase

| Area | Current behavior | Why it matters |
|------|------------------|----------------|
| Preview clock | `usePreviewPlaybackBridge` updates `previewCurrentTimeMs` every animation frame and republishes reducer time every 150 ms with a 300 ms resync threshold. | This creates a high-frequency preview clock while still routing state through the React tree. |
| Video sync | `usePreviewMediaSync` seeks active video when drift exceeds 100 ms and also writes `playbackRate`, `volume`, `muted`, and play/pause state. | Audible video playback is tied to a corrective seek loop. |
| `requestVideoFrameCallback` usage | The current hook requests a single callback per effect pass instead of chaining callback-to-callback. | The runtime is not truly decoder-frame-driven even though the hook comment says it prefers RVFC. |
| Audio sync | `<audio>` elements are also corrected against the same JS playhead using the same 100 ms threshold. | Audio can glitch if drift repeatedly crosses the seek threshold. |
| Asset inputs | `useEditorAssetMap` exposes original signed `mediaUrl`/`audioUrl`/`r2Url` only. | The editor has no preview proxy or capability-aware fallback path. |
| Mounted media window | `preview-scene` keeps clips mounted within an adaptive 6 s to 18 s window around the playhead. | Better than the old broad mount window, but still not enough if the source files themselves are expensive. |
| Clip audio semantics | Timeline video clips are built with `volume: 1` and `muted: false`; export also mixes video-stream audio whenever the track is not muted. | This conflicts with other documentation and asset metadata that treat clip audio as opt-in. |
| Existing clip-audio model elsewhere | `VideoWorkspacePanel` already reads and writes `asset.metadata.useClipAudio`. | We already have a product concept for "clip audio on/off"; the editor preview just does not honor it yet. |

### Current-state flow

```mermaid
flowchart LR
    A[Reducer timeline state] --> B[usePreviewPlaybackBridge]
    B -->|rAF state update every frame| C[PreviewStageRoot render]
    C --> D[derivePreviewScene]
    C --> E[usePreviewMediaSync]
    E -->|set currentTime / playbackRate / play()| F[HTMLVideoElement]
    E -->|set currentTime / playbackRate / play()| G[HTMLAudioElement]
    F --> H[Visible video + embedded audio]
    G --> I[Voiceover / music audio]
```

The important point is that the same runtime both decides what media exists and repeatedly forces active media toward a JS-owned playhead. For visual-only clips this is survivable. For audible video clips, it is a bad fit because corrective seeks are not transparent to the audio path.

### Code references

- `frontend/src/features/editor/runtime/usePreviewPlaybackBridge.ts`
- `frontend/src/features/editor/runtime/usePreviewMediaSync.ts`
- `frontend/src/features/editor/scene/preview-scene.ts`
- `frontend/src/features/editor/hooks/useEditorAssetMap.ts`
- `backend/src/domain/editor/sync/sync.service.ts`
- `backend/src/domain/editor/run-export-job.ts`
- `frontend/src/features/video/components/VideoWorkspacePanel.tsx`
- `backend/src/routes/assets/media.router.ts`

## 4. Research Summary

**HTML media clocks, seeking, and video-frame callbacks**

- MDN documents that setting `HTMLMediaElement.currentTime` performs a seek, not a harmless correction, and it also notes reduced timer precision in some browsers. MDN also documents that `requestVideoFrameCallback()` is meant to be chained from callback to callback and is useful for per-frame work and synchronization with external audio sources, but it does not offer strict timing guarantees. The Chrome/web.dev article on RVFC adds an important implementation detail: Chromium backs `video.currentTime` with the audio clock, while `metadata.mediaTime` comes directly from frame presentation metadata.
- The key insight is that our current model is upside down for audible video: we keep forcing the media element toward a JS playhead, even though the browser already has its own audio-backed media clock. That makes repeated seeks much more likely than if we let steady-state playback run and observed the media clock instead.
- Sources:
  - https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/currentTime
  - https://developer.mozilla.org/en-US/docs/Web/API/HTMLVideoElement/requestVideoFrameCallback
  - https://web.dev/articles/requestvideoframecallback-rvfc

**Web Audio graph reuse and audio routing**

- MDN recommends reusing a single `AudioContext` across multiple sources, and `AudioContext.createMediaElementSource()` explicitly supports playing and manipulating audio from `<video>` or `<audio>` elements. MDN also documents that `HTMLMediaElement.crossOrigin` determines whether media is fetched with CORS enabled.
- The key insight is that we do not need a full custom decoder stack to decouple audible preview from visible video. We can route selected media elements through a shared audio graph for gain/mute/control, and if signed R2 URLs are awkward for CORS, we already have a same-origin media streaming path in the repo that can be extended beyond waveform decode.
- Sources:
  - https://developer.mozilla.org/en-US/docs/Web/API/AudioContext
  - https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/crossOrigin

**Capability-aware media selection and playback telemetry**

- Google's Media Capabilities case study reports that YouTube improved mean time between rebuffers by 7.1% while only reducing average served resolution by 0.4% when it incorporated smoothness-aware selection. The same general web-platform direction exists for sites outside ABR streaming: choose inputs the device can decode smoothly, and measure actual playback quality rather than assume decode success implies good UX.
- The key insight is that even a better sync loop will still struggle if the editor feeds original high-complexity assets to every device. Preview proxies and dropped-frame telemetry are not optional extras; they are part of a robust editor playback strategy.
- Sources:
  - https://web.dev/case-studies/youtube-media-capabilities
  - https://developer.mozilla.org/en-US/docs/Web/API/Navigator/mediaCapabilities
  - https://developer.mozilla.org/en-US/docs/Web/API/HTMLVideoElement/getVideoPlaybackQuality

## 5. Options Considered

**Option A: Keep the current preview strategy and make no structural changes**

What is this approach? Keep the JS-owned playhead, per-frame React-driven preview updates, direct source assets, and seek-correction model as-is. Only handle one-off bugs if they become severe.

| Dimension | Assessment |
|-----------|------------|
| Complexity | Lowest short-term effort. |
| Performance | Poor. Existing reports of laggy video and choppy audio remain plausible and likely worsen with more features. |
| Reliability | Low. The system depends on repeated corrections to audible media elements. |
| Cost | Lowest immediate engineering cost, highest user-trust cost. |
| Reversibility | Trivially reversible because nothing changes. |
| Stack fit | Fits the current code only because it is already there. |
| Team readiness | High, but that is not enough to justify keeping a broken model. |

Risks:

- Preview trust continues to erode, making every edit operation feel unreliable.
- More caption/effects work increases main-thread pressure and amplifies the current bug.
- Engineers keep debugging symptoms rather than fixing the runtime contract.

Open questions:

- None that improve the option materially. This is the "accept the bug" path.

**Option B: Minimal stabilization of the current engine**

What is this approach? Keep the JS-owned playhead and HTML media model, but fix the worst parts: isolate frame-rate state so the whole editor does not rerender on preview ticks, correct RVFC usage, reduce hard-seek frequency, omit empty `src`, and add telemetry. Optionally mute embedded video audio by default unless explicitly enabled.

| Dimension | Assessment |
|-----------|------------|
| Complexity | Low to medium. Mostly localized to preview runtime and wiring. |
| Performance | Moderate improvement likely, especially from fewer global rerenders and fewer hard seeks. |
| Reliability | Better than today, but still limited by a JS-clock-first model. |
| Cost | Good short-term ROI. |
| Reversibility | High. Can be feature-flagged and rolled back easily. |
| Stack fit | Strong fit with the current React/HTML media architecture. |
| Team readiness | High. The team can execute this with existing code seams. |

Risks:

- It may reduce symptoms without eliminating the root mismatch between audible media and corrective seeking.
- If heavy source assets are a major contributor, sync fixes alone may not feel dramatic enough.
- Mute-by-default clip audio could create preview/export mismatch unless semantics are aligned.

Open questions:

- How much of the issue disappears once seeks become rare?
- Are most reports coming from timelines that depend on clip audio, or would muting embedded audio be acceptable for most users?

**Option C: Hybrid preview engine with decoupled audio and adaptive media inputs**

What is this approach? Keep the existing timeline data model, but change steady-state playback behavior. The editor still owns scrub/seek intent, yet forward playback shifts to a media-aware runtime: visible `<video>` elements become primarily visual surfaces, audible preview is routed through a dedicated audio layer that honors explicit clip-audio semantics, hard seeks happen only on state transitions or sustained major drift, and the editor can choose lighter preview media when the device or asset warrants it.

| Dimension | Assessment |
|-----------|------------|
| Complexity | Medium to high, but still incremental and compatible with the current architecture. |
| Performance | Strongest path short of a full custom engine. Reduces seeks, reduces unnecessary rerenders, and makes proxies possible. |
| Reliability | High relative to the alternatives because it addresses both clocking and media-input complexity. |
| Cost | Higher engineering cost than Option B and some storage/transcode cost if proxies are added. |
| Reversibility | Medium. Needs feature flags and migration of clip-audio semantics, but can be phased safely. |
| Stack fit | Good. It extends current browser primitives instead of discarding them. |
| Team readiness | Reasonable. The repo already has modular preview seams, same-origin media proxying, and an existing `useClipAudio` concept. |

Risks:

- AudioContext/CORS/autoplay details could complicate rollout on Safari and mobile browsers.
- Proxy generation adds pipeline and storage costs.
- The master-clock rules need to be explicit for cases like overlapping clip audio plus voiceover plus music.

Open questions:

- Should the shared audio layer use plain hidden `<audio>` elements first, or go directly to `AudioContext` gain nodes?
- When multiple audible layers overlap, which source should define the preview clock?
- How much proxy generation is needed up front versus capability-based fallback?

**Option D: Full custom playback engine with WebCodecs/WebAudio/canvas composition**

What is this approach? Replace the browser's built-in media presentation path with a bespoke engine that decodes, composites, and schedules audio/video itself.

| Dimension | Assessment |
|-----------|------------|
| Complexity | Extremely high. This becomes a new product surface, not a bug fix. |
| Performance | Potentially best-case in the long term, but only after a large amount of specialized engineering. |
| Reliability | High only if executed extremely well; otherwise the blast radius is enormous. |
| Cost | Very high engineering and maintenance cost. |
| Reversibility | Low. Once adopted deeply, backing out is expensive. |
| Stack fit | Weak for the current team and product scope. |
| Team readiness | Low relative to the effort required. |

Risks:

- Large cross-browser surface area.
- Massive test burden.
- Delays other editor work for too long.

Open questions:

- Only worth revisiting if the hybrid approach fails and the editor becomes a core company moat.

## 6. Recommendation

**We recommend Option C: Hybrid preview engine with decoupled audio and adaptive media inputs.**

This wins over the status quo because the current model is structurally hostile to smooth audible playback: it keeps seeking the same media elements that emit clip audio. It wins over the simplest change because the simpler change is still a JS-clock-first design and likely leaves us fighting drift symptoms forever. It wins over the full custom-engine path because we can solve the observed bug class with far less complexity by using the browser primitives more intentionally instead of abandoning them.

The recommendation depends on three assumptions. First, repeated corrective seeks and unnecessary render churn are major contributors to the bug, not just pathological codecs. Second, clip audio should be explicit and opt-in, which aligns with the existing `useClipAudio` asset model elsewhere in the repo. Third, preview proxies are an acceptable cost for problematic assets and devices. If Phase 0 data shows that almost all failures come from unsupported/heavy source files and not from seek frequency, then proxy work should move earlier in the sequence. If user research shows clip audio is rarely needed in preview, we can simplify Phase 2 by muting embedded clip audio entirely unless explicitly enabled and delay richer audio-graph work.

## 7. Implementation Plan

**Phase 0: Measure and Reproduce**

Goal and done criteria. Create a reproducible benchmark for the bug and add enough telemetry to replace guesswork. This phase is done when we can compare before/after playback using seek counts, dropped frames, waiting/stalled events, and clip categories instead of subjective reports.

Deliverables:

- [ ] Add preview metrics for hard seeks, soft drift, `waiting`/`stalled`, `play()` failures, mounted media counts, and dropped frames via `getVideoPlaybackQuality()`.
- [ ] Create a repeatable test project set: single clip with embedded audio, sequential AI clips, and a denser multi-track timeline.
- [ ] Capture baseline behavior on the primary support matrix: Chrome on macOS, Safari on macOS, and one lower-power device/browser combo.
- [ ] Record what percentage of affected assets contain embedded audio and whether `useClipAudio` is enabled.

Dependencies:

- None.

Risks in this phase and how we'd detect them:

- Instrumentation itself perturbs playback. Detect by comparing flagged and unflagged runs on the same project.
- We only measure "friendly" assets. Detect by explicitly including generated clips and user uploads in the benchmark set.

Rollback plan:

- Keep the instrumentation behind a dev flag or logging flag and disable it if it changes playback materially.

**Phase 1: Stabilize the Existing Runtime**

Goal and done criteria. Remove the highest-leverage pathologies without changing the product model yet. This phase is done when steady 1x playback no longer causes whole-editor frame-rate rerenders, RVFC is used correctly where available, and the sync loop performs hard seeks only on explicit state transitions or sustained large drift.

Deliverables:

- [ ] Move preview-frame state out of `useEditorLayoutRuntime()` so only the preview subtree rerenders at animation-frame cadence.
- [ ] Refactor `usePreviewMediaSync()` into a small state machine:
- [ ] Hard seek on scrub, play/resume, clip activation, trim/rate changes, or large sustained drift.
- [ ] Do not seek continuously on ordinary 1x steady playback.
- [ ] Re-register `requestVideoFrameCallback()` from inside its callback instead of once per React effect pass.
- [ ] Use RVFC metadata and media events for monitoring rather than treating React render cadence as the decoder clock.
- [ ] Omit empty `src` attributes for audio/video placeholders.
- [ ] Ensure prerender windows never leak audible audio.

Dependencies:

- Phase 0 metrics.

Risks in this phase and how we'd detect them:

- Transitions or scrubbing could become visually stale if we reduce seek frequency too aggressively. Detect with targeted transition and trim test cases.
- Safari may behave differently than Chrome for RVFC and drift timing. Detect with browser-matrix manual verification.

Rollback plan:

- Feature-flag the new sync state machine and keep the old runtime path available until metrics and QA pass.

**Phase 2: Decouple Audio and Align Clip-Audio Semantics**

Goal and done criteria. Make audio explicit, stable, and aligned across preview and export. This phase is done when embedded clip audio no longer depends on the same `<video>` elements we use for visual sync, and preview/export both honor the same clip-audio contract.

Deliverables:

- [ ] Extend editor asset metadata available to preview so it can read `hasEmbeddedAudio` and `useClipAudio`.
- [ ] Change timeline/import defaults so embedded video audio is opt-in, not silently always-on.
- [ ] During steady forward playback, mute visible `<video>` elements and route audible clip audio through a dedicated audio layer.
- [ ] Start with hidden media elements plus a shared `AudioContext`/gain graph if needed for per-track control and future analysis.
- [ ] Define master-clock rules for steady playback: voiceover if present, otherwise first enabled clip-audio stream, otherwise music, otherwise fallback clock.
- [ ] For reverse or extreme transport rates, explicitly degrade: disable clip audio or fall back to the simpler sync path rather than promise professional-NLE parity.
- [ ] Update export audio selection so it honors explicit clip-audio semantics instead of assuming all video-stream audio should mix whenever the track is unmuted.

Dependencies:

- Phase 1 runtime stabilization.
- Agreement on preview/export clip-audio semantics.

Risks in this phase and how we'd detect them:

- Autoplay and `AudioContext.resume()` rules can block audio start. Detect with integration tests and real-browser QA.
- Signed URLs may not cooperate with `createMediaElementSource()` under all CORS setups. Detect early with a spike; use same-origin proxying if needed.
- Preview/export parity could regress during the semantic shift. Detect with parity fixtures covering clip-audio enabled/disabled cases.

Rollback plan:

- Gate dedicated audio routing and the new clip-audio semantic behind a flag. If parity or browser behavior is wrong, revert preview to visual-only video while keeping Phase 1 fixes.

**Phase 3: Introduce Preview Proxies and Capability-Aware Selection**

Goal and done criteria. Reduce decode cost for problematic assets and devices. This phase is done when the editor can choose a lighter preview rendition for assets likely to struggle and can prove that the choice improves playback metrics.

Deliverables:

- [ ] Add preview-oriented asset variants for video clips, starting with a lightweight H.264/AAC rendition suitable for editing preview.
- [ ] Optionally add audio-only derivatives for clip-audio playback so embedded audio does not require the full video file.
- [ ] Record enough asset metadata to choose between original and proxy intelligently.
- [ ] Use `navigator.mediaCapabilities.decodingInfo()` and/or asset heuristics to prefer proxy playback when decode smoothness is doubtful.
- [ ] Keep export on original media only; proxies are preview-only.

Dependencies:

- Asset pipeline work on the backend.
- Decision on where preview rendition metadata lives.

Risks in this phase and how we'd detect them:

- Proxy generation increases storage and processing cost. Detect with asset-count and storage-cost reporting.
- Preview could diverge too far from export if proxy encodes are visually degraded. Detect with visual QA thresholds and asset sampling.

Rollback plan:

- Keep proxy selection behind a flag and fall back to originals if rendition generation or selection logic misbehaves.

**Phase 4: Validate, Roll Out, and Remove Legacy Path**

Goal and done criteria. Ship the new path safely and remove dead code only after metrics improve in production-like usage. This phase is done when the flagged rollout shows better playback metrics and fewer bug reports, and the old runtime can be deleted without losing rollback confidence.

Deliverables:

- [ ] Add unit coverage for the new sync state machine and clip-audio semantics.
- [ ] Add browser-level acceptance checks for the benchmark projects.
- [ ] Roll out with telemetry comparison between old and new preview paths.
- [ ] Remove the legacy runtime after success thresholds hold for a defined period.

Dependencies:

- Phases 1-3.

Risks in this phase and how we'd detect them:

- Real-world asset mix differs from staging/QA. Detect via rollout telemetry segmented by asset type and browser.
- We prematurely remove the fallback path. Detect by keeping the feature flag operational until thresholds are consistently met.

Rollback plan:

- Re-enable the legacy path by feature flag and keep it deployable until post-rollout confidence is high.

## 8. Risk Register

| # | Risk | Likelihood | Impact | Mitigation |
|---|------|-----------|--------|------------|
| 1 | AudioContext/autoplay policies block preview audio start | Medium | High | Resume audio context only on user gesture, test across Chrome/Safari early, and keep a simpler fallback path. |
| 2 | Signed R2 URLs are awkward for Web Audio due to CORS | Medium | Medium | Use the existing same-origin media proxy path for editor playback if needed. |
| 3 | Preview/export clip-audio behavior diverges during rollout | Medium | High | Treat clip-audio semantics as a shared contract and add parity fixtures before switching defaults. |
| 4 | Proxy generation cost grows faster than expected | Medium | Medium | Start with only problematic asset classes and measure storage/transcode cost before broad rollout. |
| 5 | The real bottleneck is mostly codec/decode complexity, not sync strategy | Medium | High | Phase 0 metrics decide whether proxy work must move earlier. |
| 6 | Reverse or high-rate playback regresses | Medium | Medium | Explicitly document lower-fidelity fallback behavior instead of trying to keep every mode perfect. |
| 7 | Telemetry adds enough overhead to distort results | Low | Medium | Keep instrumentation lightweight, dev-flagged, and validate with A/B runs. |
| 8 | New preview code becomes more complex than the team can comfortably maintain | Medium | Medium | Phase the rollout, keep responsibilities separated, and avoid jumping to a full custom renderer. |

## 9. Success Criteria

| Goal | Metric | Baseline | Target | How Measured |
|------|--------|----------|--------|--------------|
| Smooth steady-state playback | Hard seek count per active media element during 1x forward playback | Current runtime seeks whenever drift exceeds 100 ms; actual rate unknown today | `<= 1` hard seek per 10 seconds of steady playback | Phase 0/4 preview telemetry |
| Smooth steady-state playback | Dropped-frame ratio for active preview video | Not measured today | `< 1%` dropped frames on supported 1080p preview assets | `getVideoPlaybackQuality()` sampled during playback |
| Stable audio strategy | Audible glitch reports in the benchmark suite | Current user reports indicate clips are "choppy" | No audible glitches in acceptance test matrix | Manual QA + recorded benchmark runs |
| Reduce unnecessary render churn | Frame-rate rerenders outside the preview subtree while playing | Whole `EditorLayout` currently rerenders when preview time state changes | `0` frame-driven rerenders outside preview-owned subtree | React profiler / instrumentation |
| Explicit clip-audio semantics | Preview/export parity for `useClipAudio` enabled vs disabled clips | Current editor preview/export ignore asset-level `useClipAudio` semantics | `100%` parity on fixture set | Automated parity fixtures + manual verification |
| Better device fit | Playback path chooses proxy for assets/devices unlikely to decode originals smoothly | Original sources only | Capability-aware selection enabled for targeted asset/device classes | Selection logs + telemetry |

Leading indicators:

- Hard seek rate drops immediately after Phase 1.
- Non-preview subtree rerenders disappear after preview-state isolation.
- Browsers stop reporting frequent `waiting`/`stalled` events on benchmark projects.

Lagging indicators:

- Fewer user reports of laggy preview playback.
- Higher preview-session completion rate for edit tasks that require clip timing adjustments.

## 10. Open Questions

| # | Question | Owner | Needed By | Status |
|---|----------|-------|-----------|--------|
| 1 | Which browsers and machines account for most of the reported choppy playback? | Frontend | Before Phase 1 rollout | Open |
| 2 | How often do projects actually need embedded clip audio in preview versus voiceover/music only? | Product + Frontend | Before Phase 2 semantic change | Open |
| 3 | Can the existing signed R2 URLs be used safely with `createMediaElementSource()`, or do we need a same-origin playback route? | Frontend + Backend | During Phase 2 spike | Open |
| 4 | Where should preview proxy metadata live: asset metadata, a separate rendition table, or derived on demand? | Backend | Before Phase 3 implementation | Open |
| 5 | Do we want preview proxies generated eagerly on ingest or lazily for only problem assets? | Backend + Product | Before Phase 3 implementation | Open |
| 6 | What is the explicit master-clock policy when voiceover, clip audio, and music overlap? | Frontend | Before Phase 2 implementation | Open |

## 11. Alternatives Rejected

| Option | Why Rejected |
|--------|-------------|
| Keep the current strategy unchanged | It leaves the known failure mode in place and guarantees more wasted debugging time later. |
| Minimal-only fix as the long-term answer | Helpful as Phase 1, but still a compromise architecture that keeps audio too close to corrective seeking. |
| Full custom WebCodecs/WebAudio renderer now | Too much complexity and risk for the scope of the bug and the current team/product stage. |
