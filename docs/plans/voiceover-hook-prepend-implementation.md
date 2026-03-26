# Voiceover hook prepend — full change inventory

**Parent spec:** Product rules and motivation live in [terminology-voiceover-captions-rename.md](./terminology-voiceover-captions-rename.md) under **Product decision: hook prepends for voiceover (TTS)**.

This document lists **every place** that must be touched, should be touched, or explicitly left alone when implementing **hook + clean script (deduped) → default TTS text** across Studio UI, chat agent, and shared logic.

---

## 1. Normative behavior (implementation must match)

| Rule | Detail |
|------|--------|
| **Order** | If both `generated_hook` and `clean_script_for_audio` are non-empty after trimming, spoken text is **`hook + "\n\n" + body`**. |
| **Body source** | Same normalization as overlay copy for the clean segment: use `extractCaptionSourceText({ cleanScriptForAudio, generatedScript: null })` from `backend/src/routes/video/utils.ts` so bracket-prefixed lines match editor/TTS expectations. |
| **Dedup** | Let `hookNorm` = whitespace-collapsed trim of hook (same idea as `normalizeCopy` in `build-initial-timeline.ts`). Let `cleanNorm` = same normalization applied to the extracted clean body string. If `cleanNorm` is empty, omit body. If `cleanNorm === hookNorm`, **omit body** (do not read hook twice). |
| **Fallbacks** | Hook only if no usable body; body only if no hook; empty if neither. |
| **Post caption** | **`generated_caption` must not** be concatenated for TTS (overlay track may still include it via `composeCaptionOverlayText` — that is separate). |
| **Sanitization before ElevenLabs** | After composing, run the same rules as `sanitizeScriptForTTS` in `backend/src/routes/audio/index.ts` (timing markers, parens, section labels, etc.). **Today the HTTP TTS route sanitizes; the chat `generate_voiceover` tool does not** — fixing that is part of this work so agent and UI path behave the same. |

---

## 2. Shared logic placement (no cross-package imports today)

Frontend and backend do **not** share a runtime package. Choose one:

- **Recommended:** Add a **pure** helper in `backend/src/shared/services/voiceover-text-for-tts.ts` (name flexible) exporting `buildVoiceoverTextForTts(input)`. Implement the **same** function in `frontend/src/features/audio/utils/build-voiceover-text-for-tts.ts` (or `frontend/src/shared/utils/…`) and keep behavior aligned via **duplicated tests** (same cases in backend + frontend unit tests), **or**
- **Alternative:** Only backend implements the builder; add `GET /api/…/default-voiceover-text` — heavier, not recommended unless you want a single source without duplication.

**Refactor opportunity (optional but good):** The hook + clean portion of `composeCaptionOverlayText` in `backend/src/routes/editor/services/build-initial-timeline.ts` duplicates the same hook/body/dedup idea (plus caption). Extracting a shared `joinHookAndCleanForDisplay(input)` used by both `composeCaptionOverlayText` and `buildVoiceoverTextForTts` reduces drift. If you do **not** refactor, `buildVoiceoverTextForTts` must still mirror `normalizeCopy` + `extractCaptionSourceText` + dedup exactly.

---

## 3. Backend — files to change

| File | Change |
|------|--------|
| **`backend/src/lib/chat-tools.ts`** | **`createGenerateVoiceoverTool`:** (1) Select **`generatedHook`** alongside `cleanScriptForAudio`. (2) Compute text with **`buildVoiceoverTextForTts`**. (3) Run **`sanitizeScriptForTTS`** on the result before `generateSpeech`. (4) If empty after sanitize, return failure (today: `no_clean_script` when clean missing — consider renaming reason to something like `no_voiceover_text` for accuracy, and update any consumer docs). (5) Update **tool `description`** string: it currently says *"Reads the draft's clean script"* — change to reflect hook + body. |
| **`backend/src/routes/audio/index.ts`** | Move **`sanitizeScriptForTTS`** to a shared module (e.g. `backend/src/shared/services/tts-script-sanitize.ts`) and **import** it here so chat-tools and the route share one implementation. Behavior of `POST /api/audio/tts` stays: accept client `text`, sanitize, generate. |
| **`backend/src/routes/editor/services/build-initial-timeline.ts`** | **Optional:** Refactor `composeCaptionOverlayText` to call shared hook+clean joiner (see §2). **Required if not refactored:** Manually verify new `buildVoiceoverTextForTts` matches hook/clean/dedup behavior of lines using `normalizeCopy` + `extractCaptionSourceText` + `parts.push` for hook/clean only. |
| **`backend/src/routes/video/utils.ts`** | **No change required** if `buildVoiceoverTextForTts` **imports** `extractCaptionSourceText` from here. If you add a shared joiner, it may live next to this file or call into it. |

