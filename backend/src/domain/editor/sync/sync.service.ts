/**
 * SyncService — keeps editor project timelines in sync with AI-generated content.
 *
 * WHAT IT DOES (Phase 1):
 * After any text content tool call succeeds (save_content, iterate_content,
 * edit_content_field), this service re-derives the editor timeline from the
 * latest content assets and writes it back to all linked editor projects before
 * the SSE event fires to the frontend. "Sync" means the editor is always
 * showing the latest content state when the user reads the streamed response.
 *
 * FIRING MAP:
 * - save_content        → registerCreatedContent → onContentSaved → syncLinkedProjects ✓
 * - iterate_content     → registerCreatedContent → onContentSaved → syncLinkedProjects ✓
 * - edit_content_field  → registerCreatedContent → onContentSaved → syncLinkedProjects ✓
 * - generate_video_reel    → NO. Async job. Uses refreshEditorTimeline instead.
 * - regenerate_video_shot  → NO. Async job. Uses refreshEditorTimeline instead.
 * - editor autosave        → NO. Editor-to-backend only.
 * - project creation       → NO. EditorService.createEditorProject calls
 *                               deriveTimeline directly for initial setup only.
 *
 * ORDERING GUARANTEE:
 * Sync completes before the SSE event reaches the client. The call chain is:
 *   tool success → registerCreatedContent → onContentSaved → syncLinkedProjects
 *   → updateProjectForSync → SSE fires → client re-fetches → MERGE_TRACKS_FROM_SERVER
 *
 * INVARIANTS:
 * - updateProjectForSync never increments the autosave conflict version.
 *   Sync is transparent to the editor's conflict detection system.
 * - If the editor autosaves after sync writes, the editor's local state wins.
 *   This is intentional: user edits are never discarded by AI activity.
 * - If deriveTimeline returns zero video clips for a new content version
 *   (because video has not been regenerated yet), the existing video clips
 *   are preserved unchanged. Only non-empty tracks replace existing tracks.
 * - User-sourced clips (source: "user") are always carried forward untouched.
 * - Content-sourced clips (source: "content" or no source field) are replaced
 *   by fresh ones, with trim/position adjustments preserved when the same
 *   assetId existed before.
 * - chat_session_content membership and chat_sessions.activeContentId are
 *   owned by the chat tool save path (registerCreatedContent), not by
 *   SyncService. SyncService receives the already-saved contentId and reacts.
 *
 * TODO (Phase 2 — AI direct-edit integration):
 * When AI tools can directly manipulate the timeline (trim clips, reorder shots,
 * set caption presets, create text overlays), this service needs to grow in
 * two directions:
 *
 * 1. A new ToolContext callback: onEditorAction(projectId, operations[])
 *    This dispatches direct clip mutations without requiring a new content version.
 *    Operations would be typed commands: { type: "trim_clip", clipId, durationMs }
 *    etc. SyncService (or a sibling EditorActionService) would apply them via
 *    a new IEditorRepository method: applyClipOperations().
 *
 * 2. Extended source field: source: "content" | "user" | "ai_edit"
 *    AI-placed clips need their own source value so mergeTrackSets can apply
 *    the right merge rules. "ai_edit" clips should survive text content re-syncs
 *    but be replaceable by subsequent AI edits and overrideable by user edits.
 *
 * 3. Assembly tool wiring: ai-assembly-tracks.ts already has convertAIResponseToTracks()
 *    and buildStandardPresetTracks(). These need to be called from a new chat tool
 *    (e.g., assemble_video_cut) that lets the AI arrange shots with full timing control.
 *    The result would feed into this service's syncLinkedProjects flow or a new
 *    onEditorAction dispatch.
 */

import type { IContentRepository } from "../../content/content.repository";
import type { IEditorRepository } from "../editor.repository";
import type { TimelineTrackJson } from "../timeline/merge-placeholders-with-assets";
import { sanitizeTrackOverlaps } from "../timeline/track-overlaps";
import type { TimelineClipJson } from "../timeline/clip-trim";
import { normalizeMediaClipTrimFields } from "../timeline/clip-trim";
import {
  applyTracksToDocument,
  computeDocumentHash,
  type PersistedProjectFile,
} from "../project-document";

