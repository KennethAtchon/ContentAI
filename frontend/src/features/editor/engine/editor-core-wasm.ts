import type { Track } from "../types/editor";
import { systemPerformance } from "@/shared/utils/system/performance";
import type { CompositorClipDescriptor } from "./CompositorWorker";
import type { EffectPreviewPatch } from "./PreviewEngine";

interface EditorCoreWasmModule {
  default?: () => Promise<void>;
  build_compositor_descriptors(
    tracks: Track[],
    playheadMs: number,
    effectPreview: EffectPreviewPatch | null
  ): CompositorClipDescriptor[];
}

let editorCoreModule: EditorCoreWasmModule | null = null;
let editorCoreLoadPromise: Promise<void> | null = null;
const EDITOR_CORE_WASM_URL = "../wasm/editor_core.js";

type EditorCoreRuntimeMode = "pending" | "rust" | "fallback";

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
  editorCoreLoadPromise = import(/* @vite-ignore */ EDITOR_CORE_WASM_URL)
    .then(async (module: EditorCoreWasmModule) => {
      if (typeof module.default === "function") {
        await module.default();
      }
      editorCoreModule = module;
      setEditorCoreDebugValue("rust");
    })
    .catch((error) => {
      editorCoreModule = null;
      setEditorCoreDebugValue("fallback", {
        reason: error instanceof Error ? error.message : String(error),
      });
    });

  return editorCoreLoadPromise;
}

export function buildCompositorDescriptorsWithRustFallback(
  tracks: Track[],
  playheadMs: number,
  effectPreview: EffectPreviewPatch | null,
  fallback: () => CompositorClipDescriptor[]
): CompositorClipDescriptor[] {
  if (!editorCoreModule) {
    setEditorCoreDebugValue("fallback", { reason: "module-not-loaded" });
    return fallback();
  }

  try {
    const descriptors = editorCoreModule.build_compositor_descriptors(
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
  }

  return fallback();
}