---

## 4. Frontend — files to change

| File | Change |
|------|--------|
| **`frontend/src/features/audio/components/VoiceoverGenerator.tsx`** | Remove **`ScriptMode`** and the **Script / Hook** tab UI. Seed the textarea from **`buildVoiceoverTextForTts({ generatedHook, cleanScriptForAudio })`** (local util). Keep **user editability** and **Reset** to re-seed from canonical composed text. Update **`usingHookFallback`**: still show when only hook exists (no body). Remove dependency on mutually exclusive `canonical` branches tied to `mode`. |
| **`frontend/src/features/audio/components/AudioPanel.tsx`** | Pass **`cleanScriptForAudio`** and **`generatedHook`** into `VoiceoverGenerator` (already available). Rename prop **`generatedScript`** → e.g. **`cleanScriptForAudio`** when you touch this file (optional naming cleanup; can be a follow-up). |
| **`frontend/src/features/chat/components/ContentWorkspace.tsx`** | Only if **`VoiceoverGenerator` / `AudioPanel` props** change — update pass-through (**currently** just `generatedContentId`; no change unless you alter `AudioPanel` API). |
| **`frontend/src/translations/en.json`** | Remove or stop using **`audio_generate_mode_script`** and **`audio_generate_mode_hook`** if tabs are removed. Adjust **`audio_generate_script_label`** / subtitle / placeholder if copy still says “script vs hook”. Review **`audio_generate_hook_fallback`** — still valid when only hook exists. |
| **`frontend/src/features/audio/utils/build-voiceover-text-for-tts.ts`** | **New file** — implement mirror of backend pure function (and export for tests). |

**Types:** `frontend/src/features/audio/types/audio.types.ts` — **no signature change** for `GenerateVoiceoverRequest` (`text` remains user-supplied string); optional JSDoc that default textarea follows hook+body compose.

---

## 5. Tests to add or update

| Location | Action |
|----------|--------|
| **`backend/__tests__/unit/shared/voiceover-text-for-tts.test.ts`** (new path suggested) | Cases: hook only; body only; hook + body; **dedup** when body equals hook (normalized); body empty after extract; whitespace variants; **does not** include post caption. |
| **`frontend/__tests__/unit/features/audio/build-voiceover-text-for-tts.test.ts`** (new) | **Same cases** as backend to prevent drift. |
| **`backend/__tests__/unit/routes/editor/build-initial-timeline-caption-compose.test.ts`** | If you refactor `composeCaptionOverlayText`, run tests; add a case if behavior edge cases were only covered indirectly. |
| **`VoiceoverGenerator` / `AudioPanel`** | **No existing tests** in repo grep — optional RTL tests for seeded text and absence of hook-only tab. |

**Integration:** No existing `POST /api/audio/tts` or `generate_voiceover` tests found — optional add later.

---

## 6. Docs and prompts to update

| Document | Change |
|----------|--------|
| **`docs/plans/terminology-voiceover-captions-rename.md`** | After shipping: update §1 fact check and Phase 0 checkboxes; point here for inventory. |
| **`docs/architecture/domain/audio-tts-system.md`** | Describe default spoken text as **hook + clean body (deduped)**; note chat agent uses same composition + sanitization; fix **`reel_asset`** wording if schema is `content_assets` in reality. |
| **`docs/specs/chat-reel-guidance.md`** | Pipeline step 2 and **`generate_voiceover`** section: not “clean script only”; document **hook + clean**, dedup, and updated failure reason if renamed. |
| **`backend/src/prompts/chat-generate.txt`** | Lines that say **`generate_voiceover`** uses “clean script” only → **hook + spoken body** (clean script field). |
| **`backend/CLEAN_SCRIPT_IMPLEMENTATION.md`** | AudioPanel / TTS description: update to hook-prepend behavior. |

