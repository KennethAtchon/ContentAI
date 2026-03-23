# Review: Editor as Production Core

**Date:** 2026-03-22
**Reviewers:** Product Manager · Red Team
**Plan status:** Design complete — pending resolution of issues below before implementation begins

---

## PM Assessment

### 1. Problem Diagnosis — Sound

The diagnosis is accurate and confirmed against the codebase:

- `buildInitialTimeline` only queries `content_assets` for existing clips. When the editor is auto-created immediately after text generation (no clips yet), the video track is empty. Users see nothing.
- `runAssembleFromExistingClips` runs a full assembly pipeline outside the editor and is called from **two sites**: `runReelGeneration` (line 1450) and `chat-tools.ts` (line 1313 via `setTimeout`). The plan only mentions the first.
- The solution — retire auto-assembly, make the editor the single production path — is the right call. No reasonable argument exists for keeping two parallel assembly systems.

**Verdict: Core direction is correct. Proceed.**

---

### 2. Phase Sequencing — Inconsistent Across Documents

The three documents disagree on what goes in which phase:

| Phase | README | Context Doc | LLD |
|---|---|---|---|
| 1 | Schema + placeholders | Fix what's broken (no schema) | Schema + core services |
| 2 | Clip gen → timeline, assembly deleted | Decouple clip gen | Decouple clip gen |
| 3 | Editor UI + polling + button rename | Schema + autoTitle + queue | Editor UI |
| 4 | Queue stages | — | Queue stages |

**This must be reconciled before implementation starts.** The LLD's build sequence is the most logical. The recommended canonical order is:

1. Schema + backend services (`autoTitle`, placeholder generation, `refreshEditorTimeline`)
2. Backend decoupling (`runReelGeneration` calls `refreshEditorTimeline` — **do not delete old code yet**)
3. Editor UI (placeholder rendering, polling, button rename)
4. Delete old assembly code + update queue stages (only after the new path is verified end-to-end)

The old assembly path should remain as a fallback until Phase 3 is shipped and tested. Deleting it in Phase 2 creates a window where clips generate but go nowhere visible in the UI.

---

### 3. UX Assessment — Strong Improvement, Three Risks

**This is a major UX improvement.** The current experience — empty editor, assembled video appearing as source media, two disconnected paths — is broken. The new flow is coherent.

**UX Risk 1: Friction increase for "just make me a video" users.**
The old flow: click "Generate Reel" → get a finished video. The new flow: generate clips → open editor → click export → wait. For users who don't want to edit, two mandatory steps have been added with no creative value. There is no "quick export" or "auto-export" option for these users.

→ *Recommendation:* Add a "Generate and Export" button as a fast-follow. Not a blocker for MVP, but must be timeboxed and planned.

**UX Risk 2: Placeholder loading state is underspecified.**
The open question in the HLD — "how does the user know which placeholders are loading?" — is marked as a UX concern but left unresolved. Without per-placeholder status (Queued / Generating / Failed), users cannot tell if generation is progressing or stuck. The existing `use-video-job.ts` already polls per-shot progress — wire that into the placeholder UI before shipping.

→ *Recommendation:* This is required UX, not a nice-to-have. Do not ship placeholder slots without per-slot status states.

**UX Risk 3: Script iteration silently wipes the timeline.**
When `iterate_content` runs, the editor rebuilds with new placeholders and discards existing clips. This is architecturally correct but will surprise users who expected to keep clips from the previous version. No confirmation dialog or undo is described.

→ *Recommendation:* Show a confirmation before rebuilding: "Updating the script will reset your clips to placeholders for the new shot layout. Your previous clips remain in the version history."

---

### 4. Versioning Rules — Correct, One Code/Prose Mismatch

The versioning boundary (text changes = new version, asset changes = in-place) is correct and well-reasoned. It maps to how users understand "I changed what I'm saying" vs. "I changed how it looks."

