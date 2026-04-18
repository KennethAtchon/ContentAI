import { ExportJobStatus } from './editor';

export interface EditorUIState {
    selectedClipId: string | null;
    exportJobId: string | null;
    exportStatus: ExportJobStatus | null;
}

