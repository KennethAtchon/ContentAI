import type { TimelinePayload } from "./schemas";
import { contentService } from "../../domain/singletons";

export type TimelineIssue = {
  code: string;
  track: string;
  itemIds: string[];
  severity: "error" | "warning";
  message: string;
};

const MIN_RECOMMENDED_CLIP_MS = 800;
const MAX_RECOMMENDED_CLIP_MS = 12_000;

function getAssetTypeForTrack(
  track: "video" | "audio",
  role?: string,
): string[] {
  if (track === "video") return ["video_clip"];
  if (role === "voiceover") return ["voiceover"];
  if (role === "music") return ["music"];
  return ["voiceover", "music"];
}

function hasTrackOverlap(
  items: Array<{ startMs: number; endMs: number }>,
): boolean {
  const sorted = [...items].sort((a, b) => a.startMs - b.startMs);
  for (let i = 1; i < sorted.length; i += 1) {
    if (sorted[i].startMs < sorted[i - 1].endMs) return true;
  }
  return false;
}

function getItemSpanMs(item: {
  startMs: number;
  endMs: number;
  trimStartMs?: number;
  trimEndMs?: number;
}): number {
  const clipSpan = item.endMs - item.startMs;
  if (
    typeof item.trimStartMs === "number" &&
    typeof item.trimEndMs === "number" &&
    item.trimEndMs > item.trimStartMs
  ) {
    return item.trimEndMs - item.trimStartMs;
  }
  return clipSpan;
}

