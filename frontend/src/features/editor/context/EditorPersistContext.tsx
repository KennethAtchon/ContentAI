import { createContext, useContext } from "react";
import type { SaveService } from "../services/save-service";

export interface EditorPersistContextValue {
  isDirty: boolean;
  isSavingPatch: boolean;
  lastSavedAt: Date | null;
  saveService: SaveService;
}

export const EditorPersistContext = createContext<EditorPersistContextValue | null>(null);

export function useEditorPersistContext(): EditorPersistContextValue {
  const ctx = useContext(EditorPersistContext);
  if (!ctx) throw new Error("useEditorPersistContext must be used inside EditorProviders");
  return ctx;
}
