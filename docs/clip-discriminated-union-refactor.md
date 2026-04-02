# Domain Modeling Standard: Prefer Explicit Variants Over Optional-Field Catch-Alls

## Status

Proposed codebase-wide modeling standard. The `Clip` refactor is the motivating example, but the rule is intended to apply across the project wherever a single type starts absorbing multiple domain variants through optional fields.

## Core Rule

When a model represents multiple mutually exclusive variants, we should prefer:

- a shared base type for truly common fields
- explicit subtype interfaces for each real variant
- a discriminated union for the full domain

We should not model those variants by attaching subtype-specific optional fields to a single broad parent type.

In short:

> Use inheritance plus explicit variants for domain differences. Do not use optional properties as a substitute for subtype boundaries.

## Why This Matters

Optional-field catch-all models feel convenient at first, but they create long-term debt:

- invalid states become representable
- invariants stop being statically enforceable
- helper signatures become vague
- reducers/services gain defensive branching
- validation logic gets more complicated
- future changes are incentivized to add "just one more optional field"

That is operational debt, not flexibility.

Optional fields are still valid when absence is part of the real domain. They are not valid as the default way to model different entities that only happen to share a few fields.

## Preferred Pattern

### Shared base + explicit variants

```ts
interface BaseEntity {
  id: string;
}

interface VariantA extends BaseEntity {
  type: "a";
  aOnlyField: string;
}

interface VariantB extends BaseEntity {
  type: "b";
  bOnlyField: number;
}

type Entity = VariantA | VariantB;
```

### Why this is better

- call sites can narrow on `type`
- each variant owns only its real fields
- invalid combinations are harder or impossible to construct
- helper functions can accept the exact subtype they support
- validators can validate variant-specific payloads directly

## Anti-Pattern

Do not do this:

```ts
interface Entity {
  id: string;
  aOnlyField?: string;
  bOnlyField?: number;
}
```

This is a smell when:

- `aOnlyField` and `bOnlyField` are mutually exclusive
- code branches based on which one exists
- helpers use `"field" in entity` checks to guess the subtype
- updates/patches can accidentally mix fields from incompatible variants

## The `Clip` Refactor As A Case Study

`Clip` exposed the exact problem this standard is meant to prevent.

The old shape had accumulated fields for multiple unrelated concepts:

- media playback state
- text-overlay content
- caption-document linkage
- placeholder generation state
- per-clip visual transforms
- audio controls

That made the model harder to reason about and impossible to strictly enforce.

### Example smell

Property-existence checks like these are usually a sign that the type model is too broad:

```ts
return "assetId" in clip;
return "textContent" in clip;
```

That logic exists because the model is not expressing the domain explicitly enough.

### Better shape

Instead of one broad `Clip`, the healthier direction is:

```ts
type TimelineClip = VideoClip | AudioClip | MusicClip | TextClip | CaptionClip;
```

with a shared base and subtype-specific ownership of fields.

## Codebase-Wide Modeling Guidance

Use this standard anywhere in the project where a type starts becoming a bag of optional fields.

Typical examples:

- timeline/editor entities
- persisted JSON payloads
- reducer-managed state with multiple variants
- background-job payloads
- provider-specific integrations
- API resources with multiple modes or states

### Strong signals that a refactor is needed

Refactor toward explicit variants when one or more of these are true:

- one interface contains many optional fields that only make sense for one variant
- helper functions rely on property-existence checks instead of a discriminant
- patch/update types combine unrelated shapes
- validators accept fields that should be impossible for a given subtype
- local files redefine partial copies of the same domain shape
- code comments have to explain which fields "only apply when X"

## Practical Rules

### 1. Put shared fields on the base type only

A base type should contain fields that are truly universal to every variant.

If a field only applies to one subtype, it belongs on that subtype.

### 2. Use a discriminant when behavior branches by kind

If the code needs to ask "what kind of thing is this?", model that explicitly:

```ts
type: "video" | "audio" | "music" | "caption"
```

### 3. Use intermediate capability types when useful

