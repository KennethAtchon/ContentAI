import type { ExportJobStatus } from "./editor-domain";

export interface EditorUIState {
  selectedClipId: string | null;
  exportJobId: string | null;
  exportStatus: ExportJobStatus | null;
}
