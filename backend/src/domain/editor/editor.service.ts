import type { z } from "zod";
import { uploadFile } from "../../services/storage/r2";
import { debugLog } from "../../utils/debug/debug";
import { AppError, Errors } from "../../utils/errors/app-error";
import type { IContentRepository } from "../content/content.repository";
import type { IQueueRepository } from "../queue/queue.repository";
import type { createProjectSchema, patchProjectSchema } from "./editor.schemas";
import type { IEditorRepository } from "./editor.repository";
import { buildInitialTimeline } from "./build-initial-timeline";
import type { ICaptionsRepository } from "./captions.repository";
import { mergeNewAssetsIntoProject } from "./merge-new-assets";
import { parseStoredEditorTracks } from "./validate-stored-tracks";

export class EditorService {
  constructor(
    private readonly editor: IEditorRepository,
    private readonly captions: ICaptionsRepository,
    private readonly content: IContentRepository,
    private readonly queue: IQueueRepository,
  ) {}

  private getCaptionDocIds(tracks: unknown): Set<string> {
    return new Set(
      parseStoredEditorTracks(tracks)
        .flatMap((track) => track.clips)
        .flatMap((clip) =>
          clip.type === "caption" ? [clip.captionDocId] : [],
        ),
    );
  }

  private async cleanupCaptionDocsIfUnreferenced(
    userId: string,
    excludeProjectId: string,
    candidateCaptionDocIds: Iterable<string>,
  ) {
    const candidateIds = [...new Set(candidateCaptionDocIds)].filter(Boolean);
    if (candidateIds.length === 0) return;

    try {
      const otherProjects = await this.editor.listProjectTracksForUser(
        userId,
        excludeProjectId,
      );
      const referencedElsewhere = new Set<string>();

      for (const project of otherProjects) {
        try {
          for (const captionDocId of this.getCaptionDocIds(project.tracks)) {
            referencedElsewhere.add(captionDocId);
          }
        } catch (error) {
          debugLog.warn("Skipping caption cleanup scan for invalid project tracks", {
            service: "editor-service",
            operation: "cleanupCaptionDocsIfUnreferenced",
            projectId: project.id,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }

      const orphanedIds = candidateIds.filter(
        (captionDocId) => !referencedElsewhere.has(captionDocId),
      );
      await this.captions.deleteByIdsAndUser(orphanedIds, userId);
    } catch (error) {
      debugLog.warn("Caption doc cleanup failed", {
        service: "editor-service",
        operation: "cleanupCaptionDocsIfUnreferenced",
        projectId: excludeProjectId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

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
      const existingId =
        await this.editor.findRootProjectIdInContentChain(userId, chainIds);
      if (existingId) {
        throw new AppError(
          "project_exists",
          "PROJECT_EXISTS",
          409,
          { existingProjectId: existingId },
        );
      }
    }

    let tracks: unknown[] = [];
    let durationMs = 0;
    if (generatedContentId) {
      const result = await buildInitialTimeline(
        this.content,
        generatedContentId,
        userId,
      );
      tracks = result.tracks;
      durationMs = result.durationMs;
    }

    let insertTitle = title ?? "Untitled Edit";
    let insertAutoTitle = !title;
    if (generatedContentId && !title && contentMeta?.generatedHook) {
      insertTitle = [...contentMeta.generatedHook].slice(0, 60).join("");
      insertAutoTitle = true;
    }

    try {
      const project = await this.editor.insertProject({
        userId,
        title: insertTitle,
        autoTitle: insertAutoTitle,
        generatedContentId: generatedContentId ?? null,
        tracks,
        durationMs,
        fps: 30,
        resolution: "1080x1920",
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
        const existingId =
          await this.editor.findRootProjectIdInContentChain(userId, chainIds);
        if (existingId) {
          throw new AppError(
            "project_exists",
            "PROJECT_EXISTS",
            409,
            { existingProjectId: existingId },
          );
        }
      }
      throw error;
    }
  }

  async syncNewAssetsIntoProject(userId: string, projectId: string) {
    return mergeNewAssetsIntoProject(
      this.editor,
      this.content,
      projectId,
      userId,
    );
  }

  async getProjectWithParsedTracks(userId: string, projectId: string) {
    const project = await this.editor.findByIdAndUserId(projectId, userId);
    if (!project) throw Errors.notFound("Edit project");
    const tracks = parseStoredEditorTracks(project.tracks);
    return { project: { ...project, tracks } };
  }

  async patchAutosaveProject(
    userId: string,
    projectId: string,
    parsed: z.infer<typeof patchProjectSchema>,
  ) {
    const existing = await this.editor.findByIdAndUserId(projectId, userId);
    if (!existing) throw Errors.notFound("Edit project");

    if (existing.status === "published") {
      throw new AppError(
        "Published projects are read-only",
        "READ_ONLY",
        403,
      );
    }

    const updateData: Record<string, unknown> = { userHasEdited: true };
    let removedCaptionDocIds: string[] = [];
    if (parsed.title !== undefined) {
      updateData.title = parsed.title;
      if (parsed.title !== existing.title) {
        updateData.autoTitle = false;
      }
    }
    if (parsed.tracks !== undefined) {
      const previousCaptionDocIds = this.getCaptionDocIds(existing.tracks);
      const nextCaptionDocIds = this.getCaptionDocIds(parsed.tracks);
      removedCaptionDocIds = [...previousCaptionDocIds].filter(
        (captionDocId) => !nextCaptionDocIds.has(captionDocId),
      );
      updateData.tracks = parsed.tracks;
      updateData.mergedAssetIds = [
        ...new Set(
          parsed.tracks
            .flatMap((t) =>
              t.clips
                .flatMap((cl) => ("assetId" in cl ? [cl.assetId] : [])),
            )
            .filter(
              (aid): aid is string =>
                typeof aid === "string" && aid.length > 0,
            ),
        ),
      ];
    }
    if (parsed.durationMs !== undefined)
      updateData.durationMs = parsed.durationMs;
    if (parsed.fps !== undefined) updateData.fps = parsed.fps;
    if (parsed.resolution !== undefined)
      updateData.resolution = parsed.resolution;

    const updated = await this.editor.updateProjectForUser(
      projectId,
      userId,
      updateData,
    );
    if (!updated) throw Errors.notFound("Edit project");
    await this.cleanupCaptionDocsIfUnreferenced(
      userId,
      projectId,
      removedCaptionDocIds,
    );

    return { id: updated.id, updatedAt: updated.updatedAt };
  }

  async deleteProjectForUser(userId: string, projectId: string) {
    const project = await this.editor.findByIdAndUserId(projectId, userId);
    if (!project) throw Errors.notFound("Edit project");
    const captionDocIds = this.getCaptionDocIds(project.tracks);
    await this.editor.deleteByIdForUser(projectId, userId);
    await this.cleanupCaptionDocsIfUnreferenced(
      userId,
      projectId,
      captionDocIds,
    );
  }

  async publishProjectForUser(userId: string, projectId: string) {
    const project = await this.editor.findByIdAndUserId(projectId, userId);
    if (!project) throw Errors.notFound("Edit project");

    if (project.status === "published") {
      throw new AppError("Already published", "ALREADY_PUBLISHED", 409);
    }

    const hasExport =
      await this.editor.hasCompletedExportForProject(projectId);
    if (!hasExport) {
      throw new AppError(
        "Export your reel before publishing",
        "EXPORT_REQUIRED",
        422,
      );
    }

    const updated = await this.editor.markPublishedForUser(
      projectId,
      userId,
    );
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
    const source = await this.editor.findByIdAndUserId(
      sourceProjectId,
      userId,
    );
    if (!source) throw Errors.notFound("Edit project");

    if (source.status !== "published") {
      throw Errors.forbidden("Source must be published");
    }

    const validatedTracks = parseStoredEditorTracks(source.tracks);

    const newDraft = await this.editor.insertProject({
      userId,
      title: `${source.title} (v2)`,
      generatedContentId: null,
      tracks: validatedTracks,
      durationMs: source.durationMs,
      fps: source.fps,
      resolution: source.resolution,
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

    await this.editor.setThumbnailUrlForUser(
      projectId,
      userId,
      thumbnailUrl,
    );

    return { thumbnailUrl };
  }
}
