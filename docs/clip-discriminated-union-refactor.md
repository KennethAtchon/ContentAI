# Clip Type Refactor: Discriminated Union Rollout

## Status

Proposed refactor plan. This document expands the TODO in `docs/TODO.md` into a concrete modeling rule, migration strategy, and acceptance checklist for the editor/backend timeline code.

## Executive Summary

`Clip` has drifted into a catch-all shape that carries fields for multiple unrelated concepts:

- media playback state
- text-overlay content
- caption-document linkage
- placeholder generation state
- per-clip visual transforms
- audio controls

That shape is now doing too much. The result is weak static guarantees, harder-to-read reducers and helpers, and a steady accumulation of optional fields that only make sense for one variant.

We should replace the broad `Clip` model with a discriminated union where every clip variant is first-class and only owns the fields it actually uses:

```ts
type TimelineClip = VideoClip | AudioClip | MusicClip | CaptionClip;
```

Every variant must carry `type`, and shared fields must live on a base interface that variants extend. We should prefer inheritance plus explicit subtype contracts over optional fields on a generic parent.

This is not just a type cleanup. It is a modeling rule for the codebase:

- if a field is meaningful only for one subtype, it belongs on that subtype
- if behavior branches by kind, the kind should be modeled explicitly
- optional fields are not a substitute for domain boundaries
- optional parameters and optional persisted fields should be treated as operational debt unless the absence is a real domain concept

## Problem Statement

Today the editor/frontend and backend both still model most timeline clips with a broad `Clip` interface and a separate `CaptionClip`:

- `frontend/src/features/editor/types/editor.ts`
- `backend/src/types/timeline.types.ts`

This leaves the system in an awkward middle state:

- captions are first-class
- video/audio/music/text are still collapsed into one shared `Clip`
- `ClipPatch = Partial<Clip> & Partial<CaptionClip>` reintroduces the same ambiguity the caption work was trying to remove

### Current Failure Mode

The current model allows invalid states that TypeScript cannot reject:

- a video clip can accidentally carry `textContent`
- a text-like clip can accidentally carry `assetId`
- an audio clip can expose video-only transform or preview assumptions
- a caption clip can be patched through a generic partial object
- helper functions accept `Clip` even when they really mean a narrower subtype

### Concrete Examples In The Codebase

#### 1. Property-existence checks replace real narrowing

`frontend/src/features/editor/utils/clip-types.ts` currently uses shape checks:

```ts
return "assetId" in clip;
return "textContent" in clip;
```

That is a sign the type system is not carrying the domain model cleanly enough.

#### 2. Reducer patching blurs unrelated clip families together

`frontend/src/features/editor/types/editor.ts`:

```ts
export type ClipPatch = Partial<Clip> & Partial<CaptionClip>;
```

That lets a single patch object pretend to be applicable to incompatible variants.

#### 3. Media-only helpers are typed as generic clip helpers

Examples:

- `frontend/src/features/editor/utils/editor-composition.ts`
- `frontend/src/features/editor/utils/split-clip.ts`
- `frontend/src/features/editor/utils/clip-constraints.ts`
- `backend/src/domain/editor/run-export-job.ts`

Those APIs largely operate on media clips, but their signatures do not make that contract explicit.

#### 4. Preview/render/export code carries defensive branching noise

The preview and export paths repeatedly ask "what kind of thing is this?" because the type model does not answer that upfront.

#### 5. Placeholder state is mixed into the general clip shape

Placeholder-only fields such as:

- `isPlaceholder`
- `placeholderShotIndex`
- `placeholderLabel`
- `placeholderStatus`

are not meaningful for every clip type, yet they currently live on the shared `Clip`.

That forces unrelated flows to carry placeholder semantics around.

## Design Rule For The Codebase

This refactor should establish a reusable pattern, not a one-off exception for timeline clips.

### Preferred Pattern

1. Model the shared minimum as a base type.
2. Model each real variant as its own interface extending the base.
3. Use a discriminant (`type`) for narrowing.
4. Keep variant-specific fields on the variant.
5. Keep variant-specific actions/helpers/validators typed to that variant.

### Anti-Pattern

Do not solve subtype differences by adding more optional fields to a parent type:

