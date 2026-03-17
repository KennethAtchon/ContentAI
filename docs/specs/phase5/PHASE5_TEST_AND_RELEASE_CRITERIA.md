# Phase 5 Test and Release Criteria

Last updated: 2026-03-16
Related:
- `docs/specs/phase5/PHASE5_EDITING_SUITE_MVP.md`
- `docs/specs/phase5/PHASE5_TECHNICAL_DESIGN.md`
- `docs/specs/phase5/PHASE5_API_AND_FLOW_CONTRACTS.md`

## Release Objective

Phase 5 is releasable when users can reliably:

- edit assembled reels in-browser (5A)
- preview edits with low-latency feedback
- render final outputs without losing composition data or previous successful versions

5B precision controls are gated and evaluated separately.

## Test Strategy

Testing is organized into:

1. API contract and validation correctness
2. 5A quick-edit behavior
3. render lifecycle and recovery
4. security/ownership guarantees
5. performance and stability budgets
6. 5B feature-flag validation (post-5A launch gate)

## Test Environment Baseline

- Use production-like generated content fixtures:
  - 6-12 shot reels
  - voiceover + music assets
  - captions present and missing variants
- Include at least one dataset with invalid/missing asset references for negative testing
- Run integration tests serially when shared mocked services are used

## API Contract Matrix

| Endpoint | Scenario | Expected Result |
| --- | --- | --- |
| `POST /api/video/compositions/init` | First open on valid Phase 4 content | `200`, composition created (`version=1`) |
| `POST /api/video/compositions/init` | Existing composition | `200`, existing composition returned |
| `GET /api/video/compositions/:id` | Owned composition | `200`, timeline + version returned |
| `PUT /api/video/compositions/:id` | Valid save with expected version | `200`, version increments |
| `PUT /api/video/compositions/:id` | Stale `expectedVersion` | `409 COMPOSITION_VERSION_CONFLICT` |
| `POST /api/video/compositions/:id/validate` | Overlapping segments | `200 valid=false` with issue list |
| `POST /api/video/compositions/:id/render` | Valid composition | `202` + `jobId` |
| `POST /api/video/compositions/:id/render` | Invalid composition | `422 TIMELINE_VALIDATION_FAILED` |
| `GET /api/video/composition-jobs/:jobId` | Active job | `200` with progress payload |
| `POST /api/video/composition-jobs/:jobId/retry` | Retryable failed job | `202` new `jobId` |

## 5A Functional Matrix

| Area | Scenario | Expected Result |
| --- | --- | --- |
| Composition init | First editor open | Baseline timeline created from Phase 4 metadata |
| Composition load | Reopen same content | Latest saved timeline restored |
| Clip trim | Trim in/out updates | Preview reflects new segment timing |
| Clip reorder | Swap shot sequence | Track order and output order updated |
| Text overlay | Add/update/delete text | Preview and persisted timeline match edits |
| Caption style | Change preset/toggle | Preview and rendered output match selected style |
| Transition presets | Set cut/crossfade/swipe | Transition behavior appears in preview and output |
| Autosave | Burst edits + idle pause | Save completes without data loss |
| Render final | Valid render request | Output playable; version history updated |
| Output fallback | Render failure path | Previous successful output remains accessible |

## 5B Precision Matrix (Feature Flag)

| Area | Scenario | Expected Result |
| --- | --- | --- |
| Multi-track timeline | Open precision tab | Track lanes visible and selectable |
| Frame scrubbing | Step playhead frame-by-frame | Timecode and preview remain synchronized |
| Split/cut | Split selected clip at playhead | Two valid segments created |
| Bring-in tool | Insert asset into track | Item inserted at intended position |
| Keyframes | Adjust audio gain keyframes | Curve persists and replays deterministically |
| Snap behavior | Drag near markers | Snap to grid/edges/beat markers as configured |
| Shortcuts | Space/S/Delete/Cmd+Z etc. | Correct actions trigger without focus traps |
| Undo/redo depth | 50+ ops undo/redo | Command stack remains consistent |

## Failure and Recovery Matrix

| Failure Type | Injection/Condition | Required Behavior |
| --- | --- | --- |
| Save conflict | Dual-tab edit | `409`; prompt reload/resolve |
| Validation failure | Overlap or invalid range | Save/render blocked with actionable issue list |
| Missing asset | Deleted/unavailable asset | Invalid item highlighted; render blocked |
| Render worker failure | Encoder/compositor error | Job failed; retry option shown |
| Polling stale job | Unknown/expired job ID | Polling stops gracefully; user action offered |
| Network interruption | Save request timeout | Dirty state retained locally; retry path visible |

## Security and Ownership Checks

- All composition and job endpoints enforce authenticated user context.
- Ownership checks block cross-tenant composition and asset access.
- Timeline payloads are schema-validated server-side.
- Asset references are ownership-validated on save and render.
- Signed URLs are never persisted as canonical composition references.

## Performance and Stability Gates

## Performance Budgets

- Editor initial load p95: < 2.5s
- Save request p95: < 800ms
- Interactive trim/drag response: target < 100ms
- Render job creation p95: < 2s
- Job status endpoint p95: < 500ms

## Stability Budgets

- Zero data-loss defects across save/load/refresh cycles
- Zero critical crashes in 30-minute continuous editing soak test
- Retry validated for at least two independent render failure classes

## Data Integrity Gates

- Timeline schema version is preserved correctly across saves.
- Rendered output version labels map to persisted composition version.
- Previous successful output remains retrievable after failed render.

## Observability Requirements

Required telemetry before launch:

- composition save success/failure counts
- validation issue histogram by error code
- render lifecycle counts (`queued`, `rendering`, `completed`, `failed`)
- render latency percentiles by duration bucket
- retry success/failure ratio

Required alerts:

- save failure rate spike
- render failure rate spike
- p95 render latency breach

## Go / No-Go Gates

Phase 5 (5A) launch is `GO` only when:

1. All 5A functional matrix scenarios pass in staging with production-like fixtures.
2. API contract tests pass including negative and conflict scenarios.
3. Save/load durability is confirmed across refresh and session return.
4. Render failure/retry flow is validated end-to-end.
5. Prior successful outputs remain available in all failure paths.
6. Security and ownership checks pass with no critical findings.
7. Monitoring dashboards and alerts are active and verified.

If any gate fails, launch is `NO-GO`.

## 5B Release Gate (Separate)

5B precision features can be enabled only when:

- 5A production stability remains within budget for two release cycles
- precision matrix scenarios pass behind feature flag
- shortcut/accessibility validation passes
- no critical timeline corruption defects remain open

## Definition of Done (Engineering)

- Contract tests cover all composition/render endpoints and key error codes.
- Integration tests cover init -> edit -> save -> validate -> render -> retry.
- UI tests cover quick-edit interactions, autosave states, and render status states.
- Documentation entry points include:
  - `docs/REEL_CREATION_TODO.md`
  - `docs/specs/index.md`
  - `docs/checklists/testing.md`

## Deferred Validation (Post-MVP)

- 5B precision behavior on high-complexity timelines
- beat-detection quality for snap-to-beat workflows
- advanced keyframe UX and edge-condition behavior
