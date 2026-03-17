import type { Timeline } from "../types/composition.types";

export function clampDuration(ms: number): number {
  return Math.max(500, ms);
}

export function normalizeTimeline(timeline: Timeline): Timeline {
  const nextVideo = timeline.tracks.video.map((item) => ({ ...item }));
  let cursor = 0;
  for (const item of nextVideo) {
    const duration = clampDuration(item.endMs - item.startMs);
    item.startMs = cursor;
    item.endMs = cursor + duration;
    if (
      typeof item.trimStartMs === "number" &&
      typeof item.trimEndMs === "number"
    ) {
      const trimSpan = item.trimEndMs - item.trimStartMs;
      item.trimEndMs = item.trimStartMs + clampDuration(trimSpan);
    }
    cursor = item.endMs;
  }

  const durationMs = Math.max(cursor, 1000);
  const nextAudio = timeline.tracks.audio.map((item) => ({
    ...item,
    startMs: Math.min(item.startMs, durationMs),
    endMs: durationMs,
  }));

  return {
    ...timeline,
    durationMs,
    tracks: {
      ...timeline.tracks,
      video: nextVideo,
      audio: nextAudio,
    },
  };
}

export function reorderVideoItems(
  timeline: Timeline,
  fromIndex: number,
  toIndex: number,
): Timeline {
  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= timeline.tracks.video.length ||
    toIndex >= timeline.tracks.video.length ||
    fromIndex === toIndex
  ) {
    return timeline;
  }

  const nextVideo = timeline.tracks.video.map((item) => ({ ...item }));
  const [moved] = nextVideo.splice(fromIndex, 1);
  nextVideo.splice(toIndex, 0, moved);

  return normalizeTimeline({
    ...timeline,
    tracks: {
      ...timeline.tracks,
      video: nextVideo,
    },
  });
}

export function setVideoItemDuration(
  timeline: Timeline,
  index: number,
  durationMs: number,
): Timeline {
  if (index < 0 || index >= timeline.tracks.video.length) return timeline;
  const nextVideo = timeline.tracks.video.map((item, idx) =>
    idx === index
      ? {
          ...item,
          endMs: item.startMs + clampDuration(durationMs),
        }
      : { ...item },
  );

  return normalizeTimeline({
    ...timeline,
    tracks: {
      ...timeline.tracks,
      video: nextVideo,
    },
  });
}

export function splitVideoItemAt(
  timeline: Timeline,
  clipId: string,
  splitOffsetMs?: number,
): Timeline {
  const index = timeline.tracks.video.findIndex((item) => item.id === clipId);
  if (index < 0) return timeline;

  const current = timeline.tracks.video[index];
  const duration = current.endMs - current.startMs;
  if (duration < 1000) return timeline;
  const splitAt = Math.min(
    Math.max(splitOffsetMs ?? Math.round(duration / 2), 300),
    duration - 300,
  );

  const first = {
    ...current,
    id: `${current.id}-a-${Date.now()}`,
    endMs: current.startMs + splitAt,
  };
  const second = {
    ...current,
    id: `${current.id}-b-${Date.now()}`,
    startMs: current.startMs + splitAt,
    endMs: current.endMs,
  };

  const nextVideo = timeline.tracks.video.map((item) => ({ ...item }));
  nextVideo.splice(index, 1, first, second);

  return normalizeTimeline({
    ...timeline,
    tracks: {
      ...timeline.tracks,
      video: nextVideo,
    },
  });
}
