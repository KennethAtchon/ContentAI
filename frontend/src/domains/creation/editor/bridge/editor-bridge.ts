import type { EditProject, Track } from "../model/editor-domain";
import { editorApi } from "./editor-api";

const AUTOSAVE_DEBOUNCE_MS = 2000;

export type EditorBridgeCallbacks = {
  onProjectLoaded: (project: EditProject) => void;
  onSaveRevisionUpdated: (saveRevision: number) => void;
  onSaveConflict: () => void;
  onLoadError: (error: Error) => void;
};

class EditorBridge {
  private callbacks: EditorBridgeCallbacks | null = null;
  private projectId: string | null = null;
  private pendingAutosaveTimer: ReturnType<typeof setTimeout> | null = null;
  private isSaving = false;
  private pendingState: {
    tracks: Track[];
    durationMs: number;
    title: string | null;
    fps: number;
    resolution: string;
    saveRevision: number;
  } | null = null;

  initialize(projectId: string, callbacks: EditorBridgeCallbacks): void {
    this.dispose();
    this.projectId = projectId;
    this.callbacks = callbacks;
    void this.loadProject(projectId);
  }

  dispose(): void {
    if (this.pendingAutosaveTimer !== null) {
      clearTimeout(this.pendingAutosaveTimer);
      this.pendingAutosaveTimer = null;
    }
    this.projectId = null;
    this.callbacks = null;
    this.pendingState = null;
    this.isSaving = false;
  }

  notifyStateChanged(state: {
    tracks: Track[];
    durationMs: number;
    title: string | null;
    fps: number;
    resolution: string;
    saveRevision: number;
  }): void {
    if (!this.projectId || !this.callbacks) return;
    this.pendingState = state;
    this.scheduleAutosave();
  }

  private async loadProject(projectId: string): Promise<void> {
    try {
      const response = await editorApi.getProject(projectId);
      const project: EditProject = {
        id: response.id,
        userId: response.userId,
        title: response.title,
        generatedContentId: response.generatedContentId,
        tracks: editorApi.extractTracks(response),
        durationMs: response.durationMs,
        fps: response.fps,
        resolution: response.resolution,
        saveRevision: response.saveRevision,
        status: response.status,
        publishedAt: response.publishedAt,
        parentProjectId: response.parentProjectId,
        createdAt: response.createdAt,
        updatedAt: response.updatedAt,
        thumbnailUrl: response.thumbnailUrl,
        generatedHook: response.generatedHook,
        postCaption: response.postCaption,
        autoTitle: response.autoTitle,
      };
      this.callbacks?.onProjectLoaded(project);
    } catch (err) {
      this.callbacks?.onLoadError(
        err instanceof Error ? err : new Error(String(err)),
      );
    }
  }

  private scheduleAutosave(): void {
    if (this.pendingAutosaveTimer !== null) {
      clearTimeout(this.pendingAutosaveTimer);
    }
    this.pendingAutosaveTimer = setTimeout(() => {
      this.pendingAutosaveTimer = null;
      void this.flushAutosave();
    }, AUTOSAVE_DEBOUNCE_MS);
  }

  private async flushAutosave(): Promise<void> {
    if (!this.projectId || !this.callbacks || !this.pendingState || this.isSaving) return;

    const state = this.pendingState;
    this.pendingState = null;
    this.isSaving = true;

    try {
      const doc = editorApi.buildProjectDocument(
        { id: this.projectId, title: state.title, fps: state.fps, resolution: state.resolution },
        state.tracks,
        state.durationMs,
      );
      const result = await editorApi.autosave(this.projectId, {
        expectedSaveRevision: state.saveRevision,
        projectDocument: doc,
        title: state.title ?? undefined,
      });
      this.callbacks?.onSaveRevisionUpdated(result.saveRevision);
    } catch (err) {
      const status = (err as { status?: number }).status;
      if (status === 409) {
        this.callbacks?.onSaveConflict();
      }
      // Non-conflict errors are silent — next autosave will retry
    } finally {
      this.isSaving = false;
      // If more state arrived while we were saving, reschedule
      if (this.pendingState) {
        this.scheduleAutosave();
      }
    }
  }
}

let instance: EditorBridge | null = null;

export function getEditorBridge(): EditorBridge {
  if (!instance) instance = new EditorBridge();
  return instance;
}

export function disposeEditorBridge(): void {
  instance?.dispose();
  instance = null;
}
