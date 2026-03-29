import { and, eq, inArray } from "drizzle-orm";
import { assets, contentAssets } from "../../infrastructure/database/drizzle/schema";
import { db } from "../../services/db/db";
import type { TimelinePayload } from "./schemas";

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
  }

  if (input.timeline.durationMs > 180_000) {
    issues.push({
      code: "DURATION_LIMIT_EXCEEDED",
      track: "timeline",
      itemIds: [],
      severity: "error",
      message: `Duration exceeds 180_000ms product limit.`,
    });
  }

  const laneGroups = new Map<number, typeof videoItems>();
  for (const item of videoItems) {
    const lane = item.lane ?? 0;
    const laneItems = laneGroups.get(lane) ?? [];
    laneItems.push(item);
    laneGroups.set(lane, laneItems);
  }
  for (const [lane, items] of laneGroups.entries()) {
    if (hasTrackOverlap(items)) {
      issues.push({
        code: "OVERLAPPING_VIDEO_SEGMENTS",
        track: "video",
        itemIds: items.map((it) => it.id),
        severity: "error",
        message: `Video segments overlap in lane ${lane}.`,
      });
    }

    const sorted = [...items].sort(
      (a, b) => a.startMs - b.startMs,
    );
    for (let i = 0; i < sorted.length; i += 1) {
      const item = sorted[i];
      const spanMs = Math.max(1, getItemSpanMs(item));
      if (
        spanMs < MIN_RECOMMENDED_CLIP_MS ||
        spanMs > MAX_RECOMMENDED_CLIP_MS
      ) {
        issues.push({
          code: "CLIP_PACING_WARNING",
          track: "video",
          itemIds: [item.id],
          severity: "warning",
          message: `Clip ${item.id} duration is outside recommended pacing range (${MIN_RECOMMENDED_CLIP_MS}-${MAX_RECOMMENDED_CLIP_MS}ms).`,
        });
      }

      const nextItem = sorted[i + 1];
      const transitions = [
        { key: "transitionIn" as const, value: item.transitionIn },
        { key: "transitionOut" as const, value: item.transitionOut },
      ];
      for (const transition of transitions) {
        const t = transition.value;
        if (!t) continue;
        if (t.type === "cut" && t.durationMs !== 0) {
          issues.push({
            code: "TRANSITION_DURATION_INVALID",
            track: "video",
            itemIds: [item.id],
            severity: "error",
            message: "Cut transitions must use 0ms duration.",
          });
          continue;
        }
        if (t.type !== "cut" && t.durationMs <= 0) {
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
        if (transition.key === "transitionOut" && nextItem) {
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
    const ownedAssets = await db
      .select({
        id: assets.id,
        type: assets.type,
      })
      .from(contentAssets)
      .innerJoin(assets, eq(contentAssets.assetId, assets.id))
      .where(
        and(
          eq(contentAssets.generatedContentId, input.generatedContentId),
          eq(assets.userId, input.userId),
          inArray(
            assets.id,
            refs.map((ref) => ref.assetId),
          ),
        ),
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
          message: `Asset type ${asset.type} is not valid for ${ref.track} track.`,
        });
      }
    }
  }

  const captionTracks = input.timeline.tracks.captions ?? [];
  for (const captionTrack of captionTracks) {
    const segmentsRaw = Array.isArray(captionTrack?.segments)
      ? (captionTrack.segments as Array<Record<string, unknown>>)
      : [];
    const normalized = segmentsRaw
      .map((segment) => ({
        id: String(segment.id ?? ""),
        startMs: Math.max(0, Number(segment.startMs ?? 0)),
        endMs: Math.max(0, Number(segment.endMs ?? 0)),
      }))
      .sort((a, b) => a.startMs - b.startMs);

    for (const segment of normalized) {
      if (segment.endMs <= segment.startMs) {
        issues.push({
          code: "CAPTION_INVALID_TIME_RANGE",
          track: "captions",
          itemIds: [segment.id].filter(Boolean),
          severity: "error",
          message: "Caption segment has invalid time range.",
        });
      }
      if (segment.startMs < 0 || segment.endMs > input.timeline.durationMs) {
        issues.push({
          code: "CAPTION_OUT_OF_BOUNDS",
          track: "captions",
          itemIds: [segment.id].filter(Boolean),
          severity: "error",
          message: "Caption segment must stay within duration.",
        });
      }
    }

    for (let i = 1; i < normalized.length; i += 1) {
      if (normalized[i].startMs < normalized[i - 1].endMs) {
        issues.push({
          code: "CAPTION_OVERLAP",
          track: "captions",
          itemIds: [normalized[i - 1].id, normalized[i].id].filter(Boolean),
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
