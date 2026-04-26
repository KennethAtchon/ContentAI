import type { ProjectFile } from "@contentai/editor-core/storage";
import type {
  MediaItem,
  Track as CoreTrack,
  Clip as CoreClip,
  Transition as CoreTransition,
  TransitionType,
} from "@contentai/editor-core/types";
import type {
  Clip,
  EditProject,
  Track,
  Transition,
} from "../model/editor-domain";

export interface PersistedProjectSettings {
  width: number;
  height: number;
  frameRate: number;
  sampleRate: number;
  channels: number;
}

export interface PersistedProjectFile {
  version: string;
  project: {
    id: string;
    title: string;
    settings: PersistedProjectSettings;
    timeline: {
      tracks: Track[];
      durationMs: number;
    };
    createdAt?: string;
    modifiedAt?: string;
  };
}

export interface EditorProjectSnapshot {
  id: string;
  title: string | null;
  fps: number;
  resolution: string;
  durationMs: number;
  createdAt: string;
  updatedAt?: string;
  tracks: Track[];
}

export function isPersistedProjectFile(
  value: unknown,
): value is PersistedProjectFile {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<PersistedProjectFile>;
  return (
    typeof candidate.version === "string" &&
    !!candidate.project &&
    typeof candidate.project === "object" &&
    typeof candidate.project.id === "string"
  );
}

export function buildPersistedProjectFileFromEditorSnapshot(
  project: EditorProjectSnapshot,
): PersistedProjectFile {
  const [widthStr, heightStr] = (project.resolution ?? "1080x1920").split("x");
  const width = parseInt(widthStr ?? "1080", 10);
  const height = parseInt(heightStr ?? "1920", 10);
  const now = new Date().toISOString();

  return {
    version: "1.0.0",
    project: {
      id: project.id,
      title: project.title ?? "Untitled Edit",
      settings: {
        width,
        height,
        frameRate: project.fps,
        sampleRate: 44100,
        channels: 2,
      },
      timeline: {
        tracks: project.tracks,
        durationMs: project.durationMs,
      },
      createdAt: project.createdAt || now,
      modifiedAt: project.updatedAt || now,
    },
  };
}

export function buildCoreProjectFileFromEditorSnapshot(
  project: EditorProjectSnapshot,
  persistedOverride?: PersistedProjectFile | null,
): ProjectFile {
  const persisted =
    persistedOverride ?? buildPersistedProjectFileFromEditorSnapshot(project);
  const settings = persisted.project.settings;
  const createdAt = persisted.project.createdAt ?? project.createdAt;
  const modifiedAt = persisted.project.modifiedAt ?? project.updatedAt ?? createdAt;
  const tracks = persisted.project.timeline.tracks;

  return {
    version: persisted.version,
    project: {
      id: persisted.project.id,
      name: project.title ?? persisted.project.title ?? "Untitled Edit",
      createdAt: toTimestamp(createdAt),
      modifiedAt: toTimestamp(modifiedAt),
      settings: {
        width: settings.width,
        height: settings.height,
        frameRate: settings.frameRate,
        sampleRate: settings.sampleRate,
        channels: settings.channels,
      },
      mediaLibrary: {
        items: buildMediaLibraryItems(tracks, settings),
      },
      timeline: {
        tracks: tracks.map((track) => toCoreTrack(track)),
        subtitles: [],
        duration: persisted.project.timeline.durationMs / 1000,
        markers: [],
      },
    },
  };
}

export function buildCoreProjectFileFromEditProject(
  project: EditProject,
): ProjectFile {
  const snapshot: EditorProjectSnapshot = {
    id: project.id,
    title: project.title,
    fps: project.fps,
    resolution: project.resolution,
    durationMs: project.durationMs,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    tracks: project.tracks,
  };

  return buildCoreProjectFileFromEditorSnapshot(
    snapshot,
    isPersistedProjectFile(project.projectDocument)
      ? project.projectDocument
      : null,
  );
}

function buildMediaLibraryItems(
  tracks: Track[],
  settings: PersistedProjectSettings,
): MediaItem[] {
  const items = new Map<string, MediaItem>();

  for (const track of tracks) {
    for (const clip of track.clips) {
      if (clip.type === "text") {
        continue;
      }

      const mediaId = clip.assetId ?? `asset-${clip.id}`;
      if (items.has(mediaId)) {
        continue;
      }

      items.set(mediaId, {
        id: mediaId,
        name: clip.label,
        type: track.type === "video" ? "video" : "audio",
        fileHandle: null,
        blob: null,
        metadata: {
          duration: clip.durationMs / 1000,
          width: track.type === "video" ? settings.width : 0,
          height: track.type === "video" ? settings.height : 0,
          frameRate: track.type === "video" ? settings.frameRate : 0,
          codec: "unknown",
          sampleRate: settings.sampleRate,
          channels: settings.channels,
          fileSize: 0,
        },
        thumbnailUrl: null,
        waveformData: null,
        isPlaceholder: clip.isPlaceholder,
      });
    }
  }

  return [...items.values()];
}

function toCoreTrack(track: Track): CoreTrack {
  return {
    id: track.id,
    type: mapTrackType(track.type),
    name: track.name,
    clips: track.clips.map((clip) => toCoreClip(clip, track.id)),
    transitions: track.transitions
      .filter((transition) => transition.type !== "none")
      .map((transition) => toCoreTransition(transition)),
    locked: track.locked,
    hidden: false,
    muted: track.muted,
    solo: false,
  };
}

function toCoreClip(clip: Clip, trackId: string): CoreClip {
  const mediaId =
    clip.type === "text" ? `text-${clip.id}` : clip.assetId ?? `asset-${clip.id}`;
  const inPoint = clip.type === "text" ? 0 : clip.trimStartMs / 1000;
  const duration = clip.durationMs / 1000;

  return {
    id: clip.id,
    mediaId,
    trackId,
    startTime: clip.startMs / 1000,
    duration,
    inPoint,
    outPoint: inPoint + duration,
    effects: [],
    audioEffects: [],
    transform: {
      position: { x: clip.positionX, y: clip.positionY },
      scale: { x: clip.scale, y: clip.scale },
      rotation: clip.rotation,
      anchor: { x: 0.5, y: 0.5 },
      opacity: clip.opacity,
    },
    volume: "volume" in clip ? clip.volume : 1,
    keyframes: [],
    speed: clip.speed,
  };
}

function toCoreTransition(transition: Transition): CoreTransition {
  return {
    id: transition.id,
    clipAId: transition.clipAId,
    clipBId: transition.clipBId,
    type: mapTransitionType(transition),
    duration: transition.durationMs,
    params: buildTransitionParams(transition),
  };
}

function mapTrackType(trackType: Track["type"]): CoreTrack["type"] {
  switch (trackType) {
    case "video":
      return "video";
    case "text":
      return "text";
    case "audio":
    case "music":
      return "audio";
  }
}

function mapTransitionType(transition: Transition): TransitionType {
  switch (transition.type) {
    case "fade":
      return "crossfade";
    case "slide-left":
    case "slide-up":
      return "slide";
    case "wipe-right":
      return "wipe";
    case "dissolve":
      return "crossfade";
    case "none":
      return "crossfade";
  }
}

function buildTransitionParams(
  transition: Transition,
): Record<string, unknown> {
  switch (transition.type) {
    case "slide-left":
      return { direction: "left" };
    case "slide-up":
      return { direction: "up" };
    case "wipe-right":
      return { direction: "right", feather: 0 };
    default:
      return {};
  }
}

function toTimestamp(value: string): number {
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? Date.now() : timestamp;
}