type ContentAssetRow = {
  id: string;
  role: string | null;
  durationMs: number | null;
  metadata: unknown;
};

type ClipUserAdjustments = {
  trimStartMs: number;
  trimEndMs: number;
  durationMs: number;
  positionX: number;
  positionY: number;
  scale: number;
  rotation: number;
};

export class SyncService {
  constructor(
    private readonly editor: IEditorRepository,
    private readonly content: IContentRepository,
  ) {}

  /**
   * Build a fresh timeline from a content record's assets.
   *
   * Stateless — always produces source:"content" clips from current DB state.
   * Used by EditorService.createEditorProject for initial project setup, and
   * as the base for syncLinkedProjects on every subsequent text content change.
   *
   * Returns empty tracks with durationMs:0 if the content has no assets yet
   * (e.g., content was saved before any voiceover or video was generated).
   *
   * TODO (Phase 2): When the AI assembly tool (assemble_video_cut) exists,
   * accept an optional AssemblyPlan parameter that overrides the default
   * sequential shot ordering with AI-directed cut timing.
   */
  async deriveTimeline(
    userId: string,
    contentId: number,
  ): Promise<{ tracks: TimelineTrackJson[]; durationMs: number }> {
    const assets =
      await this.content.listAssetsLinkedToGeneratedContent(contentId);

    if (assets.length === 0) {
      return { tracks: this.emptyTracks(), durationMs: 0 };
    }

    const videoAssets = assets
      .filter((a) => a.role === "video_clip")
      .sort((a, b) => this.shotIndex(a.metadata) - this.shotIndex(b.metadata));
    const voiceoverAsset = assets.find((a) => a.role === "voiceover");
    const musicAsset = assets.find((a) => a.role === "background_music");

    const tracks = this.emptyTracks();

    const videoTrack = tracks.find((t) => t.type === "video")!;
    videoTrack.clips = this.buildVideoClips(videoAssets);

    if (voiceoverAsset) {
      const audioTrack = tracks.find((t) => t.type === "audio")!;
      audioTrack.clips = [
        this.buildAudioClip(voiceoverAsset, "voiceover", "Voiceover", 1),
      ];
    }

    if (musicAsset) {
      const musicTrack = tracks.find((t) => t.type === "music")!;
      musicTrack.clips = [
        this.buildAudioClip(musicAsset, "music", "Music", 0.3),
      ];
    }

    return { tracks, durationMs: this.computeDuration(tracks) };
  }

  /**
   * Re-sync all editor projects linked to this content or any ancestor in its chain.
   *
   * Called by send-message.stream.ts via ToolContext.onContentSaved after any
   * text content tool call succeeds (through registerCreatedContent). Must
   * complete before SSE fires.
   *
   * Walks the ancestor chain so that a project created against content v1 is
   * still found and updated when content v3 is saved.
   *
   * TODO (Phase 2): When AI direct-edit operations exist, accept a list of
   * clip operations to apply after re-derive, allowing AI to both update content
   * fields AND make targeted clip edits in a single sync cycle.
   */
  async syncLinkedProjects(userId: string, contentId: number): Promise<void> {
    const chainIds = await this.content.resolveContentAncestorChainIds(
      contentId,
      userId,
    );
    const linkedProjects = await this.editor.findProjectsByContentIds(
      userId,
      chainIds,
    );
    if (linkedProjects.length === 0) return;

    const { tracks: freshTracks, durationMs } = await this.deriveTimeline(
      userId,
      contentId,
    );

    for (const project of linkedProjects) {
      const existingDoc = project.projectDocument as PersistedProjectFile | null;
      const existingTracks = (existingDoc?.project?.timeline?.tracks ?? project.tracks) as TimelineTrackJson[];
      const mergedTracks = this.mergeTrackSets(freshTracks, existingTracks);

      const updatedDoc = applyTracksToDocument(
        existingDoc,
        project.id,
        project.title,
        mergedTracks,
        durationMs,
      );

      await this.editor.updateProjectDocumentForSync(project.id, userId, {
        projectDocument: updatedDoc,
        documentHash: computeDocumentHash(updatedDoc),
        durationMs,
        generatedContentId: contentId,
      });
    }
  }

