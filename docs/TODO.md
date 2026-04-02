TODO: Explore and refactor the `Clip` type - it has become a catch-all struct that holds fields for every clip variant (caption, text, video, audio) as optional properties. This makes the type hard to reason about and impossible to statically enforce invariants (e.g., a video clip shouldn't have `captionDocId`, a caption clip shouldn't have `textContent`).

The right direction is a discriminated union:
  type TimelineClip = VideoClip | AudioClip | MusicClip | CaptionClip

Each variant carries only the fields it actually needs. The discriminant is `type: "video" | "audio" | "music" | "caption"`. Shared base fields (id, startMs, durationMs, etc.) live on a `BaseClip` that each variant extends.

This would:
- Eliminate ~15 optional fields that are only meaningful for one clip type
- Let TypeScript narrow clip type at the call site without runtime checks
- Make the reducer cleaner (each action handler works with a specific variant)
- Make the export worker, timeline validator, and composition utils easier to read

Good reference: the caption reinvention in `docs/captions/` already defines `CaptionClip` as a first-class type - the same pattern should be applied to all clip variants in a single pass.

Detailed refactor brief: `docs/clip-discriminated-union-refactor.md`