**One mismatch:** The prose says `iterate_content` should only be called for "meaningful" changes and that "tweaks to punctuation or minor wording do not warrant a version." But the `shouldCreateNewVersion` function in LLD §15 does strict equality — any string difference creates a version.

→ *Recommendation:* Keep the strict equality check. Do not implement "meaningful change" detection — it will produce confusing behavior. Accept that minor text changes create new versions and make version iteration cheap (which this plan already achieves). The prose should be updated to reflect the actual implementation rule.

---

### 5. Scope Assessment — Right-Sized, One Missing Item

The scope is appropriate. It does not over-reach into captions, effects, or the export pipeline. The AI Assembly audio/text track fix is orthogonal but not on the critical path — do not let it block rollout.

**Missing from scope:** The `assemble_video` chat tool in `chat-tools.ts` (line 1308–1313) directly calls `runAssembleFromExistingClips` via `setTimeout`. The plan deletes the function but does not mention this call site. If an active chat session invokes this tool after deployment, it will crash.

→ *Required:* Add "remove or rewire the `assemble_video` chat tool" to Phase 2 scope.

---

### 6. Implementation Risks (PM View)

| Risk | Severity | Status in Plan |
|---|---|---|
| Race condition in `refreshEditorTimeline` | Critical | Dismissed as "acceptable" — it is not |
| `assemble_video` chat tool calls deleted function | High | Not mentioned |
| Existing users' in-progress content stranded at publish gate | High | Deferred to "one-time script later" |
| Editor auto-save conflicts with server-side track updates | Medium | Mentioned but merge logic unspecified |
| Polling performance (3s × 180 requests for 6-shot generation) | Medium | No back-off planned |

---

## Red Team Report

**Artifact type:** Mixed — Architecture plan (HLD + LLD + spec)
**Total findings:** 18 (🔴 3 critical · 🟠 5 high · 🟡 6 medium · 🔵 2 low · ⚪ 2 info)

---

### 🔴 CRITICAL — `refreshEditorTimeline` concurrent writes corrupt track state — `LLD.md §2`

**What:** The LLD acknowledges concurrent calls and dismisses the race as "last write wins — acceptable since both are deterministic from the same `content_assets` rows." This is wrong.

The function reads `edit_projects.tracks`, mutates it in-memory (`mergePlaceholdersWithRealClips`), then writes back. If two shots finish nearly simultaneously, both calls read the same stale `tracks` before either has written. Each applies only its own replacement and writes back. The second write overwrites the first shot's replacement — that shot reverts to a placeholder.

**Failure scenario:** Two shots finish at t=0ms and t=100ms. Both read `tracks` at t=50ms. Shot A writes at t=150ms (placeholder-0 → real clip). Shot B writes at t=200ms (placeholder-1 → real clip, but using stale read that still has placeholder-0). Final state: placeholder-0 is back. User sees a clip that appeared then disappeared.

**Fix direction:** Use `SELECT ... FOR UPDATE` inside a transaction around the read-modify-write, or use a PostgreSQL `jsonb_set` atomic update that patches only the specific placeholder slot without a full read-modify-write cycle.

---

### 🔴 CRITICAL — Deleting `runAssembleFromExistingClips` breaks existing users with no migration — `LLD.md §9`

**What:** Every user who has previously used "Generate Reel" has an `assembled_video` in `content_assets` but no `export_job`. After this deployment, the queue's publish gate requires a completed `export_job`. Their content is unpublishable with no UI path to fix it.

The plan notes this briefly ("can be cleaned up with a one-time data migration script later") but does not include the migration or specify when it runs.

**Fix direction:** Before deleting the old assembly path, run a data migration that creates synthetic `export_job` rows (status=done) for all existing `assembled_video` content assets. Or provide a one-time "re-export from existing clips" path in the UI. The plan must specify this before Phase 2 ships.

---

### 🔴 CRITICAL — `parseScriptShots` returning empty array leaves timeline empty — `LLD.md §3`