**Stale / informational only (update if you touch them):**

| Document | Note |
|----------|------|
| **`docs/architecture/user-journey/05-audio.md`** | Sequence diagram references **`POST /api/audio/generate-voiceover`** — actual route is **`POST /api/audio/tts`**. Fix when editing. |
| **`docs/pm-product-spec.md`** | Mentions voiceover script / chat — align wording only if product copy references “clean only”. |

---

## 7. Explicitly out of scope (no change for hook prepend)

These reference `cleanScriptForAudio` / `generatedHook` for **other** features; behavior should remain unless you intentionally align copy elsewhere.

| Area | Files (representative) | Why |
|------|------------------------|-----|
| DB schema | `backend/src/infrastructure/database/drizzle/schema.ts`, migrations | Column rename is Phase 3 of terminology plan, not this feature. |
| Queue / list / duplicate | `backend/src/routes/queue/index.ts`, `frontend/src/routes/studio/queue.tsx` | Display and duplication of fields; VO text composition is unchanged. |
| Video generation / assembly | `backend/src/routes/video/index.ts`, export pipeline | Uses assets + scripts for video, not default TTS compose. |
| Chat context string | `backend/src/routes/chat/index.ts` (~843–853) | Injects hook, caption, script excerpt; does not drive TTS. Optional future: add clean script line for model visibility. |
| Editor types / captions from VO | `EditorLayout`, `MediaPanel`, `use-caption-preview`, `editor/captions.ts` | Transcription from existing MP3; independent of default TTS textarea. |
| `composeCaptionOverlayText` consumers | `build-initial-timeline.ts` | Still includes **post caption** for overlay; only hook+clean alignment is shared logic. |
| Content generator / save_content | `backend/src/services/reels/content-generator.ts`, `chat-tools` save/edit | Still produce hook + clean fields separately. |
| E2E | `e2e/` | No matches for voiceover/TTS; nothing to update unless you add coverage. |
| **`backend/scripts/seed-voice-previews.ts`** | Static preview phrases | Unrelated. |

---

## 8. API and tool contracts

| Surface | Change? |
|---------|---------|
| **`POST /api/audio/tts`** | **No** JSON schema change. Client continues to send final `text`. Studio will default the textarea to composed hook+body. |
| **`generate_voiceover` tool** | **Behavior change** only (input schema unchanged). Document new composition + optional new `reason` string if you rename `no_clean_script`. |
| **Frontend mutation** | `useGenerateVoiceover` / `GenerateVoiceoverRequest` — **unchanged**. |

---

## 9. Pre-implementation consistency issues (fix alongside)

1. **`createGenerateVoiceoverTool`** calls `generateSpeech` with **raw** `cleanScriptForAudio` — **no** `sanitizeScriptForTTS`. HTTP route **does** sanitize. Align by shared sanitize module.
2. **Tool description** in `chat-tools.ts` and **`chat-generate.txt`** are wrong vs intended product (hook + body).
3. **`composeCaptionOverlayText`** is the closest canonical reference for hook/clean dedup today — tests in `build-initial-timeline-caption-compose.test.ts` encode expected behavior for overlay; mirror those cases for TTS compose **excluding** caption third block.

---

## 10. Checklist summary (implementer)

- [ ] Add `buildVoiceoverTextForTts` (+ tests) backend.
- [ ] Add mirror util (+ tests) frontend.
- [ ] Extract `sanitizeScriptForTTS` to shared; use in `audio/index.ts` + `createGenerateVoiceoverTool`.
- [ ] Update `createGenerateVoiceoverTool` select, compose, sanitize, errors, description.
- [ ] Refactor `VoiceoverGenerator` UI; update `en.json` keys.
- [ ] Optional: dedupe `composeCaptionOverlayText` with shared hook+clean helper.
- [ ] Update architecture + spec + prompt + `CLEAN_SCRIPT_IMPLEMENTATION.md`.
- [ ] Update parent terminology plan §1 / Phase 0 after merge.

---

## 11. Changelog

| Date | Author | Note |
|------|--------|------|
| 2026-03-24 | — | Initial inventory from full-repo grep (`cleanScriptForAudio`, `generatedHook`, `voiceover`, `tts`, `VoiceoverGenerator`, chat tools, docs). |
