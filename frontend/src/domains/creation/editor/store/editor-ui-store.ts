import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import type { ExportJobStatus } from "../model/editor-domain";

export interface EditorUIState {
  selectedClipId: string | null;
  exportModalOpen: boolean;
  exportJobId: string | null;
  exportStatus: ExportJobStatus | null;
  selectClip: (clipId: string | null) => void;
  openExportModal: () => void;
  closeExportModal: () => void;
  setExportJob: (jobId: string | null) => void;
  setExportStatus: (status: ExportJobStatus | null) => void;
  reset: () => void;
}

const DEFAULT_UI_STATE = {
  selectedClipId: null,
  exportModalOpen: false,
  exportJobId: null,
  exportStatus: null,
};

export const useEditorUIStore = create<EditorUIState>()(
  subscribeWithSelector((set) => ({
    ...DEFAULT_UI_STATE,

    selectClip: (clipId) => set({ selectedClipId: clipId }),

    openExportModal: () => set({ exportModalOpen: true }),

    closeExportModal: () =>
      set({
        exportModalOpen: false,
        exportJobId: null,
        exportStatus: null,
      }),

    setExportJob: (jobId) => set({ exportJobId: jobId }),

    setExportStatus: (status) => set({ exportStatus: status }),

    reset: () => set(DEFAULT_UI_STATE),
  })),
);
