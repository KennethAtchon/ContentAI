# Terminology cleanup: voiceover script vs post caption vs on-screen text

Phased rename plan. Goal: stop overloading **caption**, align names with what each field **actually does**, and keep one source of truth for **what is spoken** in TTS.

---

## Product decision: hook prepends for voiceover (TTS)

**Intended behavior:** Spoken voiceover should be **opening hook first**, then the **body** (`clean_script_for_audio`), not an either/or choice.

- **Compose order:** `hook` + blank line + `clean_script_for_audio` when both exist.
- **Dedup:** If the body is only a repeat of the hook (same meaning as today’s overlay logic: normalized hook equals normalized body), **omit the second block** so TTS does not say the hook twice.
- **Fallbacks:** Hook only if no body; body only if no hook.
- **Do not** include **post caption** (`generated_caption`) in TTS unless the product explicitly adds that later — that field is for the platform post, not narration.

**Why the current audio UI feels wrong:** `VoiceoverGenerator` uses **Script / Hook** tabs as **mutually exclusive** sources. That forces creators to pick one line or the rest, which does not match how reels are written (hook + continuation). Implementation should drop that pattern in favor of a **single** editable script seeded with **hook + body** (after dedup), still letting users edit before generate.

**Shared builder:** One function (e.g. `buildVoiceoverTextForTts({ hook, cleanScriptForAudio })`) should back **Studio audio UI** default text, **`generate_voiceover` chat tool**, and docs — same rules as above.

**Full implementation inventory (every file, tests, docs, out-of-scope):** [voiceover-hook-prepend-implementation.md](./voiceover-hook-prepend-implementation.md).

---

## 1. Fact check: how voiceover (TTS) is produced today

### 1.1 `POST /api/audio/tts` (primary user-facing path)

- The client sends **`text`** in the JSON body (plus `generatedContentId`, `voiceId`, `speed`).
- The server runs `sanitizeScriptForTTS(text)` then calls ElevenLabs with that string.
- **The API does not load `hook` or `clean_script_for_audio` from the database** for TTS; it only uses the **`text` the client submitted**.

**Code:** `backend/src/routes/audio/index.ts` — `ttsRequestSchema` includes `text`; `spokenText = sanitizeScriptForTTS(text)`.

### 1.2 Studio audio UI (`AudioPanel` → `VoiceoverGenerator`)

- `AudioPanel` passes **`cleanScriptForAudio`** into `VoiceoverGenerator` under the prop name **`generatedScript`** (misleading name today).
- Default mode is **“script”**: the editable textarea is seeded with **`cleanScriptForAudio`** (falling back to hook only if clean script is empty).
- If both hook and clean script exist, the user can switch to **“hook”** mode and generate from **hook only**.
- **There is no automatic “hook + clean_script” merge** for a single TTS request. Whatever is in the textarea (after user edits) is what gets sent as `text`.

**Code:** `frontend/src/features/audio/components/AudioPanel.tsx`, `frontend/src/features/audio/components/VoiceoverGenerator.tsx`.

### 1.3 Chat agent tool `generate_voiceover` (automated path)

- Loads **`cleanScriptForAudio`** from `generated_content` only.
- If it is missing or whitespace, returns **`no_clean_script`** — **hook is not concatenated or used**.

**Code:** `backend/src/lib/chat-tools.ts` (`createGenerateVoiceoverTool`).

### 1.4 Where hook **does** meet clean script (not TTS)

- **`composeCaptionOverlayText`** in `backend/src/routes/editor/services/build-initial-timeline.ts` composes **on-screen overlay copy** from:
  - `generatedHook`
  - `cleanScriptForAudio` (skipped if identical to hook)
  - `generatedCaption` (post-style caption)
- That composition is for the **editor caption / overlay track**, **not** for ElevenLabs input unless the user manually mirrors it in the VO textarea.

### 1.5 Bottom line (today vs target)

| Question | **Today (code)** | **Target (product decision above)** |
|----------|------------------|-------------------------------------|
| Hook + body for one TTS run? | **No** — UI is either/or tabs; agent uses **clean only**. | **Yes** — hook prepends body with dedup. |
| What is the “body” field? | **`clean_script_for_audio`**. | Same field; rename to **`voiceover_script`** in Phase 3 if desired. |
| Post caption in TTS? | **No** (unless user pastes it). | **Still no** by default. |