  private emptyTracks(): TimelineTrackJson[] {
    return [
      {
        id: crypto.randomUUID(),
        type: "video",
        name: "Video",
        muted: false,
        locked: false,
        clips: [],
        transitions: [],
      },
      {
        id: crypto.randomUUID(),
        type: "audio",
        name: "Voiceover",
        muted: false,
        locked: false,
        clips: [],
        transitions: [],
      },
      {
        id: crypto.randomUUID(),
        type: "music",
        name: "Music",
        muted: false,
        locked: false,
        clips: [],
        transitions: [],
      },
      {
        id: crypto.randomUUID(),
        type: "text",
        name: "Text",
        muted: false,
        locked: false,
        clips: [],
        transitions: [],
      },
    ];
  }

  private buildVideoClips(assets: ContentAssetRow[]): TimelineClipJson[] {
    let cursor = 0;
    return assets.map((asset, i) => {
      const dur = Math.max(1, asset.durationMs ?? 5000);
      const meta = (asset.metadata as Record<string, unknown>) ?? {};
      const genPrompt =
        typeof meta.generationPrompt === "string"
          ? meta.generationPrompt
          : undefined;
      const clip = normalizeMediaClipTrimFields(dur, {
        id: crypto.randomUUID(),
        type: "video",
        assetId: asset.id,
        label: genPrompt ?? `Shot ${i + 1}`,
        startMs: cursor,
        speed: 1,
        enabled: true,
        opacity: 1,
        warmth: 0,
        contrast: 0,
        positionX: 0,
        positionY: 0,
        scale: 1,
        rotation: 0,
        volume: 1,
        muted: false,
        source: "content" as const,
      });
      cursor += dur;
      return clip;
    });
  }

  private buildAudioClip(
    asset: ContentAssetRow,
    idPrefix: string,
    label: string,
    volume: number,
  ): TimelineClipJson {
    const dur = Math.max(1, asset.durationMs ?? 1000);
    return normalizeMediaClipTrimFields(dur, {
      id: `${idPrefix}-${asset.id}`,
      type: idPrefix === "music" ? "music" : "audio",
      assetId: asset.id,
      label,
      startMs: 0,
      speed: 1,
      enabled: true,
      opacity: 1,
      warmth: 0,
      contrast: 0,
      positionX: 0,
      positionY: 0,
      scale: 1,
      rotation: 0,
      volume,
      muted: false,
      source: "content" as const,
    });
  }

