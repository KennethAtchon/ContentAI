import type { EditorDocumentState } from "./editor-document";
import type { EditorPlaybackState } from "./editor-playback";
import type { EditorUIState } from "./editor-ui";
import type {
  CaptionStyleOverrides,
  Clip,
  ClipPatch,
  EditProject,
  ExportJobStatus,
  Track,
  Transition,
} from "./editor-domain";

export * from "./editor-domain";

export type EditorState = EditorDocumentState &
  EditorPlaybackState &
  EditorUIState;

export type EditorAction =
  | { type: "LOAD_PROJECT"; project: EditProject }
  | { type: "SET_TITLE"; title: string }
  | { type: "SET_RESOLUTION"; resolution: string }
  | { type: "SET_FPS"; fps: 24 | 25 | 30 | 60 }
  | { type: "SET_CURRENT_TIME"; ms: number }
  | { type: "SET_PLAYING"; playing: boolean }
  | { type: "SET_PLAYBACK_RATE"; rate: number }
  | { type: "SET_ZOOM"; zoom: number }
  | { type: "SELECT_CLIP"; clipId: string | null }
  | { type: "ADD_CLIP"; trackId: string; clip: Clip }
  | {
      type: "ADD_CLIP_AUTO_PROMOTE";
      preferredTrackId: string;
      clip: Clip;
    }
  | {
      type: "ADD_CAPTION_CLIP";
      trackId: string;
      captionDocId: string;
      originVoiceoverClipId: string | null;
      startMs: number;
      durationMs: number;
      sourceStartMs: number;
      sourceEndMs: number;
      presetId: string;
      groupingMs?: number;
    }
  | { type: "UPDATE_CLIP"; clipId: string; patch: ClipPatch }
  | {
      type: "UPDATE_CAPTION_STYLE";
      clipId: string;
      presetId?: string;
      overrides?: CaptionStyleOverrides;
      groupingMs?: number;
    }
  | { type: "REMOVE_CLIP"; clipId: string }
  | { type: "RIPPLE_DELETE_CLIP"; clipId: string }
  | { type: "SPLIT_CLIP"; clipId: string; atMs: number }
  | { type: "DUPLICATE_CLIP"; clipId: string }
  | { type: "COPY_CLIP"; clipId: string }
  | { type: "PASTE_CLIP"; trackId: string; startMs: number }
  | { type: "TOGGLE_CLIP_ENABLED"; clipId: string }
  | { type: "MOVE_CLIP"; clipId: string; startMs: number }
  | { type: "TOGGLE_TRACK_MUTE"; trackId: string }
  | { type: "TOGGLE_TRACK_LOCK"; trackId: string }
  | { type: "UNDO" }
  | { type: "REDO" }
  | { type: "SET_EXPORT_JOB"; jobId: string | null }
  | { type: "SET_EXPORT_STATUS"; status: ExportJobStatus | null }
  | {
      type: "SET_TRANSITION";
      trackId: string;
      clipAId: string;
      clipBId: string;
      transitionType: Transition["type"];
      durationMs: number;
    }
  | { type: "REMOVE_TRANSITION"; trackId: string; transitionId: string }
  | { type: "REORDER_SHOTS"; trackId: string; clipIds: string[] }
  | { type: "ADD_TRACK"; track: Track; afterTrackId?: string }
  | { type: "ADD_VIDEO_TRACK"; afterTrackId: string }
  | { type: "REMOVE_TRACK"; trackId: string }
  | { type: "RENAME_TRACK"; trackId: string; name: string }
  | { type: "REORDER_TRACKS"; trackIds: string[] }
  | { type: "MERGE_TRACKS_FROM_SERVER"; tracks: Track[] }
  | {
      type: "MARK_CAPTION_STALE";
      clipId: string;
      reason:
        | "voiceover-trim-changed"
        | "voiceover-asset-replaced"
        | "voiceover-deleted";
    };
