import type { z } from "zod";
import { uploadFile } from "../../services/storage/r2";
import { debugLog } from "../../utils/debug/debug";
import { AppError, Errors } from "../../utils/errors/app-error";
import type { IContentRepository } from "../content/content.repository";
import type { IQueueRepository } from "../queue/queue.repository";
import type { createProjectSchema, patchProjectDocumentSchema } from "./editor.schemas";
import type { IEditorRepository } from "./editor.repository";
import type { SyncService } from "./sync/sync.service";
import {
  buildInitialProjectDocument,
  applyTracksToDocument,
  deriveEnvelope,
  PERSISTED_DOCUMENT_VERSION,
  type PersistedProjectFile,
} from "./project-document";

export class EditorService {
  constructor(
    private readonly editor: IEditorRepository,
    private readonly content: IContentRepository,
    private readonly queue: IQueueRepository,
    private readonly syncService: SyncService,
  ) {}

  async listProjectsForUser(userId: string) {
    return this.editor.listForUserWithGeneratedContent(userId);
  }

  async createEditorProject(
    userId: string,
    body: z.infer<typeof createProjectSchema>,
  ) {
    const { generatedContentId, title } = body;

    let contentMeta: Awaited<
      ReturnType<IContentRepository["findIdAndHookForUser"]>
    > = null;
    if (generatedContentId) {
      contentMeta = await this.content.findIdAndHookForUser(
        generatedContentId,
        userId,
      );
      if (!contentMeta) throw Errors.forbidden("Content not found");

      const chainIds = await this.content.resolveContentAncestorChainIds(
        generatedContentId,
        userId,
      );
      const existingId = await this.editor.findRootProjectIdInContentChain(
        userId,
        chainIds,
      );
      if (existingId) {
        throw new AppError("project_exists", "PROJECT_EXISTS", 409, {
          existingProjectId: existingId,
        });
      }
    }

    let insertTitle = title ?? "Untitled Edit";
    let insertAutoTitle = !title;
    if (generatedContentId && !title && contentMeta?.generatedHook) {
      insertTitle = [...contentMeta.generatedHook].slice(0, 60).join("");
      insertAutoTitle = true;
    }

    const projectId = crypto.randomUUID();
    let projectDocument = buildInitialProjectDocument(projectId, insertTitle);

    if (generatedContentId) {
      const { tracks, durationMs } = await this.syncService.deriveTimeline(
        userId,
        generatedContentId,
      );
      projectDocument = applyTracksToDocument(
        projectDocument,
        projectId,
        insertTitle,
        tracks,
        durationMs,
      );
    }

    const envelope = deriveEnvelope(projectDocument);

    try {
      const project = await this.editor.insertProject({
        id: projectId,
        userId,
        title: insertTitle,
        autoTitle: insertAutoTitle,
        generatedContentId: generatedContentId ?? null,
        projectDocument: projectDocument as unknown,
        projectDocumentVersion: envelope.projectDocumentVersion,
        editorCoreVersion: envelope.editorCoreVersion,
        documentHash: envelope.documentHash,
        saveRevision: 1,
        durationMs: envelope.durationMs,
        fps: envelope.fps,
        resolution: envelope.resolution,
        status: "draft",
      });
      return { project };
    } catch (error) {
      if (
        error instanceof Error &&
        "code" in error &&
        (error as { code: string }).code === "23505" &&
        generatedContentId
      ) {
        const chainIds = await this.content.resolveContentAncestorChainIds(
          generatedContentId,
          userId,
        );
        const existingId = await this.editor.findRootProjectIdInContentChain(
          userId,
          chainIds,
        );
        if (existingId) {
          throw new AppError("project_exists", "PROJECT_EXISTS", 409, {
            existingProjectId: existingId,
          });
        }
      }
      throw error;
    }
  }

  async getProjectWithDocument(userId: string, projectId: string) {
    const project = await this.editor.findByIdAndUserId(projectId, userId);
    if (!project) throw Errors.notFound("Edit project");
    return { project };
  }