**What:** If `generatedScript` exists but `parseScriptShots` returns `[]` (malformed AI output, unexpected format), the placeholder clips array is empty. `buildInitialTimeline` silently produces a timeline with no video track clips — the same broken state as today, with no error surfaced.

**Fix direction:** After calling `parseScriptShots`, add a guard: if `shots.length === 0` and `generatedScript` is non-null, fall back to at least one placeholder using the hook text. Log a warning. Also add a test that verifies `parseScriptShots` handles every AI output format currently in production.

---

### 🟠 HIGH — `MERGE_TRACKS_FROM_SERVER` will overwrite user trim and volume edits — `LLD.md §11`

**What:** The reducer is specified to "not touch clips the user has manually edited." But the spec does not define how to distinguish a user-edited clip from a server-provided one. The 3-second poll fires every 3 seconds while any placeholder exists. If a user is trimming a clip when the poll fires and the reducer doesn't protect locally-modified clips, their edit is reset.

**Fix direction:** The reducer must track which clips have been locally modified (e.g., a `locallyModified: true` flag set by any edit dispatch) and never overwrite those clips from server data. This must be specified precisely before implementation.

---

### 🟠 HIGH — `refreshEditorTimeline` fire-and-forget has no user-facing error path — `LLD.md §6`

**What:**
```typescript
await refreshEditorTimeline(generatedContentId, userId).catch(() => {});
```
If this consistently fails (DB overload, lock timeout), the user sees placeholders forever with no explanation. The clip generation succeeds — the user knows clips were made — but nothing updates in the editor. This is worse UX than the current broken state.

**Fix direction:** Store a `timelineRefreshError` flag in the Redis job record when `refreshEditorTimeline` fails. The frontend can surface a "Refresh editor" button as a fallback. At minimum, log the error with enough context to diagnose. Do not swallow it silently.

---

### 🟠 HIGH — Queue "Editor Ready" stage permanently blocked on partial clip generation failure — `LLD.md §13`

**What:** The new "Editor Ready" stage requires no placeholder clips remaining in `edit_projects.tracks`. If clip generation fails for one of six shots, that placeholder persists indefinitely. The stage is stuck. The plan's edge case says "user can manually add a clip to that slot" — but no UI for this is described, and the placeholder's `isPlaceholder: true` flag wouldn't be cleared by any current mechanism.

**Fix direction:** Define a recovery path: (a) a "Replace slot" UI that lets the user upload or pick a clip for a specific placeholder, setting `isPlaceholder: false`; (b) a `placeholderStatus` field (`pending | failed | skipped`) so the queue stage can ignore `failed/skipped` placeholders.

---

### 🟠 HIGH — `refreshEditorTimeline` chain root lookup fails for iterated content — `LLD.md §2`

**What:** `refreshEditorTimeline` finds the editor project by querying `WHERE generatedContentId = chainRootId`. But when `iterate_content` creates v2, the editor project is updated: `SET generatedContentId = v2.id`. After this, the project stores v2's ID — not the chain root (v1). So `refreshEditorTimeline(v2.id, userId)` resolves `chainRootId = v1.id`, queries `WHERE generatedContentId = v1.id`, finds nothing, and returns early silently.

After any content iteration, placeholders never fill in. This is the core user flow for anyone who iterates on their script.

**Fix direction:** Either query across the full chain (`WHERE generatedContentId IN (v1, v2, ...)`) or add a stable `chainRootContentId` column to `edit_projects` and query by that.

---

### 🟠 HIGH — 3-second polling creates 60–180 unthrottled requests per generation session — `LLD.md §11`

**What:** `refetchInterval: hasPlaceholders ? 3000 : false`. At 30+ seconds per shot, a 6-shot generation takes 3–5 minutes — that's 60–100 GET requests per user per generation. At 50 concurrent users, this is 3,000–5,000 requests/minute to the editor endpoint with no back-off and no caching (tracks change on every clip arrival).

