## Red Team Report: `docs/captions`

**Artifact type:** Mixed (HLD, LLD, implementation plan, preset spec, research)
**Scope reviewed:** `docs/captions/00-background.md` through `docs/captions/05-implementation-plan.md`, focused on product/design gaps that would ship a weak caption feature
**Total findings:** 6 (🔴 1 critical · 🟠 4 high · 🟡 1 medium · 🔵 0 low · ⚪ 0 info)

---

### Findings

#### 🔴 CRITICAL Wrong transcript can render in preview while export uses a different one — `docs/captions/02-hld.md:166`

**What:** The preview path fetches captions by `assetId` (`useCaptionDoc(assetId) → GET /api/captions/:assetId`), while the clip model and export path are keyed by `captionDocId` (`CaptionClip.captionDocId`, export loads by `captionDocId`). The hook contract repeats this mismatch: `useCaptionDoc(assetId: string | null)` in `docs/captions/03-lld.md:693`.

**Why it matters:** The moment you have more than one caption doc for an asset — re-transcription, manual correction, imported subtitles, language variants — preview and export can diverge. The editor may show one transcript while FFmpeg burns in another. That is a product-trust failure, not a minor bug.

**Proof / Example:** A user auto-transcribes a voiceover, then manually fixes names by creating a second caption doc. The `CaptionClip` points to the corrected `captionDocId`, but preview still resolves by `assetId` and can return the older row. Export uses the corrected doc. User sees one thing, downloads another.

**Fix direction:** Make `captionDocId` the canonical fetch key everywhere. Add `GET /api/captions/doc/:captionDocId` or equivalent, change `useCaptionDoc` to load by `captionDocId`, and treat `assetId` only as a convenience lookup for creation/idempotency.

---

#### 🟠 HIGH No source trim/offset model, so captions break for clipped or reused audio — `docs/captions/03-lld.md:306`

**What:** `CaptionClip` only carries `startMs`, `durationMs`, `captionDocId`, `stylePresetId`, `styleOverrides`, and `groupingMs`. There is no `sourceStartMs`, `sourceEndMs`, transcript window, or asset trim offset. Yet both preview and export build pages from `doc.words` directly (`docs/captions/02-hld.md:169`, `docs/captions/02-hld.md:197`).

**Why it matters:** This assumes every caption clip always uses the full transcript from t=0. That fails for common editor behavior: trimming a voiceover, reusing the same asset twice, splitting one long recording into multiple timeline clips, or captioning only a segment.

**Proof / Example:** A 60s voiceover asset is trimmed to use only 10s–20s on the timeline. The caption clip aligns to the trimmed clip’s timeline position, but the renderer/export still consume transcript words starting at 0ms. The first 10 seconds of speech in the source asset get burned into the wrong segment.

**Fix direction:** Add source-window metadata to `CaptionClip` (`sourceStartMs`, optional `sourceEndMs` or `transcriptRange`). Both preview and export should filter/offset `CaptionDoc.words` by that range before `buildPages()`.

---

#### 🟠 HIGH There is no real correction workflow for transcription mistakes — `docs/captions/03-lld.md:547`

**What:** The API supports `POST /transcribe`, `GET /:assetId`, and `POST /manual`. The “manual” route requires fully timestamped `words[]`. The UI spec only includes `CaptionPresetPicker` and `CaptionStylePanel` with three sliders (`docs/captions/03-lld.md:746`, `docs/captions/03-lld.md:764`). There is no endpoint or UI for editing transcript text, retiming words, splitting/merging tokens, or approving Whisper output.

**Why it matters:** Auto-transcription is never clean enough to ship without correction tools. Names, product terms, slang, numbers, punctuation, and code-switching will be wrong. A caption product without fast correction becomes unusable the first time Whisper misses a key word.

**Proof / Example:** Whisper outputs “content AI” instead of “ContentAI”. The only documented escape hatch is creating a brand-new manual caption doc with raw word timings. That is not a user workflow; it is an internal data-entry format.

**Fix direction:** Add an explicit transcript editing layer: patch/update API by `captionDocId`, editable token list in the inspector, bulk text correction without losing timings, and basic operations like split token, merge tokens, retime start/end, and re-run transcription while preserving user edits when possible.

---

#### 🟠 HIGH The spec claims preview/export parity while explicitly designing non-parity presets — `docs/captions/02-hld.md:11`