```ts
interface Clip {
  textContent?: string;
  captionDocId?: string;
  sourceStartMs?: number;
  sourceEndMs?: number;
  stylePresetId?: string;
  placeholderStatus?: "pending" | "generating" | "failed";
}
```

This looks flexible, but it creates long-term debt:

- invalid combinations become representable
- narrowing becomes manual and repetitive
- patch/update logic becomes unsafe
- invariants move out of the type system and into scattered runtime checks
- every future feature is tempted to add "just one more optional field"

Optional fields are acceptable only when absence is part of the real domain model, not when the field belongs to a different subtype.

## Target Type Model

The exact field list can evolve during implementation, but the shape should look like this:

```ts
interface BaseClip {
  id: string;
  type: "video" | "audio" | "music" | "caption";
  startMs: number;
  durationMs: number;
  locallyModified?: boolean;
}

interface BaseMediaClip extends BaseClip {
  assetId: string | null;
  label: string;
  trimStartMs: number;
  trimEndMs: number;
  speed: number;
  enabled?: boolean;
  volume: number;
  muted: boolean;
}

interface VisualClip extends BaseMediaClip {
  opacity: number;
  warmth: number;
  contrast: number;
  positionX: number;
  positionY: number;
  scale: number;
  rotation: number;
}

interface VideoClip extends VisualClip {
  type: "video";
  sourceMaxDurationMs?: number;
  placeholder?: VideoPlaceholderState;
}

interface AudioClip extends BaseMediaClip {
  type: "audio";
}

interface MusicClip extends BaseMediaClip {
  type: "music";
}

interface CaptionClip extends BaseClip {
  type: "caption";
  captionDocId: string;
  sourceStartMs: number;
  sourceEndMs: number;
  stylePresetId: string;
  styleOverrides: CaptionStyleOverrides;
  groupingMs: number;
  originVoiceoverClipId?: string;
}

type TimelineClip = VideoClip | AudioClip | MusicClip | CaptionClip;
```

## Notes On The Target Model

### 1. Every clip has a discriminator

The current generic `Clip` has no `type`. That should change. Every clip must be self-describing.

### 2. `text` should not remain a parallel generic clip family

The caption architecture already establishes that timed on-screen text should be modeled as `CaptionClip`, backed by `CaptionDoc`. We should not keep a second generic text clip shape alive unless the product truly has a distinct non-caption text domain that warrants its own subtype.

Default position:

- remove generic text-overlay clip modeling
- use `CaptionClip` for timed text/title overlays
- do not introduce a separate `TextClip` unless a concrete use case exists that captions cannot represent

### 3. Placeholder state should be explicit

Instead of several free-floating optional placeholder fields, prefer one subtype-specific object:

```ts
interface VideoPlaceholderState {
  shotIndex: number;
  label: string;
  status: "pending" | "generating" | "failed";
}
```

That keeps placeholder state coherent and limits it to the clip kind that actually uses it.

### 4. Shared capability types are fine

Inheritance does not need to be only one level deep. Intermediate capability types are useful when they represent real shared behavior:

- `BaseClip`
- `BaseMediaClip`
- `VisualClip`

That is still much cleaner than a single giant bag-of-fields type.

## Fields That Should Stop Living On A Catch-All Clip

These are strong candidates to move off the generic shape entirely:

- `textContent`
- `textAutoChunk`
- `textStyle`
- `captionDocId`
- `sourceStartMs`
- `sourceEndMs`
- `stylePresetId`
- `styleOverrides`
- `groupingMs`
- `originVoiceoverClipId`
- `isPlaceholder`
- `placeholderShotIndex`
- `placeholderLabel`
- `placeholderStatus`

Some media fields may also want finer ownership boundaries:

- `opacity`
- `warmth`
- `contrast`
- `positionX`
- `positionY`
- `scale`
- `rotation`

These likely belong on visual clips, not on audio/music clips.

## Code Areas That Simplify Immediately

### Type definitions

- `frontend/src/features/editor/types/editor.ts`
- `backend/src/types/timeline.types.ts`

These become the canonical source of clip inheritance and discriminated unions.

### Type guards

- `frontend/src/features/editor/utils/clip-types.ts`

This should move from property-existence heuristics to explicit discriminants:

