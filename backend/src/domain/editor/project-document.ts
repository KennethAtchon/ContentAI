import { createHash } from "crypto";
import type { TimelineTrackJson } from "./timeline/merge-placeholders-with-assets";

export const PERSISTED_DOCUMENT_VERSION = "1.0.0";

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
      tracks: TimelineTrackJson[];
      durationMs: number;
    };
    createdAt: string;
    modifiedAt: string;
  };
}

const DEFAULT_SETTINGS: PersistedProjectSettings = {
  width: 1080,
  height: 1920,
  frameRate: 30,
  sampleRate: 44100,
  channels: 2,
};

export function buildInitialProjectDocument(
  id: string,
  title: string,
  settings?: Partial<PersistedProjectSettings>,
): PersistedProjectFile {
  const now = new Date().toISOString();
  return {
    version: PERSISTED_DOCUMENT_VERSION,
    project: {
      id,
      title,
      settings: { ...DEFAULT_SETTINGS, ...settings },
      timeline: { tracks: [], durationMs: 0 },
      createdAt: now,
      modifiedAt: now,
    },
  };
}

export function applyTracksToDocument(
  existing: PersistedProjectFile | null | undefined,
  id: string,
  title: string,
  tracks: TimelineTrackJson[],
  durationMs: number,
): PersistedProjectFile {
  const now = new Date().toISOString();
  return {
    version: PERSISTED_DOCUMENT_VERSION,
    project: {
      id,
      title,
      settings: existing?.project?.settings ?? DEFAULT_SETTINGS,
      timeline: { tracks, durationMs },
      createdAt: existing?.project?.createdAt ?? now,
      modifiedAt: now,
    },
  };
}

export interface DerivedEnvelope {
  fps: number;
  resolution: string;
  durationMs: number;
  documentHash: string;
  projectDocumentVersion: string;
  editorCoreVersion: string;
}

export function deriveEnvelope(doc: PersistedProjectFile): DerivedEnvelope {
  const { settings, timeline } = doc.project;
  return {
    fps: settings.frameRate,
    resolution: `${settings.width}x${settings.height}`,
    durationMs: timeline.durationMs,
    documentHash: computeDocumentHash(doc),
    projectDocumentVersion: doc.version,
    editorCoreVersion: PERSISTED_DOCUMENT_VERSION,
  };
}

export function computeDocumentHash(doc: unknown): string {
  return createHash("sha256").update(JSON.stringify(doc)).digest("hex");
}