**What:** The HLD says `Preview === Export` and defines `"full"` as exact parity (`docs/captions/02-hld.md:11`, `docs/captions/02-hld.md:273`). But the preset file explicitly documents lost fidelity: `dark-box` loses rounded corners (`docs/captions/04-presets.md:155`), `pop-scale` drops the defining spring entry (`docs/captions/04-presets.md:333`), `slide-up` and `fade-scale` export statically (`docs/captions/04-presets.md:408`), and `word-highlight-box` loses the box behavior entirely (`docs/captions/04-presets.md:591`).

**Why it matters:** This is a product-contract problem. Users choose caption styles based on motion and highlight behavior. If the hero effect disappears or materially changes on export, “we showed a note” is not parity; it is an intentional mismatch.

**Proof / Example:** `word-highlight-box` is sold as a moving highlighted word box, but export becomes basically a color change. That is a different style, not a simplified version.

**Fix direction:** Drop the `Preview === Export` claim from the design goals, or narrow it to “export capability is explicit.” Better: classify presets into “export-safe” and “preview-only/limited” and prevent users from selecting non-exportable looks for burn-in workflows unless they accept that downgrade.

---

#### 🟠 HIGH Auto-transcription lifecycle is underspecified and will create duplicates/stale clips — `docs/captions/02-hld.md:240`

**What:** The flow says “voiceover clip added” triggers auto-transcription, then success dispatches `ADD_CAPTION_CLIP` (`docs/captions/02-hld.md:245-257`). The implementation plan changes that trigger to “on voiceover clip selection” in `Inspector.tsx` (`docs/captions/05-implementation-plan.md:222-230`). There is no clip-level state machine for pending/success/failed/replaced, no dedupe rule per voiceover clip, and no cleanup rule when the underlying voiceover is deleted or re-recorded.

**Why it matters:** You will generate duplicate caption clips, attach stale transcript docs to updated audio, and surprise users with caption creation happening because they clicked a clip rather than explicitly requested it.

**Proof / Example:** A user selects the same voiceover twice while transcription is in progress or after a failed retry. The spec does not define whether this no-ops, creates another caption clip, reuses the existing one, or replaces it. The behavior will drift into accidental duplicates.

**Fix direction:** Model caption generation as clip-scoped state: `idle | transcribing | ready | failed | stale`. Persist a link from voiceover clip → caption clip/doc, make auto-generation idempotent per clip instance, and define replacement behavior on rerecord/trim/delete.

---

#### 🟡 MEDIUM English-only token assumptions are baked into core types and UI — `docs/captions/03-lld.md:17`

**What:** The core model is strictly `Word[]`, the grouping logic is “words per group” / `groupingMs`, layout wraps words, and the UI label is “Words per group” (`docs/captions/03-lld.md:377`, `docs/captions/03-lld.md:737`, `docs/captions/03-lld.md:777`). `CaptionDoc.language` exists (`docs/captions/03-lld.md:29`) but no behavior changes based on it.

**Why it matters:** This falls apart for CJK languages, mixed-script captions, RTL text, emoji-heavy tokens, and transcripts where “word” boundaries are not the right display unit. If international support is even a medium-term requirement, this design will force a second rewrite.

**Proof / Example:** Japanese captions do not naturally map to space-delimited words, but the entire renderer and grouping model assumes they do. The UI also exposes “words per group,” which is meaningless in those locales.

**Fix direction:** Rename the abstraction now from `Word` to `Token` or document English-only scope explicitly. If multilingual support matters, add locale-aware tokenization, bidi-aware layout, and a grouping control expressed in time/display density rather than “word count.”

---

### Summary

**Top 3 risks to address immediately:**
1. Preview fetches by `assetId` while export uses `captionDocId`, which will render/export different transcripts.
2. `CaptionClip` has no source trim/offset fields, so captions break for clipped or reused audio.
3. There is no usable transcript correction workflow; auto-transcription errors have no real product-level fix.

**Patterns observed:** The docs are strong on renderer architecture and weak on caption lifecycle/product correctness: identity/versioning, editing, clip-source mapping, and export trust are underspecified. Several “nice engine” decisions are ahead of “can a creator reliably ship captions.”

**What's actually solid:** The separation of data/grouping/layout/rendering is the right direction. Moving caption words out of composition JSON is correct. Explicitly modeling export limitations is better than silently dropping effects.
