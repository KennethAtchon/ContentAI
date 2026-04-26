import { authenticatedFetchJson } from "@/shared/api/authenticated-fetch";
import type { ExportJobStatus, Track } from "../model/editor-domain";
import {
  type PersistedProjectFile,
  buildPersistedProjectFileFromEditorSnapshot,
} from "./project-adapter";

export interface ProjectApiResponse {
  id: string;
  userId: string;
  title: string | null;
  generatedContentId: number | null;
  projectDocument: PersistedProjectFile | null;
  saveRevision: number;
  fps: number;
  resolution: string;
  durationMs: number;
  status: "draft" | "published";
  publishedAt: string | null;
  parentProjectId: string | null;
  createdAt: string;
  updatedAt: string;
  thumbnailUrl?: string | null;
  generatedHook?: string | null;
  postCaption?: string | null;
  autoTitle?: boolean;
}

export interface AutosavePayload {
  expectedSaveRevision: number;
  projectDocument: PersistedProjectFile;
  title?: string;
}

export interface AutosaveResult {
  id: string;
  saveRevision: number;
  updatedAt: string;
}

export interface ProjectListItem {
  id: string;
  title: string | null;
  status: "draft" | "published";
  fps: number;
  resolution: string;
  durationMs: number;
  createdAt: string;
  updatedAt: string;
  thumbnailUrl?: string | null;
}

export const editorApi = {
  getProject(projectId: string): Promise<ProjectApiResponse> {
    return authenticatedFetchJson<ProjectApiResponse>(
      `/api/editor/${projectId}`,
    );
  },

  autosave(
    projectId: string,
    payload: AutosavePayload,
  ): Promise<AutosaveResult> {
    return authenticatedFetchJson<AutosaveResult>(`/api/editor/${projectId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },

  listProjects(): Promise<ProjectListItem[]> {
    return authenticatedFetchJson<ProjectListItem[]>("/api/editor");
  },

  startExport(
    projectId: string,
    opts: { resolution?: string; fps?: number },
  ): Promise<{ exportJobId: string; projectRevisionId: string }> {
    return authenticatedFetchJson(`/api/editor/${projectId}/export`, {
      method: "POST",
      body: JSON.stringify(opts),
    });
  },

  getExportStatus(projectId: string): Promise<ExportJobStatus> {
    return authenticatedFetchJson<ExportJobStatus>(
      `/api/editor/${projectId}/export/status`,
    );
  },

  extractTracks(response: ProjectApiResponse): Track[] {
    return response.projectDocument?.project?.timeline?.tracks ?? [];
  },

  buildProjectDocument(
    project: {
      id: string;
      title: string | null;
      fps: number;
      resolution: string;
      existingCreatedAt?: string;
    },
    tracks: Track[],
    durationMs: number,
  ): PersistedProjectFile {
    return buildPersistedProjectFileFromEditorSnapshot({
      id: project.id,
      title: project.title,
      fps: project.fps,
      resolution: project.resolution,
      durationMs,
      createdAt: project.existingCreatedAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tracks,
    });
  },
};
