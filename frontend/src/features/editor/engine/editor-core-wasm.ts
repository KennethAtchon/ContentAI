import type { Track } from "../types/editor";
import { systemPerformance } from "@/shared/utils/system/performance";
import type { CompositorClipDescriptor } from "./CompositorWorker";
import type { EffectPreviewPatch } from "./PreviewEngine";

export interface FrameRequest {
  clipId: string;
  assetId?: unknown;
  sourceTimeMs: number;
}

export interface ExportFrameRequest {
  frameIndex: number;
  timelineMs: number;
  requests: FrameRequest[];
}

interface EditorCoreWasmModule {
  default?: (moduleOrPath?: unknown) => Promise<unknown>;
  compute_duration(tracks: Track[]): number;
  resolve_frame(tracks: Track[], playheadMs: number): FrameRequest | null;
  build_compositor_descriptors(
    tracks: Track[],
    playheadMs: number,
    effectPreview: EffectPreviewPatch | null
  ): CompositorClipDescriptor[];
  sanitize_no_overlap(tracks: Track[]): Track[];
  build_export_frame_requests(
    tracks: Track[],
    durationMs: number,
    fps: number
  ): ExportFrameRequest[];
}

let editorCoreModule: EditorCoreWasmModule | null = null;
let editorCoreLoadPromise: Promise<void> | null = null;
const EDITOR_CORE_WASM_URL = "../wasm/editor_core.js";
const EDITOR_CORE_WASM_BINARY_URL = "../wasm/editor_core_bg.wasm";

type EditorCoreRuntimeMode = "pending" | "rust" | "fallback";

async function getBunWasmBytesForTests(): Promise<Uint8Array | undefined> {
  const bun = (
    globalThis as {
      Bun?: {
        file(path: URL): { arrayBuffer(): Promise<ArrayBuffer> };
      };
    }
  ).Bun;
  if (!bun) return undefined;

  const buffer = await bun
    .file(new URL(EDITOR_CORE_WASM_BINARY_URL, import.meta.url))
    .arrayBuffer();
  return new Uint8Array(buffer);
}

function setEditorCoreDebugValue(
  mode: EditorCoreRuntimeMode,
  detail: Record<string, unknown> = {}
): void {
  systemPerformance.setDebugValue("editorCoreWasm", {
    mode,
    moduleUrl: EDITOR_CORE_WASM_URL,
    ...detail,
  });
}

export function preloadEditorCoreWasm(): Promise<void> {
  if (editorCoreModule) return Promise.resolve();
  if (editorCoreLoadPromise) return editorCoreLoadPromise;

  setEditorCoreDebugValue("pending");
  editorCoreLoadPromise = import("../wasm/editor_core.js")
    .then(async (module: EditorCoreWasmModule) => {
      if (typeof module.default === "function") {
        await module.default(await getBunWasmBytesForTests());
      }
      editorCoreModule = module;
      setEditorCoreDebugValue("rust");
    })
    .catch((error) => {
      editorCoreModule = null;
      setEditorCoreDebugValue("fallback", {
        reason: error instanceof Error ? error.message : String(error),
      });
      throw error;
    });

  return editorCoreLoadPromise;
}

function requireEditorCoreModule(): EditorCoreWasmModule {
  if (!editorCoreModule) {
    throw new Error(
      "editor-core WASM is not loaded. Run `bun run editor-core:build` before starting the frontend."
    );
  }
  return editorCoreModule;
}

export function isEditorCoreWasmLoaded(): boolean {
  return editorCoreModule != null;
}

export function computeDurationWithRust(tracks: Track[]): number {
  return requireEditorCoreModule().compute_duration(tracks);
}

export function resolveFrameWithRust(
  tracks: Track[],
  playheadMs: number
): FrameRequest | null {
  return requireEditorCoreModule().resolve_frame(tracks, playheadMs);
}

export function sanitizeNoOverlapWithRust(tracks: Track[]): Track[] {
  return requireEditorCoreModule().sanitize_no_overlap(tracks);
}

export function buildCompositorDescriptorsWithRust(
  tracks: Track[],
  playheadMs: number,
  effectPreview: EffectPreviewPatch | null
): CompositorClipDescriptor[] {
  try {
    const descriptors = requireEditorCoreModule().build_compositor_descriptors(
      tracks,
      playheadMs,
      effectPreview
    );
    if (Array.isArray(descriptors)) return descriptors;
  } catch (error) {
    editorCoreModule = null;
    setEditorCoreDebugValue("fallback", {
      reason: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }

  throw new Error(
    "editor-core WASM returned an invalid compositor descriptor list."
  );
}

export function buildExportFrameRequestsWithRust(
  tracks: Track[],
  durationMs: number,
  fps: number
): ExportFrameRequest[] {
  const requests = requireEditorCoreModule().build_export_frame_requests(
    tracks,
    durationMs,
    fps
  );
  if (Array.isArray(requests)) return requests;

  throw new Error(
    "editor-core WASM returned an invalid export frame request list."
  );
}
