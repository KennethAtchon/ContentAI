# Captions Breadth Check Research

Date: 2026-03-31

## Goal

Validate high-impact claims made in `docs/captions` against a broader set of real products and official documentation, not just the reference design that informed the HLD.

This pass focused on:

1. Auto-transcription workflow
2. Word-level timing as the core unit
3. Preset/style-driven caption UX
4. Preview/export fidelity and ASS-based export
5. English-only scope and whether the architecture is too word-centric

## Executive Summary

The docs are directionally aligned with the market, but several claims should be narrowed.

- Auto-transcription is common, but not universally implicit. Many mature tools still make caption generation an explicit user action.
- Word-level timing is common for modern social-caption tools, but not the only viable model. Several products are transcript- or cue-first.
- Preset/style-based caption UX is strongly supported by the market.
- ASS is a credible burn-in/export path, but "trustworthy preview/export contract" should mean "explicit downgrade behavior," not parity.
- The English-only v2 scope is reasonable as a product scope, but the architecture should avoid baking `Word` too deeply into core abstractions if multilingual support matters later.

## Claim 1

### Claim

"Captions should be auto-generated when a voiceover is added to the timeline, rather than through a manual button flow."

Relevant local docs:

- `docs/captions/02-hld.md`
- `docs/captions/01-research.md`

### What I checked

- Adobe Premiere Pro
- Apple Final Cut Pro
- VEED
- CapCut
- Descript

### Findings

- Adobe Premiere Pro supports automatic transcription on import, but caption creation is still a separate creation step from the transcript. That supports "auto-transcribe early," but not necessarily "always auto-create caption clips."
- Final Cut Pro exposes "Transcribe to Captions" as a deliberate action on selected clips. It auto-creates connected caption clips after the user invokes the command.
- VEED exposes auto subtitles as a tool, but also supports manual subtitles and uploaded subtitle files.
- CapCut exposes auto captions as a user-invoked feature in the captions/text UI, then lets the user edit and re-segment.
- Descript is closer to a transcript-first model: captions are generated from the script/captions layer and remain connected to the underlying transcript.

### Verdict

Partially supported.

The market strongly supports auto-transcription and auto-caption generation, but the stronger HLD assumption that this should happen immediately on voiceover insertion is not a universal norm. A safer claim is:

"The product should support one-step caption generation tightly linked to voiceover clips, with optional automatic triggering if user testing shows that surprise and duplication are controlled."

### Recommendation

Keep clip linkage and idempotency, but treat "auto on add" as a product decision to validate with UX testing, not as an industry truth.

## Claim 2

### Claim

"Word-level timing is the right core data model, with captions grouped from words into display pages."

Relevant local docs:

- `docs/captions/02-hld.md`
- `docs/captions/03-lld.md`

### What I checked

- OpenAI speech-to-text docs
- Adobe Premiere Pro
- Descript
- YouTube
- CapCut

### Findings

- OpenAI's speech-to-text API explicitly supports segment and word timestamp granularities. Word-level timestamps are a real capability and are useful for precise edits.
- Descript's caption model is script-linked rather than framed as raw `Word[]` primitives in the UI, even though the product clearly operates on transcript-aligned timing under the hood.
- Adobe's UI exposes transcript creation plus caption creation controls around length, duration, gaps, and line wrapping; the workflow is more cue-oriented than "edit raw word tokens."
- YouTube's creator tools are caption-track oriented: creators edit text and timing on caption tracks rather than manipulating per-word structures directly.
- CapCut's editing guidance is mostly segment/block oriented: edit caption text, split blocks, regenerate, preview.

### Verdict

Supported as an engine capability, overstated as a universal product model.

Word-level timing is a strong internal representation for animated social captions and active-word effects. It is not the only external product model used by successful tools. Many products present captions as transcript rows, subtitle cues, or caption blocks.

### Recommendation

Keep a token-level internal model, but avoid implying that the entire product must be `Word[]`-native. If future flexibility matters, use `Token` or similar as the abstraction name and keep grouping/cue construction as a separate layer.

## Claim 3

### Claim

"Preset-driven styles are the right primary UX, and caption looks can be represented as canonical style definitions plus overrides."

Relevant local docs:

- `docs/captions/02-hld.md`
- `docs/captions/04-presets.md`

### What I checked

- Descript
- VEED
- Adobe Premiere Pro
- CapCut

### Findings

- Descript has a dedicated captions layer and style controls, including styling for active and future words.
- VEED exposes subtitle styling, animation, highlighting, downloadable subtitle files, and hardcoded video export.
- Adobe supports caption presets, styles, and caption creation options for formatting and timing.
- CapCut emphasizes style customization, effects, and animation for auto captions.

### Verdict

Strongly supported.

Across both pro editors and social-first tools, caption styling is commonly presented as reusable styles/presets plus per-project edits. The HLD is aligned with the market here.

### Recommendation

Keep the preset system. The main thing to verify later is not whether presets exist, but whether the current JSON schema is expressive enough for the most important styles.

## Claim 4

### Claim

"Preview and export can share one trustworthy contract, with ASS/FFmpeg as a practical export path."

Relevant local docs:

- `docs/captions/02-hld.md`
- `docs/captions/04-presets.md`
- `docs/captions/red-team-report.md`

### What I checked

- FFmpeg filter documentation
- Adobe Premiere Pro caption/export workflow docs
- Apple Final Cut Pro caption format docs
- VEED subtitle export docs
- Descript export docs

### Findings

