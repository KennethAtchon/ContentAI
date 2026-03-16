# Phase 4 Test and Release Criteria

Last updated: 2026-03-15
Related:
- `docs/specs/PHASE4_VIDEO_PRODUCTION_MVP.md`
- `docs/specs/PHASE4_TECHNICAL_DESIGN.md`
- `docs/specs/PHASE4_API_AND_FLOW_CONTRACTS.md`

## Release Objective

Phase 4 is releasable only when users can consistently generate a complete, watchable, downloadable reel (video + audio + captions) with one primary action: `Generate Reel`.

## Test Strategy

Testing is organized into:

- functional behavior (happy path)
- failure and recovery
- validation and security
- performance and cost guardrails

## Functional Test Matrix

| Area | Scenario | Expected Result |
| --- | --- | --- |
| Auto-generation | User starts full reel generation from valid content | Job created, clips generated, assembly completes, player shows final MP4 |
| Clip generation | All shots generate with selected provider | Each shot gets a `video_clip` asset and metadata `shotIndex` |
| Upload override | User uploads valid MP4 as shot replacement | Asset stored, shot reference updated, re-assembly succeeds |
| Image override | User uploads valid image replacement | Image accepted, conversion path applied during assembly, final video renders |
| Per-shot regenerate | User regenerates single shot prompt | Only target shot asset changes; other shot assets remain |
| Re-assemble | User triggers assemble after overrides | New `assembled_video` generated and linked |
| Captions | Include captions enabled | Final video includes visible subtitle overlay |
| Audio mixing | Voiceover + music attached | Output includes both tracks with expected relative levels |
| Result playback | Completed reel loaded in UI | Inline player can play full reel and download action works |
| Clip audio: user enables | User sets "Use this clip's audio" for a shot that has embedded audio | Final reel includes that clip's audio in the mix for that segment |
| Clip audio: user keeps voiceover only | User leaves default or sets "Voiceover only" for a shot with embedded audio | Final reel contains only voiceover + optional music for that segment; clip audio is not present |

## Failure and Recovery Matrix

| Failure Type | Injection/Condition | Required Behavior |
| --- | --- | --- |
| Provider timeout | Simulate video provider timeout for one shot | Shot flagged failed, retry action available, completed shots preserved |
| Provider outage | Provider unavailable for full request | Job fails with explicit error code and retry guidance |
| Assembly render error | Fail render process in worker | Job enters `failed`, no partial final asset published |
| Caption generation error | Caption provider failure | System follows configured policy (fail job or fallback without captions) |
| Upload too large | Video > 100MB or image > 10MB | Request rejected with validation error, no asset created |
| Invalid mime type | Unsupported file type | Request rejected, clear error code returned |
| Unauthorized access | User requests another user asset/job | `403` returned, no metadata leakage |
| Polling stale job | Unknown job ID | `404` style error contract, UI exits polling gracefully |

## Security and Validation Checks

- All Phase 4 routes enforce authenticated user context.
- Asset ownership checks exist on every read/write path.
- Signed URLs are short-lived and never persisted as canonical references.
- Server-side mime/size validation is mandatory even if frontend validates first.
- Prompt content passed to video providers is logged safely (no sensitive token leakage).

## Performance and Cost Guardrails

## Performance Budgets (MVP)

- API orchestration response (job creation): target < 2 seconds
- P50 generation + assembly completion: target < 120 seconds
- P95 generation + assembly completion: target < 300 seconds
- Poll endpoint response time: target < 500ms (P95)

## Cost Guardrails

- Cost recorded for each clip generation and assembly run
- Enforce max shots per reel in MVP to cap spend
- Reject unsupported upscale modes or premium provider options when tier disallows

## Observability Requirements

Minimum required telemetry before launch:

- Job lifecycle counts by status (`queued`, `rendering`, `completed`, `failed`)
- Failure code histogram by endpoint and provider
- End-to-end latency distribution
- Cost per completed reel and per failed reel

## Go / No-Go Launch Gates

Phase 4 launch is `GO` only if all gates pass:

1. `Generate Reel` happy path passes in staging and production-like environment.
2. Failure handling for provider timeout and assembly failure is validated.
3. Upload validation blocks invalid mime/size inputs.
4. Completed reels are playable in-app and downloadable.
5. Output includes synchronized voiceover/music and captions on default path.
6. No critical auth/ownership vulnerability remains open.
7. Monitoring dashboards and alerts are active for job failures and latency spikes.

If any gate fails, decision is `NO-GO`.

## Definition of Done (Engineering)

- Contract tests cover all Phase 4 endpoints and error codes.
- Integration tests cover:
  - full auto-generation
  - per-shot regenerate
  - upload override + re-assembly
  - failed job + retry
- UI tests cover polling transitions and final reel playback.
- Documentation references are updated in:
  - `docs/REEL_CREATION_TODO.md`
  - `docs/specs/index.md`

## Deferred Validation (Post-MVP)

- multi-provider quality benchmarking
- advanced caption style correctness tests
- heavy-load soak tests and queue autoscaling benchmarks
