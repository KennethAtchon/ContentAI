import type { Clip, EditorHistorySnapshot, Track } from "./editor-domain";

export interface EditorDocumentState {
  editProjectId: string | null;
  title: string;
  durationMs: number;
  fps: number;
  resolution: string;
  tracks: Track[];
  clipboardClip: Clip | null;
  clipboardSourceTrackId: string | null;
  past: EditorHistorySnapshot[];
  future: EditorHistorySnapshot[];
  isReadOnly: boolean;
}