  async patchAutosaveProject(
    userId: string,
    projectId: string,
    parsed: z.infer<typeof patchProjectDocumentSchema>,
  ) {
    const existing = await this.editor.findByIdAndUserId(projectId, userId);
    if (!existing) throw Errors.notFound("Edit project");

    if (existing.status === "published") {
      throw new AppError("Published projects are read-only", "READ_ONLY", 403);
    }

    const doc = parsed.projectDocument as PersistedProjectFile;
    const envelope = deriveEnvelope(doc);

    const result = await this.editor.updateProjectDocumentForUser(
      projectId,
      userId,
      {
        projectDocument: doc,
        projectDocumentVersion: envelope.projectDocumentVersion,
        editorCoreVersion: envelope.editorCoreVersion,
        documentHash: envelope.documentHash,
        fps: envelope.fps,
        resolution: envelope.resolution,
        durationMs: envelope.durationMs,
        expectedSaveRevision: parsed.expectedSaveRevision,
        title: parsed.title,
      },
    );

    if (result === "CONFLICT") {
      const current = await this.editor.findByIdAndUserId(projectId, userId);
      throw new AppError(
        "Save revision conflict",
        "SAVE_REVISION_CONFLICT",
        409,
        { currentSaveRevision: current?.saveRevision ?? 0 },
      );
    }

    debugLog.info("Project autosaved", {
      service: "editor",
      operation: "patchAutosaveProject",
      projectId,
      saveRevision: result.saveRevision,
    });

    return { id: result.id, saveRevision: result.saveRevision, updatedAt: result.updatedAt };
  }

  async deleteProjectForUser(userId: string, projectId: string) {
    const project = await this.editor.findByIdAndUserId(projectId, userId);
    if (!project) throw Errors.notFound("Edit project");
    await this.editor.deleteByIdForUser(projectId, userId);
  }

  async publishProjectForUser(userId: string, projectId: string) {
    const project = await this.editor.findByIdAndUserId(projectId, userId);
    if (!project) throw Errors.notFound("Edit project");

    if (project.status === "published") {
      throw new AppError("Already published", "ALREADY_PUBLISHED", 409);
    }

    const hasExport = await this.editor.hasCompletedExportForProject(projectId);
    if (!hasExport) {
      throw new AppError(
        "Export your reel before publishing",
        "EXPORT_REQUIRED",
        422,
      );
    }

    const updated = await this.editor.markPublishedForUser(projectId, userId);
    if (!updated) throw Errors.notFound("Edit project");

    if (updated.generatedContentId) {
      await this.queue.markDraftOrScheduledReadyByContent(
        userId,
        updated.generatedContentId,
      );
    }

    return {
      id: updated.id,
      status: updated.status,
      publishedAt: updated.publishedAt,
    };
  }

  async createNewDraftFromPublished(userId: string, sourceProjectId: string) {
    const source = await this.editor.findByIdAndUserId(sourceProjectId, userId);
    if (!source) throw Errors.notFound("Edit project");

    if (source.status !== "published") {
      throw Errors.forbidden("Source must be published");
    }

    const newId = crypto.randomUUID();
    const sourceDoc = source.projectDocument as PersistedProjectFile | null;

    const newDoc = sourceDoc
      ? ({
          ...sourceDoc,
          project: {
            ...sourceDoc.project,
            id: newId,
            title: `${source.title} (v2)`,
            modifiedAt: new Date().toISOString(),
          },
        } as PersistedProjectFile)
      : buildInitialProjectDocument(newId, `${source.title} (v2)`);

    const envelope = deriveEnvelope(newDoc);

    const newDraft = await this.editor.insertProject({
      id: newId,
      userId,
      title: `${source.title} (v2)`,
      generatedContentId: null,
      projectDocument: newDoc as unknown,
      projectDocumentVersion: PERSISTED_DOCUMENT_VERSION,
      editorCoreVersion: PERSISTED_DOCUMENT_VERSION,
      documentHash: envelope.documentHash,
      saveRevision: 1,
      durationMs: envelope.durationMs,
      fps: envelope.fps,
      resolution: envelope.resolution,
      status: "draft",
      parentProjectId: source.id,
    });

    return { project: newDraft };
  }

  async uploadThumbnailForProject(
    userId: string,
    projectId: string,
    file: File,
  ) {
    const exists = await this.editor.existsByIdForUser(projectId, userId);
    if (!exists) throw Errors.notFound("Edit project");

    if (!file.type.startsWith("image/")) {
      throw new AppError("File must be an image", "INVALID_INPUT", 400);
    }
    if (file.size > 5 * 1024 * 1024) {
      throw new AppError("Image must be under 5 MB", "INVALID_INPUT", 400);
    }

    const ext = file.type === "image/png" ? "png" : "jpg";
    const r2Key = `thumbnails/editor/${userId}/${projectId}.${ext}`;
    const thumbnailUrl = await uploadFile(file, r2Key, file.type);

    await this.editor.setThumbnailUrlForUser(projectId, userId, thumbnailUrl);

    return { thumbnailUrl };
  }
}
