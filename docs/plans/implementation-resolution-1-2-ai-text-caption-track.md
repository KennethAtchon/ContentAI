# Implementation resolution: §1.2 — AI text on video track → Caption track

**Spec:** [pm-product-spec.md](../pm-product-spec.md) — Section 1.2 *AI-Generated Text Landing in the Video Track*  
**Related:** Section 2.3 *Tab rename: "Text" → "Caption"* (can ship in the same PR or immediately after)

---

## Principle: script is for AI generation only, not for the editor

**`generated_script`** exists so the **video generation pipeline** (e.g. `runReelGeneration` + `parseScriptShots`) knows what to ask providers to render. It is **not** editor data.

The **manual editor** should not depend on `generated_script` at all. Its timeline should come from:

- **What is actually on the reel** — rows in **`content_assets`** / **`assets`** (video clips, voiceover, music), with order and duration from those records and metadata (e.g. `shotIndex`).
- **Caption / on-screen copy** — **`generated_caption`** (and later any structured caption fields), placed on the **text** track.

Treating script lines as editor clips was the wrong boundary: it drags AI prose (including mistaken “text overlay” lines) onto the **video** track and duplicates intent that already lives elsewhere.

---

## Problem (summary)

Today **`buildInitialTimeline`** reads **`generated_script`**, parses “shots,” and builds **video** placeholders / labels from that text. Caption lives in **`generated_caption`** but is **ignored**, so the text track stays empty and script-derived blobs can show up as video clip names.

---

## Root cause

| What happens | Why it’s wrong |
|----------------|----------------|
| Editor bootstrap uses **`parseScriptShots(generated_script)`** | Couples the **editor** to an **AI authoring** artifact. |
| Every parsed line becomes a **video** slot | Video track should reflect **assets**, not script lines. |
| **`generated_caption`** unused in timeline | Caption never becomes a text-track clip. |

---

## Target behavior

| Concern | Source of truth |
|---------|-----------------|
| **Video track** | **`content_assets`** (role `video_clip`) + **`assets`** — build clips with real `assetId`, duration, ordering (e.g. `shotIndex`). Placeholders, if any, should follow **job / asset state**, not script parsing. |
| **Audio / music** | Same — linked assets, existing merge helpers where appropriate. |
| **Caption / text track** | Composed **`generated_hook`** + **`clean_script_for_audio`** (natural “clean” copy, not timestamped script) + **`generated_caption`** → one clip with **`textContent`**, timing spanning the timeline. |
| **`generated_script`** | **Video job + AI only** — out of **`buildInitialTimeline`** entirely once refactored. |
| **Inspector** | Video clips are real media; text selections use caption/text fields. |

---

## Recommended implementation direction

### 1. Refactor `buildInitialTimeline` off `generated_script`

In `backend/src/routes/editor/services/build-initial-timeline.ts`:

- **Stop** using `parseScriptShots` / **`generated_script`** to create the video row.
- **Do** load linked **`content_assets`** + **`assets`** (already partially there) and construct the **video** track from **actual video clips** (and only use placeholders when product explicitly needs “pending shot” UX — e.g. driven by job progress or a count from the server, **not** from script lines).
- **Do** select **`generated_caption`** and, when non-empty, append **text**-track clip(s) with **`textContent`**, `assetId: null`, `durationMs` aligned to timeline span (same caps as today).

`mergePlaceholdersWithRealClips` may shrink or disappear on the video side if there are no script-derived placeholders; **refresh** flow during generation may need a clear rule: either placeholders from job state, or timeline updates only when assets land (already partially true via `refreshEditorTimeline`).

### 2. Keep `generated_script` in the video pipeline only

**`runReelGeneration`** (and any shot regen path) continues to use **`parseScriptShots(content.generatedScript)`** — that stays the AI side. No requirement that the editor read the same field.

### 3. Optional same-PR: rename “Text” → “Caption” in the UI

Per spec §2.3: track `name`, media tab, i18n. Internal JSON type can stay `"text"`.

---

## Files likely touched

| Area | File(s) |
|------|---------|
| Initial timeline | `build-initial-timeline.ts` — remove script-driven video clips; asset-driven video + `generatedCaption` on text track |
| Merge / refresh | `refresh-editor-timeline.ts` — align with fewer or no script-born placeholders if model changes |
| Video jobs | `video/index.ts` — unchanged for *reading* script; ensure completion + `refreshEditorTimeline` still produce a timeline the editor can open without re-parsing script |
| Tests | Replace or add tests that assert **no** `generated_script` in `buildInitialTimeline` query path; caption + asset-based video |
| Docs | Clean-script / orchestrator docs: script = generation input only, not editor schema |

---

## Testing checklist

1. **Unit / integration:** `buildInitialTimeline` builds video from **linked video assets**; text track from **`generated_caption`** when set.
2. **Manual:** After generate reel, editor shows **only real video clips** on the video track (no script line as clip name); caption on text track when caption exists.
3. **Regression:** `runReelGeneration` still parses **`generated_script`** and creates the expected number of **video** assets.

---

## Risks and mitigations

| Risk | Mitigation |
|------|------------|
| **User opens editor before any clip exists** | Define UX: empty video track, single “generating” placeholder from job API, or block open until first asset — **not** script placeholders. |
| **Existing projects built from old script-based timeline** | One load may still have old JSON; optional migration or “rebuild from assets” action. |

---

## Definition of done

- [x] **`buildInitialTimeline` does not read `generated_script`** for timeline construction.
- [x] Video row is driven by **assets** (and agreed placeholder rules), not parsed script.
- [x] **`generated_caption`** produces **text**-track clip(s) with **`textContent`** when non-empty.
- [x] **`generated_script`** remains used only by **AI video generation** paths.
- [x] Tests updated for the new contract.
- [x] (If in scope) “Text” → “Caption” in UI via i18n.

---

## Out of scope (defer to spec §1.3 / §2)

- Shot ordering / stacking fixes (§1.3).
- Full caption theme tiles / Whisper auto-caption (§2.x).
- Rich timed caption structure beyond `generated_caption` string.
