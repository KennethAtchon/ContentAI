import type { EditProject, Track } from "../model/editor-domain";
import { editorApi } from "./editor-api";

const AUTOSAVE_DEBOUNCE_MS = 2000;

export type EditorBridgeCallbacks = {
  onProjectLoaded: (project: EditProject) => void;
  onSaveRevisionUpdated: (saveRevision: number) => void;
  onSaveConflict: () => void;
  onLoadError: (error: Error) => void;
};

type PendingAutosaveState = {
  tracks: Track[];
  durationMs: number;
  title: string | null;
  fps: number;
  resolution: string;
  saveRevision: number;
  createdAt: string;
};

class EditorBridge {
  private callbacks: EditorBridgeCallbacks | null = null;
  private projectId: string | null = null;
  private pendingAutosaveTimer: ReturnType<typeof setTimeout> | null = null;
  private isSaving = false;
  private pendingState: PendingAutosaveState | null = null;

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

  notifyStateChanged(state: PendingAutosaveState): void {
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
        projectDocument: response.projectDocument,
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

    // Capture identity and callbacks before the first await. If dispose() or
    // initialize() runs while the request is in-flight, we detect the stale
    // response and discard it rather than routing it to the new project's callbacks.
    const capturedProjectId = this.projectId;
    const capturedCallbacks = this.callbacks;

    const state = this.pendingState;
    this.pendingState = null;
    this.isSaving = true;

    try {
      const doc = editorApi.buildProjectDocument(
        {
          id: capturedProjectId,
          title: state.title,
          fps: state.fps,
          resolution: state.resolution,
          existingCreatedAt: state.createdAt,
        },
        state.tracks,
        state.durationMs,
      );
      const result = await editorApi.autosave(capturedProjectId, {
        expectedSaveRevision: state.saveRevision,
        projectDocument: doc,
        title: state.title ?? undefined,
      });
      // Discard if the bridge has been re-initialized with a different project.
      if (this.projectId !== capturedProjectId) return;
      const pendingState = this.pendingState as PendingAutosaveState | null;
      if (pendingState !== null) {
        this.pendingState = {
          tracks: pendingState.tracks,
          durationMs: pendingState.durationMs,
          title: pendingState.title,
          fps: pendingState.fps,
          resolution: pendingState.resolution,
          saveRevision: result.saveRevision,
          createdAt: pendingState.createdAt,
        };
      }
      capturedCallbacks.onSaveRevisionUpdated(result.saveRevision);
    } catch (err) {
      if (this.projectId !== capturedProjectId) return;
      const status = (err as { status?: number }).status;
      if (status === 409) {
        capturedCallbacks.onSaveConflict();
      }
      // Non-conflict errors are silent — next autosave will retry
    } finally {
      this.isSaving = false;
      // If more state arrived while we were saving, reschedule
      if (this.pendingState && this.projectId === capturedProjectId) {
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
