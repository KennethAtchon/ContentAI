export interface Token {
  text: string;
  startMs: number;
  endMs: number;
}

export interface PageToken {
  text: string;
  startMs: number;
  endMs: number;
  index: number;
  state: "upcoming" | "active" | "past";
}

export interface CaptionPage {
  startMs: number;
  endMs: number;
  tokens: Array<Omit<PageToken, "state">>;
  text: string;
}

export interface PositionedToken {
  text: string;
  startMs: number;
  endMs: number;
  index: number;
  x: number;
  y: number;
  width: number;
  lineIndex: number;
}

export interface CaptionLayout {
  page: CaptionPage;
  preset: TextPreset;
  tokens: PositionedToken[];
  blockX: number;
  blockY: number;
  blockWidth: number;
  blockHeight: number;
  lineHeightPx: number;
  lineCount: number;
  canvasW: number;
  canvasH: number;
}

export type ExportMode = "full" | "approximate" | "static";

export interface Typography {
  fontFamily: string;
  fontWeight: number;
  fontSize: number;
  textTransform: "none" | "uppercase" | "lowercase";
  letterSpacing: number;
  lineHeight: number;
  fontUrl?: string;
}

export interface FillLayer {
  id: string;
  type: "fill";
  color: string;
  stateColors?: {
    upcoming?: string;
    active?: string;
    past?: string;
  };
}

export interface StrokeLayer {
  id: string;
  type: "stroke";
  color: string;
  width: number;
  join: "round" | "bevel" | "miter";
  stateColors?: {
    upcoming?: string;
    active?: string;
    past?: string;
  };
}

export interface ShadowLayer {
  id: string;
  type: "shadow";
  color: string;
  offsetX?: number;
  offsetY?: number;
  blur?: number;
}

export interface BackgroundLayer {
  id: string;
  type: "background";
  color: string;
  padding?: number;
  radius?: number;
  mode?: "line" | "word";
  stateColors?: {
    upcoming?: string;
    active?: string;
    past?: string;
  };
}

export interface GlowLayer {
  id: string;
  type: "glow";
  color: string;
  blur: number;
}

export type StyleLayer =
  | FillLayer
  | StrokeLayer
  | ShadowLayer
  | BackgroundLayer
  | GlowLayer;

export type EasingFunction =
  | { type: "linear" }
  | { type: "ease-in" | "ease-out" | "ease-in-out"; power: number }
  | { type: "cubic-bezier"; x1: number; y1: number; x2: number; y2: number }
  | { type: "spring"; stiffness: number; damping: number; mass: number };

export interface AnimationDef {
  scope: "page" | "word" | "char";
  property: "opacity" | "scale" | "translateX" | "translateY" | "rotation" | "letterSpacing";
  from: number;
  to: number;
  durationMs: number;
  easing: EasingFunction;
  staggerMs?: number;
}

export interface LayerOverridePatch {
  layerId: string;
  color?: string;
  width?: number;
  join?: StrokeLayer["join"];
  offsetX?: number;
  offsetY?: number;
  blur?: number;
  padding?: number;
  radius?: number;
  mode?: BackgroundLayer["mode"];
  stateColors?: {
    upcoming?: string;
    active?: string;
    past?: string;
  };
}

export interface WordActivationEffect {
  layerOverrides?: LayerOverridePatch[];
  scalePulse?: {
    from: number;
    durationMs: number;
    easing: EasingFunction;
  };
}

export interface PresetLayout {
  alignment: "left" | "center" | "right";
  maxWidthPercent: number;
  positionY: number;
}

export interface TextPreset {
  id: string;
  name: string;
  typography: Typography;
  layers: StyleLayer[];
  layout: PresetLayout;
  entryAnimation: AnimationDef[] | null;
  exitAnimation: AnimationDef[] | null;
  wordActivation: WordActivationEffect | null;
  groupingMs: number;
  exportMode: ExportMode;
}

export interface CaptionDoc {
  captionDocId: string;
  tokens: Token[];
  fullText: string;
  language: "en";
  source: "whisper" | "manual" | "import";
}
