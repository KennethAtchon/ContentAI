import { createContext, useContext } from "react";
import type { Clip } from "../types/editor";
import type { TabKey } from "../components/panels/LeftPanel";

export interface EditorUIContextValue {
  effectPreview: { clipId: string; patch: Partial<Clip> } | null;
  setEffectPreview: (value: { clipId: string; patch: Partial<Clip> } | null) => void;
  showExport: boolean;
  setShowExport: (show: boolean) => void;
  publishDialogOpen: boolean;
  setPublishDialogOpen: (open: boolean) => void;
  mediaActiveTab: TabKey;
  setMediaActiveTab: (tab: TabKey) => void;
  pendingAdd: { trackId: string; startMs: number } | null;
  setPendingAdd: (value: { trackId: string; startMs: number } | null) => void;
  selectedTransitionKey: [string, string, string] | null;
  setSelectedTransitionKey: (key: [string, string, string] | null) => void;
  scriptResetPending: unknown;
  onScriptIterationDialogOpenChange: (open: boolean) => void;
  confirmScriptIteration: () => void;
  isCapturingThumbnail: boolean;
  captureThumbnail: () => Promise<void>;
  isPublishing: boolean;
  isCreatingDraft: boolean;
  createNewDraft: () => void;
}

export const EditorUIContext = createContext<EditorUIContextValue | null>(null);

export function useEditorUIContext(): EditorUIContextValue {
  const ctx = useContext(EditorUIContext);
  if (!ctx) throw new Error("useEditorUIContext must be used inside EditorProviders");
  return ctx;
}