Multiple inheritance layers are fine when they express real shared behavior.

Example:

```ts
interface BaseEntity { ... }
interface MediaEntity extends BaseEntity { ... }
interface VisualEntity extends MediaEntity { ... }
```

This is still far cleaner than one giant catch-all type.

### 4. Make helper APIs honest

If a helper only supports a subset of the domain, type it that way.

Good:

```ts
splitClip(clip: MediaClip, ...)
videoClipNeedsHeavyPreload(clip: VideoClip, ...)
```

Bad:

```ts
splitClip(clip: TimelineClip, ...)
```

when only media clips actually work.

### 5. Do not hide variant ambiguity inside patch types

This is usually a smell:

```ts
type Patch = Partial<TypeA> & Partial<TypeB>;
```

Prefer:

- variant-specific patch types
- discriminated patch payloads
- variant-specific update actions

### 6. Avoid local shadow copies of domain models

If shared domain types are good enough to import, use them.

If shared domain types are not good enough to import, fix the shared types instead of creating more local approximations.

## Clip-Specific Example

For timeline clips, the target shape should still follow this pattern:

```ts
interface BaseClip {
  id: string;
  startMs: number;
  durationMs: number;
}

interface MediaClipBase extends BaseClip {
  assetId: string | null;
  trimStartMs: number;
  trimEndMs: number;
  speed: number;
  volume: number;
  muted: boolean;
}

interface VideoClip extends MediaClipBase {
  type: "video";
}

interface AudioClip extends MediaClipBase {
  type: "audio";
}

interface MusicClip extends MediaClipBase {
  type: "music";
}

interface TextClip extends BaseClip {
  type: "text";
  textContent: string;
}

interface CaptionClip extends BaseClip {
  type: "caption";
  captionDocId: string;
}

type TimelineClip =
  | VideoClip
  | AudioClip
  | MusicClip
  | TextClip
  | CaptionClip;
```

The important point is not the exact field list. The point is the pattern.

## How To Decide If An Optional Field Is Legitimate

Ask:

1. Is the field meaningful for every variant?
2. If not, is its absence a real domain state?
3. Or is the field absent only because it belongs to a different subtype?

If the answer is "it belongs to a different subtype," do not add it to the parent.

### Legitimate optional field

```ts
publishedAt?: string
```

if the entity can genuinely be unpublished.

### Modeling smell

```ts
captionDocId?: string
textContent?: string
voiceId?: string
```

on a single type where only one of those concepts can be true at a time.

## Refactor Strategy

When fixing one of these models, the preferred sequence is:

1. Identify true shared fields.
2. Define explicit variant interfaces.
3. Add a discriminant.
4. Replace property-existence guards with discriminant narrowing.
5. Retype helpers to the exact variants they support.
6. Replace cross-variant patch types.
7. Update validators/parsers so each variant validates its own shape.
8. Remove local duplicate interfaces that represent the same domain poorly.

## Acceptance Criteria For This Standard

A refactor is aligned with this standard when:

1. The broad catch-all type no longer owns unrelated subtype fields.
2. Every meaningful variant is explicit.
3. Call sites narrow by discriminant rather than guessing from field presence.
4. Helper signatures match the actual subtypes they support.
5. Validators enforce per-variant contracts.
6. Update paths cannot accidentally apply subtype-specific fields to the wrong variant.

## Review Checklist

Use this checklist whenever adding fields to an existing domain type:

- Is this field truly common to every variant?
- If not, should it live on one subtype instead?
- Are we modeling a real nullable state, or are we avoiding defining a new subtype?
- Will this make future narrowing more explicit or more ambiguous?
- Are we introducing optional fields that will later require defensive runtime checks everywhere?

If the answer points toward subtype-specific ownership, create or extend a subtype instead of widening the parent.

## Policy Statement

For this codebase:

> Prefer explicit subtypes, discriminated unions, and shared base interfaces for domain modeling. Treat optional-field catch-all types as a design smell and refactor them when encountered.

The `Clip` refactor is one application of this rule, not the only one.