```ts
clip.type === "caption"
clip.type === "video"
clip.type === "audio"
clip.type === "music"
```

### Reducer logic

- `frontend/src/features/editor/model/editor-reducer-clip-ops.ts`

This file becomes cleaner if actions and patches are variant-aware. It should no longer accept a patch that can target mutually incompatible clip families.

### Composition helpers

- `frontend/src/features/editor/utils/editor-composition.ts`
- `backend/src/domain/editor/timeline/composition.ts`

Many functions there are really:

- video clip helpers
- audio clip helpers
- media clip helpers

The signatures should say so explicitly.

### Split/trim/constraint helpers

- `frontend/src/features/editor/utils/split-clip.ts`
- `frontend/src/features/editor/utils/clip-constraints.ts`

These should accept the exact clip subtypes they support instead of generic timeline clips.

### Preview area

- `frontend/src/features/editor/components/PreviewArea.tsx`

The preview should branch on clip type intentionally rather than inferring semantics from field existence.

### Export worker

- `backend/src/domain/editor/run-export-job.ts`

This can stop defining ad hoc export-local clip interfaces that mirror the same ambiguity. It should consume the shared timeline types and narrow by discriminant.

### Timeline validation and stored-track parsing

- `backend/src/domain/video/timeline-validation.ts`
- `backend/src/domain/editor/validate-stored-tracks.ts`

Validation code becomes easier to reason about when each validator deals with a known subtype rather than a shape that may contain unrelated fields.

## Recommended Refactor Strategy

Do this in one coordinated pass across frontend and backend type ownership. Avoid a long hybrid state where half the code assumes discriminated unions and half still relies on the catch-all `Clip`.

### Phase 1: Establish canonical clip hierarchy

In both frontend and backend shared timeline type modules:

- add `BaseClip`
- add `BaseMediaClip` if useful
- add `VideoClip`
- add `AudioClip`
- add `MusicClip`
- preserve `CaptionClip` as first-class
- redefine `TimelineClip` as the full union
- delete or rename the old catch-all `Clip`

Important:

- if the name `Clip` remains, it should mean the union, not the old generic struct
- avoid keeping `Clip` as a vague pseudo-base and `TimelineClip` as the real union

### Phase 2: Replace optional-field narrowing with discriminant narrowing

Update all guards, selectors, and helpers to use `clip.type`.

Examples of what should disappear:

- `"assetId" in clip`
- `"textContent" in clip`
- `"type" in clip && clip.type === "caption"`

The first two are especially important. A proper union should make those unnecessary.

### Phase 3: Split patch/update types by variant

`ClipPatch = Partial<Clip> & Partial<CaptionClip>` should be removed.

Prefer one of these patterns:

```ts
type VideoClipPatch = Partial<Omit<VideoClip, "id" | "type">>;
type AudioClipPatch = Partial<Omit<AudioClip, "id" | "type">>;
type MusicClipPatch = Partial<Omit<MusicClip, "id" | "type">>;
type CaptionClipPatch = Partial<Omit<CaptionClip, "id" | "type">>;
```

Then either:

```ts
type TimelineClipPatch =
  | { type: "video"; patch: VideoClipPatch }
  | { type: "audio"; patch: AudioClipPatch }
  | { type: "music"; patch: MusicClipPatch }
  | { type: "caption"; patch: CaptionClipPatch };
```

or use variant-specific reducer actions:

- `UPDATE_VIDEO_CLIP`
- `UPDATE_AUDIO_CLIP`
- `UPDATE_MUSIC_CLIP`
- `UPDATE_CAPTION_CLIP`

The main goal is to stop pretending one partial object can safely patch every subtype.

### Phase 4: Make helper APIs honest

Rename and retarget helper signatures so they describe the actual contract:

- `splitClip(clip: MediaClip, ...)`
- `videoClipNeedsHeavyPreload(clip: VideoClip, ...)`
- `audioClipNeedsHeavyPreload(clip: AudioClip | MusicClip, ...)`
- `getClipSourceTimeSecondsAtTimelineTime(clip: MediaClip, ...)`

This removes a lot of internal defensive code.

### Phase 5: Collapse leftover legacy text modeling

Audit every remaining use of:

