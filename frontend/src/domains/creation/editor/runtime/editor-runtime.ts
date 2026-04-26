import type { ProjectFile } from "@contentai/editor-core/storage";
import type { Project } from "@contentai/editor-core/types";
import type { EditProject } from "../model/editor-domain";
import {
  buildCoreProjectFileFromEditProject,
  buildCoreProjectFileFromEditorSnapshot,
} from "../bridge/project-adapter";

type RuntimeListener = () => void;

type RuntimeSnapshot = {
  projectFile: ProjectFile | null;
  project: Project | null;
  updatedAt: number;
};

type EditorStateSnapshot = {
  editProjectId: string | null;
  title: string;
  durationMs: number;
  fps: number;
  resolution: string;
  createdAt: string;
  tracks: EditProject["tracks"];
};

class EditorRuntime {
  private snapshot: RuntimeSnapshot = {
    projectFile: null,
    project: null,
    updatedAt: Date.now(),
  };

  private listeners = new Set<RuntimeListener>();

  loadProject(project: EditProject): void {
    const projectFile = buildCoreProjectFileFromEditProject(project);
    this.setProjectFile(projectFile);
  }

  syncFromEditorState(state: EditorStateSnapshot): void {
    if (!state.editProjectId) {
      this.reset();
      return;
    }

    const projectFile = buildCoreProjectFileFromEditorSnapshot({
      id: state.editProjectId,
      title: state.title,
      fps: state.fps,
      resolution: state.resolution,
      durationMs: state.durationMs,
      createdAt: state.createdAt,
      tracks: state.tracks,
    });

    this.setProjectFile(projectFile);
  }

  getSnapshot = (): RuntimeSnapshot => this.snapshot;

  subscribe = (listener: RuntimeListener): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  drawPreviewFrame(
    canvas: HTMLCanvasElement,
    resolution: string,
    currentTimeMs: number,
  ): void {
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width * window.devicePixelRatio));
    const height = Math.max(1, Math.round(rect.height * window.devicePixelRatio));

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.save();
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    const cssWidth = rect.width || width / window.devicePixelRatio;
    const cssHeight = rect.height || height / window.devicePixelRatio;

    ctx.clearRect(0, 0, cssWidth, cssHeight);

    const gradient = ctx.createLinearGradient(0, 0, 0, cssHeight);
    gradient.addColorStop(0, "rgba(167,139,250,0.22)");
    gradient.addColorStop(1, "rgba(12,12,16,0.94)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, cssWidth, cssHeight);

    const radial = ctx.createRadialGradient(
      cssWidth * 0.5,
      cssHeight * 0.35,
      10,
      cssWidth * 0.5,
      cssHeight * 0.35,
      cssWidth * 0.5,
    );
    radial.addColorStop(0, "rgba(255,255,255,0.14)");
    radial.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = radial;
    ctx.fillRect(0, 0, cssWidth, cssHeight);

    const project = this.snapshot.project;
    const trackCount = project?.timeline.tracks.length ?? 0;
    const clipCount =
      project?.timeline.tracks.reduce(
        (count, track) => count + track.clips.length,
        0,
      ) ?? 0;
    const durationMs = Math.round((project?.timeline.duration ?? 0) * 1000);

    ctx.fillStyle = "rgba(255,255,255,0.82)";
    ctx.font = "600 14px Inter, sans-serif";
    ctx.fillText(project?.name ?? "Editor runtime not loaded", 24, 36);

    ctx.fillStyle = "rgba(255,255,255,0.56)";
    ctx.font = "12px Inter, sans-serif";
    ctx.fillText(`Core project: ${resolution}`, 24, 60);
    ctx.fillText(`Tracks: ${trackCount}   Clips: ${clipCount}`, 24, 80);

    const timelineWidth = Math.max(120, cssWidth - 48);
    const timelineY = cssHeight - 42;
    ctx.fillStyle = "rgba(255,255,255,0.14)";
    ctx.fillRect(24, timelineY, timelineWidth, 6);

    const progress = durationMs > 0 ? Math.min(1, currentTimeMs / durationMs) : 0;
    ctx.fillStyle = "#8b5cf6";
    ctx.fillRect(24, timelineY, timelineWidth * progress, 6);

    ctx.fillStyle = "rgba(255,255,255,0.68)";
    ctx.font = "11px monospace";
    ctx.fillText(
      `${formatTime(currentTimeMs)} / ${formatTime(durationMs)}`,
      24,
      timelineY - 8,
    );

    ctx.restore();
  }

  clearPreview(canvas: HTMLCanvasElement): void {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  reset(): void {
    this.snapshot = {
      projectFile: null,
      project: null,
      updatedAt: Date.now(),
    };
    this.emit();
  }

  private setProjectFile(projectFile: ProjectFile): void {
    this.snapshot = {
      projectFile,
      project: projectFile.project,
      updatedAt: Date.now(),
    };
    this.emit();
  }

  private emit(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }
}

let runtime: EditorRuntime | null = null;

export function getEditorRuntime(): EditorRuntime {
  if (!runtime) {
    runtime = new EditorRuntime();
  }
  return runtime;
}

export function disposeEditorRuntime(): void {
  runtime?.reset();
  runtime = null;
}

function formatTime(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