export async function validateTimeline(input: {
  userId: string;
  generatedContentId: number;
  timeline: TimelinePayload;
}): Promise<TimelineIssue[]> {
  const issues: TimelineIssue[] = [];
  const videoItems = input.timeline.tracks.video ?? [];
  const audioItems = input.timeline.tracks.audio ?? [];

  for (const item of [...videoItems, ...audioItems]) {
    if (item.endMs <= item.startMs) {
      issues.push({
        code: "INVALID_TIME_RANGE",
        track: videoItems.includes(item) ? "video" : "audio",
        itemIds: [item.id],
        severity: "error",
        message: "Timeline item has invalid start/end range.",
      });
    }
    if (item.endMs > input.timeline.durationMs) {
      issues.push({
        code: "ITEM_EXCEEDS_DURATION",
        track: videoItems.includes(item) ? "video" : "audio",
        itemIds: [item.id],
        severity: "error",
        message: "Timeline item exceeds duration.",
      });
    }

    const spanMs = getItemSpanMs(item);
    if (spanMs < MIN_RECOMMENDED_CLIP_MS) {
      issues.push({
        code: "SHORT_CLIP_SPAN",
        track: videoItems.includes(item) ? "video" : "audio",
        itemIds: [item.id],
        severity: "warning",
        message: `Clip source span is short (${spanMs}ms). Consider longer source clips for better quality transitions.`,
      });
    }
    if (spanMs > MAX_RECOMMENDED_CLIP_MS) {
      issues.push({
        code: "LONG_CLIP_SPAN",
        track: videoItems.includes(item) ? "video" : "audio",
        itemIds: [item.id],
        severity: "warning",
        message: `Clip source span is very long (${spanMs}ms). Trimming is recommended to keep viewer engagement.`,
      });
    }

    if (item.transitions && item.transitions.length > 0) {
      for (let i = 0; i < item.transitions.length; i++) {
        const transition = item.transitions[i];
        const t = transition as {
          type?: string;
          durationMs?: number;
          key?: string;
        };
        if (!t.type || typeof t.durationMs !== "number") continue;
        if (t.durationMs <= 0) {
          issues.push({
            code: "TRANSITION_DURATION_INVALID",
            track: "video",
            itemIds: [item.id],
            severity: "error",
            message: `${t.type} transitions must use a positive duration.`,
          });
          continue;
        }
        if (t.durationMs > spanMs) {
          issues.push({
            code: "TRANSITION_EXCEEDS_CLIP_SPAN",
            track: "video",
            itemIds: [item.id],
            severity: "error",
            message: "Transition duration cannot exceed source clip span.",
          });
        }
        // Check transitionOut against next item if exists
        if (t.key === "transitionOut") {
          const currentIndex = videoItems.indexOf(item);
          const nextItem = videoItems[currentIndex + 1];
          if (nextItem) {
            const nextSpan = Math.max(1, getItemSpanMs(nextItem));
            if (t.durationMs > nextSpan) {
              issues.push({
                code: "TRANSITION_EXCEEDS_NEXT_CLIP_SPAN",
                track: "video",
                itemIds: [item.id, nextItem.id],
                severity: "error",
                message: "Transition out duration exceeds next clip source span.",
              });
            }
          }
        }
      }
    }
  }

  if (videoItems.length === 0) {
    issues.push({
      code: "MISSING_VIDEO_SEGMENTS",
      track: "video",
      itemIds: [],
      severity: "error",
      message: "At least one video segment is required.",
    });
  }

  const refs = [
    ...videoItems
      .filter((i) => i.assetId)
      .map((i) => ({
        track: "video" as const,
        itemId: i.id,
        assetId: i.assetId!,
        role: i.role,
      })),
    ...audioItems
      .filter((i) => i.assetId)
      .map((i) => ({
        track: "audio" as const,
        itemId: i.id,
        assetId: i.assetId!,
        role: i.role,
      })),
  ];

  if (refs.length > 0) {
    const ownedAssets = await contentService.fetchOwnedAssetsForTimeline(
      input.userId,
      input.generatedContentId,
      refs.map((ref) => ref.assetId),
    );

    const assetMap = new Map(ownedAssets.map((asset) => [asset.id, asset]));
    for (const ref of refs) {
      const asset = assetMap.get(ref.assetId);
      if (!asset) {
        issues.push({
          code: "ASSET_OWNERSHIP_INVALID",
          track: ref.track,
          itemIds: [ref.itemId],
          severity: "error",
          message: "Referenced asset is missing or not owned by user.",
        });
        continue;
      }

      const allowedTypes = getAssetTypeForTrack(ref.track, ref.role);
      if (!allowedTypes.includes(asset.type)) {
        issues.push({
          code: "ASSET_TYPE_MISMATCH",
          track: ref.track,
          itemIds: [ref.itemId],
          severity: "error",
          message: `Asset type "${asset.type}" is not valid for ${ref.track}${ref.role ? ` (${ref.role})` : ""}. Expected: ${allowedTypes.join(", ")}.`,
        });
      }
    }
  }

  if (hasTrackOverlap(videoItems)) {
    issues.push({
      code: "VIDEO_TRACK_OVERLAP",
      track: "video",
      itemIds: videoItems.map((i) => i.id),
      severity: "error",
      message: "Video segments cannot overlap.",
    });
  }

  const allAudio = [...audioItems, ...(input.timeline.tracks.captions ?? [])];
  if (hasTrackOverlap(allAudio)) {
    issues.push({
      code: "AUDIO_TRACK_OVERLAP",
      track: "audio",
      itemIds: allAudio.map((i) => i.id),
      severity: "error",
      message: "Audio segments cannot overlap.",
    });
  }

  const captionTracks = input.timeline.tracks.captions ?? [];
  for (const track of captionTracks) {
    const segments = track.segments ?? [];
    for (let i = 0; i < segments.length - 1; i += 1) {
      const curr = segments[i];
      const next = segments[i + 1];
      if (curr.endMs > next.startMs) {
        issues.push({
          code: "CAPTION_OVERLAP",
          track: "captions",
          itemIds: [curr.id, next.id],
          severity: "error",
          message: "Caption segments cannot overlap.",
        });
      }
    }
  }

  return issues;
}

export function normalizeTimelineForPersistence(
  timeline: TimelinePayload,
): TimelinePayload {
  const durationMs = Math.min(timeline.durationMs, 180_000);
  const captions = (timeline.tracks.captions ?? []).map(
    (track: Record<string, unknown>) => {
      const rawSegments = Array.isArray(track.segments)
        ? (track.segments as Array<Record<string, unknown>>)
        : [];
      const segments = rawSegments.map((segment) => {
        const startMs = Math.min(
          durationMs,
          Math.max(0, Number(segment.startMs ?? 0)),
        );
        const endMs = Math.min(
          durationMs,
          Math.max(startMs, Number(segment.endMs ?? startMs)),
        );
        return {
          ...segment,
          startMs,
          endMs,
        };
      });
      return {
        ...track,
        segments,
      };
    },
  );

  return {
    ...timeline,
    durationMs,
    tracks: {
      ...timeline.tracks,
      captions,
    },
  };
}