**Fix direction:** Implement exponential back-off (start 2s, cap 15s). Better: use the existing Redis job polling mechanism that already tracks per-shot progress — wire that into the placeholder UI instead of a separate editor poll.

---

### 🟡 MEDIUM — `autoTitle` permanently lost on PATCH even when title is unchanged — `LLD.md §5`

**What:**
```typescript
if (body.title !== undefined) {
  updates.title = body.title;
  updates.autoTitle = false; // set unconditionally
}
```
If the user clicks rename and confirms without changing anything (or sends the same text), `autoTitle` is set to `false` permanently. Auto-title behavior is lost even though the user made no meaningful change.

**Fix direction:** Only set `autoTitle = false` when `body.title !== existingProject.title`.

---

### 🟡 MEDIUM — Voiceover regeneration produces duplicate audio clips on the timeline — `LLD.md §2`

**What:** When voiceover is regenerated, the old `content_asset` is deleted and a new one inserted. `refreshEditorTimeline` loads assets and finds `hasVoiceover = false` (new ID). It appends a new voiceover clip. But the old voiceover clip is still in `edit_projects.tracks` from the previous refresh — it has the old `assetId`. Now the audio track has two voiceover clips. The ffmpeg export mixes both.

Music replacement has the identical bug.

**Fix direction:** Instead of checking `hasVoiceover` by ID, replace the audio track's clips entirely with the current voiceover (wipe and replace). Or filter out any clips whose `assetId` is not in the current `content_assets` list before upserting.

---

### 🟡 MEDIUM — Phase 2 can ship without Phase 3 UI, leaving users with invisible placeholders — `README.md`

**What:** The README lists Phase 2 (auto-assembly deleted) and Phase 3 (placeholder UI) as separate phases. If Phase 2 ships first, clip generation produces clips that go to the DB but the editor shows nothing meaningful — placeholders without the spinner or label UI, indistinguishable from an empty timeline.

**Fix direction:** Phase 2 (decouple) and Phase 3 (placeholder UI) must ship atomically. The LLD build sequence correctly groups this; the README phase table is misleading and should be corrected.

---

### 🟡 MEDIUM — No test plan for any of the 16 build steps — `LLD.md §Build Sequence`

**What:** 16 implementation steps are specified across 4 phases. No acceptance criteria, test cases, or verification steps are defined. The plan touches the core production pipeline — `runReelGeneration`, `buildInitialTimeline`, `deriveStages` — all of which likely have existing tests that will need to be updated or replaced.

**Fix direction:** Add per-phase acceptance criteria: what automated tests must pass, what manual verification confirms correctness before the next phase begins.

---

### 🟡 MEDIUM — `MERGE_TRACKS_FROM_SERVER` reducer algorithm underspecified — `LLD.md §11`

**What:** The spec says the reducer "replaces placeholder clips where a real asset now exists" but does not specify the matching key. If a developer implements it as "replace the Nth clip in the array with the Nth real clip" instead of matching by `placeholderShotIndex`, user reorders break the replacement logic.

**Fix direction:** The LLD must specify the reducer algorithm explicitly: match by `placeholderShotIndex`, not by array position.

---

### 🟡 MEDIUM — Music replacement has same duplicate-clip bug as voiceover — `LLD.md §2`

Same root cause and fix as the voiceover duplicate issue above.

---

### 🔵 LOW — `autoTitle` migration sets existing manually-titled projects to `autoTitle = true` — `LLD.md §1a`

**What:** Adding `autoTitle BOOLEAN NOT NULL DEFAULT true` fills all existing rows with `true`. Projects where users have already set a custom title will have their title overwritten on the next content iteration.

**Fix direction:** The migration should set `autoTitle = false` for existing projects where the title does not match the content's `generatedHook`.

---

### 🔵 LOW — `parseScriptShots` imported across route boundaries — `LLD.md §3`

**What:**
```typescript
import { parseScriptShots } from "../../video/services/parse-script-shots";
```
This cross-route dependency means any rename or move of `parse-script-shots` silently breaks `buildInitialTimeline`.