- `textContent`
- `textAutoChunk`
- `textStyle`

Decide whether each one should:

1. be deleted because captions replaced it
2. be migrated into the caption system
3. become a real first-class subtype if it truly represents a distinct domain

Bias strongly toward deletion or caption unification. Do not preserve a zombie text model out of convenience.

### Phase 6: Tighten validators and persistence contracts

Once the union is in place:

- parsing should validate `type`
- each variant parser should validate only its own fields
- persistence layers should not silently accept foreign fields for a variant

This is where the refactor starts paying off operationally, not just ergonomically.

## Things That Can Be Simplified Alongside The Refactor

This TODO is a good chance to simplify adjacent modeling debt.

### 1. Retire the legacy text overlay path

If captions now own timed text/title overlays, remove the remaining generic text clip rendering and editing code instead of carrying two overlapping systems.

### 2. Replace scattered placeholder flags with one nested object

This is easier to validate, easier to extend, and clearer in reducers and API payloads.

### 3. Introduce capability aliases where behavior truly aligns

Useful aliases may include:

```ts
type MediaClip = VideoClip | AudioClip | MusicClip;
type AudibleClip = AudioClip | MusicClip;
type VisualTimelineClip = VideoClip | CaptionClip;
```

These are much more expressive than using `Clip` everywhere.

### 4. Remove local duplicate clip interfaces

`backend/src/domain/editor/run-export-job.ts` defines local `ClipData` and `CaptionClipData` interfaces. That duplication should disappear once shared timeline types are accurate enough to import directly.

### 5. Make track ownership clearer

The current track model already suggests the allowed clip families:

- `video` tracks should hold `VideoClip`
- `audio` tracks should hold `AudioClip`
- `music` tracks should hold `MusicClip`
- `text` tracks should hold `CaptionClip`

That relationship should be encoded more strongly where practical.

Possible direction:

```ts
interface VideoTrack extends BaseTrack {
  type: "video";
  clips: VideoClip[];
}
```

Even if we do not fully subtype tracks in the first pass, helper functions should assume the tighter relationship when operating on a known track kind.

### 6. Remove broad "just in case" nullability where the domain is stricter

Example candidate:

- if persisted media clips always require a real asset except while explicitly placeholder-backed, model that distinction directly instead of leaving `assetId: string | null` on every media clip forever

That may be a follow-up, but this refactor is the right place to identify those boundaries.

## Non-Goals

This refactor should not:

- add adapter fields to preserve invalid legacy combinations
- keep the giant optional-field model alive under a different name
- introduce a separate `TitleClip` if `CaptionClip` already covers the use case
- leave `ClipPatch` as a cross-variant partial type

## Suggested Acceptance Criteria

The refactor is complete when all of the following are true:

1. There is no catch-all persisted `Clip` shape carrying unrelated optional fields.
2. Every clip variant has an explicit `type`.
3. `TimelineClip` is the canonical discriminated union.
4. Type narrowing in call sites is driven by `clip.type`, not property existence checks.
5. Reducer updates are variant-aware and cannot apply caption fields to media clips.
6. Preview/export/composition helpers accept the specific subtypes they actually support.
7. Backend stored-track parsing and validation validate per-variant fields.
8. Remaining generic text-overlay fields are either deleted or promoted into a real subtype with clear ownership.
9. Placeholder state is represented coherently, not as several loose optional fields.
10. Frontend and backend timeline type definitions stay aligned.

## Review Checklist For Future Work

Use this checklist whenever someone adds a field to a timeline entity:

- Is this field meaningful for every subtype?
- If not, should it live on exactly one subtype?
- Is the absence of this field a real domain state, or just a modeling shortcut?
- Would a discriminated union or intermediate capability type express this more cleanly?
- Are we adding an optional field today that becomes validation debt tomorrow?

If the answer points toward subtype-specific ownership, do not add the field to a generic parent.

## Recommended Follow-Through

After implementation, add a short ADR or modeling guideline that makes this a general rule:

> Prefer explicit subtypes and inheritance for domain variants. Do not use optional properties on shared parent types to model mutually exclusive concepts.

That principle should apply beyond timeline clips wherever we see "one interface with many unrelated optional fields" starting to emerge.