  /**
   * Merge fresh content-derived tracks with the existing project's tracks.
   *
   * Rules (Phase 1):
   *
   * 1. User clips (source:"user") are always carried forward untouched, appended
   *    after content clips. Rationale: user-added clips are not derived from AI
   *    content and should never be affected by an AI content change.
   *
   * 2. Content clips (source:"content" or no source field) are replaced by the
   *    fresh set from deriveTimeline. Rationale: these are AI-owned — the AI's
   *    latest content state is authoritative for them.
   *
   * 3. When a fresh content clip shares the same assetId as an existing clip,
   *    the user's trim/position adjustments (trimStartMs, trimEndMs, durationMs,
   *    positionX, positionY, scale, rotation) are carried forward onto the fresh
   *    clip. Rationale: the user may have manually trimmed a shot; that work
   *    should survive a text-only re-sync where the video asset did not change.
   *
   * 4. If the fresh video track has zero clips (new content version, no video
   *    generated yet), the existing video clips are kept unchanged. Only non-empty
   *    tracks replace their existing counterparts. Rationale: it would be
   *    confusing and destructive to blank the video track just because the user
   *    rewrote the script without regenerating video.
   *
   * TODO (Phase 2 — "ai_edit" source type):
   * When AI direct-edit tools exist, clips placed by AI operations will carry
   * source:"ai_edit". The merge rules need to be extended:
   * - "ai_edit" clips survive text content re-syncs (they were explicitly placed
   *   by AI intent, not derived from assets).
   * - "ai_edit" clips are replaceable by a subsequent AI edit operation.
   * - "ai_edit" clips are overrideable by user manual edits (user wins).
   */
  private mergeTrackSets(
    fresh: TimelineTrackJson[],
    existing: TimelineTrackJson[],
  ): TimelineTrackJson[] {
    // Build a map of existing clips by assetId to carry forward user adjustments.
    const existingByAssetId = new Map<string, ClipUserAdjustments>();
    for (const track of existing) {
      for (const clip of track.clips) {
        const assetId = clip.assetId as string | undefined;
        if (assetId && typeof assetId === "string") {
          existingByAssetId.set(assetId, {
            trimStartMs: Number(clip.trimStartMs ?? 0),
            trimEndMs: Number(clip.trimEndMs ?? 0),
            durationMs: Number(clip.durationMs ?? 0),
            positionX: Number(clip.positionX ?? 0),
            positionY: Number(clip.positionY ?? 0),
            scale: Number(clip.scale ?? 1),
            rotation: Number(clip.rotation ?? 0),
          });
        }
      }
    }

    const freshTypes = new Set(fresh.map((t) => t.type));

    const mergedFresh = fresh.map((freshTrack) => {
      const existingTrack = existing.find((t) => t.type === freshTrack.type);

      // Rule 4: preserve existing video clips if fresh video track is empty.
      if (freshTrack.type === "video" && freshTrack.clips.length === 0) {
        return existingTrack ?? freshTrack;
      }

      // Collect user-sourced clips from the existing track to append.
      const userClips = existingTrack
        ? existingTrack.clips.filter(
            (c) => (c.source as string | undefined) === "user",
          )
        : [];

      // Apply user adjustments to fresh content clips with the same assetId.
      const mergedContentClips = freshTrack.clips.map((freshClip) => {
        const assetId = freshClip.assetId as string | undefined;
        if (!assetId) return freshClip;

        const adj = existingByAssetId.get(assetId);
        if (!adj) return freshClip;

        // Only carry adjustments when the asset duration hasn't changed
        // enough to make the old trim nonsensical. If sourceMaxDurationMs
        // is set on the fresh clip, the normalizeMediaClipTrimFields call
        // already computed valid bounds — we just overlay the user's values.
        return {
          ...freshClip,
          trimStartMs: adj.trimStartMs,
          trimEndMs: adj.trimEndMs,
          durationMs: adj.durationMs,
          positionX: adj.positionX,
          positionY: adj.positionY,
          scale: adj.scale,
          rotation: adj.rotation,
        };
      });

      return {
        ...(existingTrack ?? freshTrack),
        id: existingTrack?.id ?? freshTrack.id,
        clips: sanitizeTrackOverlaps({
          ...(existingTrack ?? freshTrack),
          id: existingTrack?.id ?? freshTrack.id,
          clips: [...mergedContentClips, ...userClips],
        }).clips,
      };
    });

    // Preserve any existing tracks whose type was not emitted by deriveTimeline.
    // Without this, a future track type not covered by emptyTracks() would be
    // silently destroyed on every sync cycle.
    const existingOnlyTracks = existing.filter((t) => !freshTypes.has(t.type));

    return [...mergedFresh, ...existingOnlyTracks];
  }

  private shotIndex(metadata: unknown): number {
    const meta = (metadata as Record<string, unknown>) ?? {};
    return typeof meta.shotIndex === "number" ? meta.shotIndex : 0;
  }

  private computeDuration(tracks: TimelineTrackJson[]): number {
    let maxEnd = 0;
    for (const track of tracks) {
      for (const clip of track.clips) {
        const end = Number(clip.startMs ?? 0) + Number(clip.durationMs ?? 0);
        if (end > maxEnd) maxEnd = end;
      }
    }
    return Math.min(Math.max(maxEnd, 1000), 180_000);
  }
}
