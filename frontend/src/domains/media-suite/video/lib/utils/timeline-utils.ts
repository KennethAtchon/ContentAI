import type {
  Timeline,
  TimelineVideoItem,
} from "../../model/composition.types";

function clipDurationMs(clip: TimelineVideoItem): number {
  return Math.max(1, clip.endMs - clip.startMs);
}

/** Pack clips left-to-right preserving order and per-clip durations. */
function reflowVideoItems(clips: TimelineVideoItem[]): TimelineVideoItem[] {
  let cursor = 0;
  return clips.map((clip) => {
    const dur = clipDurationMs(clip);
    const startMs = cursor;
    const endMs = cursor + dur;
    cursor = endMs;
    return { ...clip, startMs, endMs };
  });
}

function endOfVideoTrack(clips: TimelineVideoItem[]): number {
  if (clips.length === 0) return 0;
  return clips[clips.length - 1]!.endMs;
}

export function reorderVideoItems(
  timeline: Timeline,
  fromIndex: number,
  toIndex: number
): Timeline {
  const video = [...timeline.tracks.video];
  const [moved] = video.splice(fromIndex, 1);
  if (!moved) return timeline;
  video.splice(toIndex, 0, moved);
  const reflowed = reflowVideoItems(video);
  return {
    ...timeline,
    tracks: { ...timeline.tracks, video: reflowed },
    durationMs: endOfVideoTrack(reflowed),
  };
}

export function setVideoItemDurationById(
  timeline: Timeline,
  id: string,
  newDurationMs: number
): Timeline {
  const idx = timeline.tracks.video.findIndex((c) => c.id === id);
  if (idx === -1) return timeline;

  const video = [...timeline.tracks.video];
  const target = video[idx]!;
  video[idx] = {
    ...target,
    endMs: target.startMs + Math.max(1, newDurationMs),
  };

  let cursor = video[idx]!.endMs;
  for (let i = idx + 1; i < video.length; i++) {
    const c = video[i]!;
    const dur = clipDurationMs(c);
    video[i] = { ...c, startMs: cursor, endMs: cursor + dur };
    cursor += dur;
  }

  return {
    ...timeline,
    tracks: { ...timeline.tracks, video },
    durationMs: cursor,
  };
}

export function splitVideoItemAt(timeline: Timeline, id: string): Timeline {
  const idx = timeline.tracks.video.findIndex((c) => c.id === id);
  if (idx === -1) return timeline;

  const c = timeline.tracks.video[idx]!;
  const mid = Math.floor((c.startMs + c.endMs) / 2);
  if (mid <= c.startMs || mid >= c.endMs) return timeline;

  const suffix = crypto.randomUUID().slice(0, 8);
  const first: TimelineVideoItem = {
    ...c,
    id: `${id}-a-${suffix}`,
    startMs: c.startMs,
    endMs: mid,
  };
  const second: TimelineVideoItem = {
    ...c,
    id: `${id}-b-${suffix}`,
    startMs: mid,
    endMs: c.endMs,
  };

  const video = [
    ...timeline.tracks.video.slice(0, idx),
    first,
    second,
    ...timeline.tracks.video.slice(idx + 1),
  ];

  return {
    ...timeline,
    tracks: { ...timeline.tracks, video },
    durationMs: endOfVideoTrack(video),
  };
}

export function insertVideoItemAt(
  timeline: Timeline,
  params: {
    insertAtIndex: number;
    assetId: string;
    durationMs: number;
  }
): Timeline {
  const { insertAtIndex, assetId, durationMs } = params;
  const dur = Math.max(1, durationMs);
  const newClip: TimelineVideoItem = {
    id: `clip-insert-${crypto.randomUUID().slice(0, 8)}`,
    startMs: 0,
    endMs: dur,
    assetId,
  };

  const video = [...timeline.tracks.video];
  const at = Math.max(0, Math.min(insertAtIndex, video.length));
  video.splice(at, 0, newClip);
  const reflowed = reflowVideoItems(video);

  return {
    ...timeline,
    tracks: { ...timeline.tracks, video: reflowed },
    durationMs: endOfVideoTrack(reflowed),
  };
}
