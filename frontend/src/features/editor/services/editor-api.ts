import { authenticatedFetchJson } from "@/shared/services/api/authenticated-fetch";
import type { EditProject, ExportJobStatus } from "../types/editor";
import type { PersistedTrack } from "../utils/strip-local-editor-fields";

export interface CreateProjectParams {
  title?: string;
  generatedContentId?: number;
}

export interface PatchProjectParams {
  title?: string;
  tracks?: PersistedTrack[];
  durationMs?: number;
  fps?: number;
  resolution?: string;
}

export async function listEditorProjects(): Promise<{
  projects: EditProject[];
}> {
  return authenticatedFetchJson<{ projects: EditProject[] }>("/api/editor");
}

export async function createEditorProject(
  params: CreateProjectParams
): Promise<{ project: EditProject }> {
  return authenticatedFetchJson<{ project: EditProject }>("/api/editor", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export async function getEditorProject(
  id: string
): Promise<{ project: EditProject }> {
  return authenticatedFetchJson<{ project: EditProject }>(`/api/editor/${id}`);
}

export async function patchEditorProject(
  id: string,
  params: PatchProjectParams
): Promise<{ id: string; updatedAt: string }> {
  return authenticatedFetchJson<{ id: string; updatedAt: string }>(
    `/api/editor/${id}`,
    {
      method: "PATCH",
      body: JSON.stringify(params),
    }
  );
}

export async function publishEditorProject(id: string): Promise<{
  id: string;
  status: string;
  publishedAt: string;
}> {
  return authenticatedFetchJson<{
    id: string;
    status: string;
    publishedAt: string;
  }>(`/api/editor/${id}/publish`, {
    method: "POST",
  });
}

export async function uploadProjectThumbnail(
  id: string,
  blob: Blob,
): Promise<{ thumbnailUrl: string }> {
  const form = new FormData();
  form.append("file", blob, "thumbnail.jpg");
  return authenticatedFetchJson<{ thumbnailUrl: string }>(
    `/api/editor/${id}/thumbnail`,
    { method: "POST", body: form },
  );
}

export async function deleteEditorProject(id: string): Promise<void> {
  await authenticatedFetchJson<void>(`/api/editor/${id}`, { method: "DELETE" });
}

export async function enqueueExport(
  projectId: string,
  opts?: { resolution?: string; fps?: number }
): Promise<{ exportJobId: string }> {
  return authenticatedFetchJson<{ exportJobId: string }>(
    `/api/editor/${projectId}/export`,
    {
      method: "POST",
      body: JSON.stringify(opts ?? {}),
    }
  );
}

export async function getExportStatus(
  projectId: string
): Promise<ExportJobStatus> {
  return authenticatedFetchJson<ExportJobStatus>(
    `/api/editor/${projectId}/export/status`
  );
}