**Fix direction:** Move `parseScriptShots` to `src/shared/services/` since it is now used by both the editor and video routes.

---

### ⚪ INFO — `assemble_video` chat tool calls the function being deleted — `chat-tools.ts:1308`

**What:** The `assemble_video` tool in `chat-tools.ts` calls `runAssembleFromExistingClips` via `setTimeout`. The plan deletes this function in Phase 2 but does not mention this call site. After deployment, any active chat session that invokes the tool crashes.

This was also flagged by the PM review. It must be added to Phase 2 scope explicitly.

---

### ⚪ INFO — No path for "quick generate and publish" users

**What:** The plan removes the fastest path from AI-generated content to a finished video. Users who previously clicked "Generate Reel" and got a publishable video now must open the editor, do nothing, and click Export. This is a deliberate product decision — but there is no acknowledgment of the trade-off or a planned mitigation for this user segment.

---

### Red Team Summary

**Top 3 risks to address before implementation:**

1. **`refreshEditorTimeline` race condition** — concurrent shot completions corrupt track state in normal operation. The "last write wins" dismissal is incorrect. Needs a row-level lock or atomic JSON patch before any code is written.

2. **Chain root lookup failure for iterated content** — after `iterate_content`, `refreshEditorTimeline` silently no-ops for all iterated content. Placeholders never fill in for the core user flow. The HLD's versioning model and the lookup logic are fundamentally inconsistent.

3. **No data migration for existing assembled_video users** — deleting `runAssembleFromExistingClips` without migrating existing data strands every current user at the queue publish gate.

**Patterns observed:** The plan consistently defers hard problems as "acceptable," "can be done later," or "user can manually fix." The three most critical issues share this pattern. The plan would benefit from a migration strategy document and a rollback plan before Phase 2 ships.

**What's genuinely solid:** The versioning boundary design is correct and clearly articulated. `placeholderShotIndex` as a stable identifier surviving user reorders is the right design. The decision to retire the dual pipeline is unambiguously correct — the current state is broken and this plan fixes it at the right level.

---

## Consolidated Required Actions Before Implementation

| Priority | Action | Owner |
|---|---|---|
| 🔴 Must fix | Add row-level lock or atomic JSON update to `refreshEditorTimeline` | Backend |
| 🔴 Must fix | Add data migration for existing `assembled_video` users | Backend |
| 🔴 Must fix | Guard `buildInitialTimeline` against empty `parseScriptShots` result | Backend |
| 🟠 Must fix | Fix `resolveChainRoot` lookup — fails for v2+ content | Backend |
| 🟠 Must fix | Add `assemble_video` chat tool removal/rewire to Phase 2 scope | Backend |
| 🟠 Must fix | Fix voiceover + music duplicate clip bug in `mergePlaceholdersWithRealClips` | Backend |
| 🟠 Must specify | Define `MERGE_TRACKS_FROM_SERVER` reducer algorithm precisely (match by `placeholderShotIndex`) | Frontend |
| 🟠 Must specify | Define per-placeholder loading states (Queued / Generating / Failed) before building the UI | Frontend |
| 🟡 Must do | Reconcile phase definitions across README, context doc, and LLD | Both |
| 🟡 Must do | Ensure Phase 2 and Phase 3 (UI) ship atomically | Both |
| 🟡 Must do | Add per-phase acceptance criteria and test plan | Both |
| 🟡 Should fix | Fix `autoTitle = false` set unconditionally on PATCH | Backend |
| 🟡 Should fix | Fix `autoTitle` migration default for existing projects | Backend |
| 🟡 Should do | Move `parseScriptShots` to `src/shared/services/` | Backend |
| 🟡 Should do | Add confirmation dialog before timeline rebuild on script iteration | Frontend |
| 🔵 Plan for | Add "Generate and Export" quick path for non-editor users (fast-follow, not MVP blocker) | Both |