---

## 2. Terminology targets (recommended canonical names)

Use one column internally (DB/API) and friendly labels in UI/i18n.

| Current concept | Problem | Proposed canonical name | Notes |
|-----------------|---------|-------------------------|--------|
| `clean_script_for_audio` | “Clean” is vague | **`voiceover_script`** (DB: `voiceover_script` or keep column name until Phase 3) | Single field for **spoken narration without production markers** (as today). |
| `generated_caption` | “Caption” implies subtitles or on-video text | **`post_caption`** | Text for **platform post** (hashtags, description) — matches scraping `caption` on reels. |
| Editor “caption track” / hooks like `use-captions` | Collides with accessibility “captions” | **`on_screen_text`** / **overlay text track** | Timed or composed text shown **on the video**. |
| `generatedHook` | OK but easy to confuse with “first line of VO” | Keep **hook** or **`opening_hook`** | For TTS, **prepend** to body per product decision; dedupe when body repeats hook. |
| `VoiceoverGenerator` prop `generatedScript` | Actually passes clean script | Rename prop to **`voiceoverScript`** (or `cleanScriptForAudio` aligned with API field name until rename). |

---

## 3. Phased execution

### Phase 0 — Voiceover composition (behavior fix)

Tracked in **[voiceover-hook-prepend-implementation.md](./voiceover-hook-prepend-implementation.md)** (normative rules, file-by-file checklist, tests, docs, API notes). After shipping, tick items there and refresh **§1** in this doc.

### Phase 1 — User-visible language and in-app labels (low risk)

- [ ] Update `frontend/src/translations/en.json` (and any other locales): replace “caption” where it means **post** vs **on-screen** vs **subtitles**.
- [ ] Rename misleading **React prop names** (e.g. `generatedScript` → `voiceoverScript`) in audio components; update call sites only.
- [ ] Adjust empty states, queue detail labels, tooltips (`studio_queue_detail_clean_script`, etc.) to **voiceover script** / **post caption** / **on-screen text** as appropriate.

### Phase 2 — Backend API, tools, and types (breaking for clients if public)

- [ ] Zod schemas, OpenAPI if any, chat tool field descriptions (`chat-tools.ts`): align vocabulary with Phase 2 names.
- [ ] Rename request/response JSON keys only if no external consumers; otherwise add **new keys + deprecation** window.

### Phase 3 — Database and migrations

- [ ] Drizzle: rename columns (e.g. `clean_script_for_audio` → `voiceover_script`, `generated_caption` → `post_caption`).
- [ ] `bun db:generate` + migrate; grep codebase for old names.

### Phase 4 — Docs and architecture notes

- [ ] Update `docs/architecture/domain/audio-tts-system.md`, `docs/specs/chat-reel-guidance.md`, and any editor/timeline docs that say “caption” ambiguously.
- [ ] Add a short glossary to this file or `docs/pm-product-spec.md` **when** those docs are next edited.

---

## 4. Reference file index (for implementers)

| Area | Files |
|------|--------|
| TTS HTTP | `backend/src/routes/audio/index.ts` |
| Agent VO | `backend/src/lib/chat-tools.ts` (`createGenerateVoiceoverTool`) |
| Timeline overlay text | `backend/src/routes/editor/services/build-initial-timeline.ts` (`composeCaptionOverlayText`) |
| Audio UI | `frontend/src/features/audio/components/AudioPanel.tsx`, `VoiceoverGenerator.tsx` |
| Schema | `backend/src/infrastructure/database/drizzle/schema.ts` (`cleanScriptForAudio`, `generatedCaption`, `generatedHook`) |

---

## 5. Changelog

| Date | Note |
|------|------|
| 2026-03-24 | Initial fact check and phased plan from codebase review. |
| 2026-03-24 | Product decision: hook prepends for TTS; Phase 0 = implement shared builder + UI/agent alignment. |
| 2026-03-24 | Split Phase 0 into [voiceover-hook-prepend-implementation.md](./voiceover-hook-prepend-implementation.md) (full change inventory). |
