import type { TransitionType } from "./effects";
import type { EmphasisAnimation } from "../graphics/types";
import { NumberSchema } from "firebase/ai";

// The single automatic state for the timeline
export interface Timeline {
    readonly tracks: Track[];
    readonly subtitles: Subtitle[];
    readonly duration: number;
    readonly markers: Marker[];
    readonly beatMarkers?: TimelineBeatMarker[];
    readonly beatAnalysis?: TimelineBeatAnalysis;
}

export interface TimelineBeatMarker {
    readonly time: number;
    readonly strength: number;
    readonly index: number;
    readonly isDownbeat: boolean;
}

export interface TimelineBeatAnalysis {
    readonly bpm: number;
    readonly confidence: number;
    readonly sourceClipId?: string,
    readonly analyzedAt: number;
}

export interface Track {
    
}
