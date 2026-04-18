import { EditorHistorySnapshot, Track, Clip  } from "./editor";

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