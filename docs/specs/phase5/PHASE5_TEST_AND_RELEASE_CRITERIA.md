# Phase 5 Test and Release Criteria

Last updated: 2026-03-16
Related:
- `docs/specs/PHASE5_EDITING_SUITE_MVP.md`
- `docs/specs/PHASE5_TECHNICAL_DESIGN.md`
- `docs/specs/PHASE5_API_AND_FLOW_CONTRACTS.md`

## Release Objective

Phase 5 is releasable when users can reliably edit an assembled reel in-browser, preview key edits quickly, and render a final output without losing data or prior versions.

## Test Strategy

Testing is split into:

- 5A quick-edit function and safety
- 5B precision controls (gated release)
- rendering reliability and recovery
- performance and ownership/security guarantees

## 5A Functional Test Matrix

| Area | Scenario | Expected Result |
| --- | --- | --- |
| Composition init | First open on Phase 4 content | Composition generated from Phase 4 metadata and persisted |
| Composition load | Re-open existing edited content | Latest timeline loaded with matching version |
| Clip trim | User trims clip in/out | Preview and timeline duration update correctly |
| Clip reorder | User rearranges two clips | New order reflected in preview and persisted timeline |
| Text overlay add/edit | User adds text, updates style and timing | Overlay appears with expected style and timing |
| Caption preset | User switches caption style preset | Preview updates to selected preset |
| Caption toggle | User disables captions | Captions hidden in preview and final render |
| Transition presets | User changes transition type between clips | Preview and rendered output both honor transition type |
| Save flow | Rapid edit burst and idle autosave | Save completes; version increments without data loss |
| Render final | User clicks render on valid timeline | Async job completes with new playable asset |
| Output fallback | Render fails | Previous successful output remains available |

## 5B Precision Matrix (Feature Flag)

| Area | Scenario | Expected Result |
| --- | --- | --- |
| Multi-track timeline | User opens precision tab | Separate lanes for video/audio/text/captions visible |
| Frame scrubbing | Playhead moved frame-by-frame | Timecode and preview stay synchronized |
| Split/cut | Split clip at playhead | Clip divides into two valid segments |
| Bring-in tool | Drag new asset into track | New timeline item inserted at drop point |
| Volume keyframes | Add and edit keyframes on music track | Gain curve updates and persists |
| Snap-to-grid | Drag clip near boundaries | Item snaps to nearest grid/edge marker |
| Keyboard shortcuts | Trigger play/split/delete/undo | Correct action fires with no focus trap |
| Undo/redo depth | 50+ sequential edits then undo/redo | Stack remains stable and deterministic |

## Failure and Recovery Matrix

| Failure Type | Injection/Condition | Required Behavior |
| --- | --- | --- |
| Save conflict | Simultaneous edit in second tab | `409` returned; UI prompts refresh/resolve |
| Validation failure | Overlap/invalid timing | Save blocked with actionable issue list |
| Missing asset | Asset deleted or inaccessible | Invalid item highlighted; render blocked |
| Render worker error | Encode/composition failure | Job set failed with retry option |
| Polling stale job | Unknown/expired job id | UI exits polling gracefully with recovery action |
| Network interruption | Client loses connection during save | Local dirty state retained and retry available |

## Security and Ownership Checks

- All composition endpoints require auth and user ownership checks.
- Render endpoints reject cross-tenant composition IDs.
- Timeline payloads are schema-validated server-side.
- Signed URLs are ephemeral and not persisted in composition documents.
- Asset references are validated against user ownership at save and render.

## Performance and Stability Gates

## Performance Budgets

- Editor initial load p95: < 2.5s
- Save request p95: < 800ms
- Interactive trim/drag response: target < 100ms visual feedback
- Render job creation p95: < 2s
- Job status polling endpoint p95: < 500ms

## Stability Budgets

- No data-loss bugs in save/load cycles across refresh/session restore
- Zero critical crashes in 30-minute editing soak test
- Retry path validated for at least two independent render failure types

## Observability Requirements

Minimum telemetry before launch:

- composition save success/fail counts
- validation error histogram by code
- render job lifecycle by status
- render latency distribution by duration bucket
- retry success rate

## Go / No-Go Gates

Phase 5 launch is `GO` only when:

1. 5A quick edit scenarios all pass in staging with production-like data.
2. Composition save/load behavior is durable across refresh/session return.
3. Render failure and retry behaviors are validated.
4. Prior successful output remains available after render failure.
5. No critical ownership/auth vulnerabilities remain.
6. Monitoring and alerting are active for save and render failure spikes.

If any gate fails, launch is `NO-GO`.

## Definition of Done (Engineering)

- Endpoint contract tests cover composition and render APIs, including conflicts and validation failures.
- Integration tests cover init -> edit -> save -> render -> retry flow.
- UI tests cover quick edit interactions and status transitions.
- Documentation links are updated in:
  - `docs/REEL_CREATION_TODO.md`
  - `docs/specs/index.md`
  - `docs/checklists/todo-priorities.md` (tracking visibility)

## Deferred Validation (Post-MVP)

- 5B precision editing performance at high timeline complexity
- beat detection quality for snap-to-beat workflows
- advanced keyframe authoring UX quality and edge-case behavior