- FFmpeg officially supports rendering subtitles using `libass`, and its `ass` filter is specifically limited to ASS files. The `subtitles` filter also renders through `libass`.
- FFmpeg's subtitle pipeline is real and production-credible, but it does not imply perfect parity with custom canvas animation systems.
- Apple and Adobe both work with explicit caption formats and conversion/export workflows. Their ecosystems treat caption formats as constrained deliverables, not as perfect mirrors of arbitrary motion design.
- VEED supports both subtitle-file workflows and hardcoded subtitle export.
- Descript distinguishes its own captions from downstream platform-generated captions and documents cases where YouTube automatic captions can differ from Descript's captions after upload.

### Verdict

Supported with an important caveat.

ASS + FFmpeg is a valid export target for burn-in captions, but the HLD should not imply that one preview engine and one ASS exporter can preserve all visual identity across all presets. The right cross-product lesson is explicit capability tiers, not blanket parity.

### Recommendation

Keep the export model, but narrow the contract language:

- `full` means materially equivalent for export-safe styles
- `approximate` means visibly related, not identical
- some styles may need to be marked export-limited or preview-only

## Claim 5

### Claim

"English-only is an acceptable v2 scope, and word-based assumptions are fine for now."

Relevant local docs:

- `docs/captions/02-hld.md`
- `docs/captions/03-lld.md`
- `docs/captions/red-team-report.md`

### What I checked

- OpenAI speech-to-text docs
- YouTube automatic captions docs
- Descript language support docs
- Final Cut Pro caption docs
- FFmpeg/libass Unicode line wrapping docs

### Findings

- OpenAI supports a large set of transcription languages and exposes word/segment timestamp options.
- YouTube automatic captions support many languages, while also documenting failure modes such as overlapping speakers and unsupported languages.
- Descript supports multiple transcription languages, but some features remain English-only.
- Final Cut Pro's automatic captioning doc still frames its transcription-to-captions flow as English-language audio.
- FFmpeg/libass supports Unicode-aware line breaking when the underlying build supports it, which helps, but does not solve higher-level tokenization and UI assumptions.

### Verdict

Reasonable as a short-term scope, risky as a deep architectural assumption.

Shipping English-only first is normal. Baking "word" into the deepest types and UI concepts is what deserves caution. The market shows a mix of broad multilingual support, partial multilingual support, and English-only feature carveouts.

### Recommendation

Keep the v2 English-only promise, but design internals as if multilingual support is plausible later:

- prefer `Token` over `Word` in core engine types
- keep grouping expressed in time/density terms where possible
- keep language on `CaptionDoc`
- avoid user-facing controls whose meaning collapses outside space-delimited languages

## Overall Recommendation

The strongest parts of the HLD are:

- separating transcript data from render/layout/style logic
- treating captions as distinct from generic text overlays
- using explicit export fidelity modes

The claims that should be softened in the docs are:

1. Auto-create captions on voiceover insertion is a product choice, not an industry default.
2. Word-level timing is a strong engine primitive, not the only valid product abstraction.
3. Preview/export should promise explicit behavior, not parity by default.
4. English-only is fine for v2, but `Word` should not become the long-term architectural trap.

## Sources

### Adobe

- Adobe Premiere Pro: Create captions
  https://helpx.adobe.com/premiere/desktop/add-text-images/insert-captions/create-captions.html

### Apple

- Final Cut Pro: Create captions
  https://support.apple.com/guide/final-cut-pro/create-captions-vere399dab5e/mac
- Final Cut Pro: Show or hide captions
  https://support.apple.com/guide/final-cut-pro/show-or-hide-captions-ver4a54140fd/mac

### Descript

- Add and style captions
  https://help.descript.com/hc/en-us/articles/37469585005197-Add-and-style-captions
- Add and customize text layers
  https://help.descript.com/hc/en-us/articles/10256391944333-Text-emojis-and-captions
- Supported transcription languages
  https://help.descript.com/hc/en-us/articles/10249408168845-Supported-transcription-languages
- Correcting misspelled captions after uploading to YouTube
  https://help.descript.com/hc/en-us/articles/10636541011597-Correcting-misspelled-captions-after-uploading-to-YouTube

### VEED

- How to add subtitles to your video automatically
  https://support.veed.io/en/articles/11172739-how-to-add-subtitles-to-your-video-automatically
- How subtitle files work (SRT)
  https://support.veed.io/en/articles/6971346-how-subtitle-files-work-srt
- Online subtitle editor
  https://www.veed.io/tools/subtitle-editor

### YouTube

- Add subtitles and captions
  https://support.google.com/youtube/answer/2734796
- Edit or remove captions
  https://support.google.com/youtube/answer/2734705
- Use automatic captioning
  https://support.google.com/youtube/answer/6373554
- Translation and transcription glossary
  https://support.google.com/youtube/answer/7296221

### OpenAI

- Speech to text guide
  https://platform.openai.com/docs/guides/speech-to-text
- Audio transcription API reference
  https://platform.openai.com/docs/api-reference/audio/createTranscription
- GPT-4o Transcribe model
  https://platform.openai.com/docs/models/gpt-4o-transcribe

### FFmpeg

- FFmpeg filters documentation
  https://ffmpeg.org/ffmpeg-filters.html

### CapCut

- How do I recognise subtitles?
  https://www.capcut.com/help/how-to-recognise-subtitles
- How do I fix inaccurate auto-captions in CapCut?
  https://www.capcut.com/help/auto-captions-in-capcut
- Why do the captions fail to export?
  https://www.capcut.com/help/captions-fail-to-export
