import { Errors } from "../../utils/errors/app-error";
import type { IAssetsRepository, NewAssetRow } from "../assets/assets.repository";
import type { IContentRepository } from "./content.repository";

export class ContentService {
  constructor(
    private readonly content: IContentRepository,
    private readonly assets: IAssetsRepository,
  ) {}

  getOwnedContentHook(generatedContentId: number, userId: string) {
    return this.content.findIdAndHookForUser(generatedContentId, userId);
  }

  listAssetsForContent(generatedContentId: number) {
    return this.content.listAssetsLinkedToGeneratedContent(generatedContentId);
  }

  // Video operations
  fetchOwnedContentForVideo(userId: string, generatedContentId: number) {
    return this.content.fetchOwnedContentForVideo(userId, generatedContentId);
  }

  updatePhase4Metadata(
    input: {
      generatedContentId: number;
      existingGeneratedMetadata: Record<string, unknown> | null;
      jobId: string;
      status: "queued" | "running" | "completed" | "failed";
      shots?: Array<{
        shotIndex: number;
        description: string;
        durationMs: number;
        assetId: string;
        useClipAudio: boolean;
      }>;
      provider?: string;
    },
  ) {
    return this.content.updatePhase4Metadata(input);
  }

  // Timeline validation
  fetchOwnedAssetsForTimeline(
    userId: string,
    generatedContentId: number,
    assetIds: string[],
  ) {
    return this.content.fetchOwnedAssetsForTimeline(
      userId,
      generatedContentId,
      assetIds,
    );
  }

  // Editor assets
  listEditorAssetsForUser(
    userId: string,
    options: {
      contentId?: number;
      roles?: string[];
      excludeRoles?: string[];
    },
  ) {
    return this.content.listEditorAssetsForUser(userId, options);
  }

  // Content assets for GET /api/assets
  listContentAssetsForUser(
    userId: string,
    generatedContentId: number,
    options: { typeFilter?: string },
  ) {
    return this.content.listContentAssetsForUser(userId, generatedContentId, options);
  }

  // Chat content operations
  findChainTipDraftsForSession(userId: string, sessionId: string) {
    return this.content.findChainTipDraftsForSession(userId, sessionId);
  }

  // Generation operations
  listGenerationHistory(userId: string, page: number, limit: number) {
    return this.content.listGenerationHistory(userId, page, limit);
  }

  listGeneratedContent(userId: string, limit: number, offset: number) {
    return this.content.listGeneratedContent(userId, limit, offset);
  }

  findGeneratedContentById(id: number, userId: string) {
    return this.content.findGeneratedContentById(id, userId);
  }

  updateGeneratedContentStatus(id: number, userId: string, status: string) {
    return this.content.updateGeneratedContentStatus(id, userId, status);
  }

  async createUserUploadForGeneratedContent(
    userId: string,
    generatedContentId: number,
    assetRow: NewAssetRow,
    role: "video_clip" | "image",
  ) {
    const ownedId = await this.content.findOwnedGeneratedContentId(
      userId,
      generatedContentId,
    );
    if (ownedId === null) throw Errors.notFound("Content");

    const asset = await this.assets.insertAsset(assetRow);
    await this.content.insertContentAssetLink({
      generatedContentId,
      assetId: asset.id,
      role,
    });
    return asset;
  }

  insertGeneratedVideoClipAndLink(
    params: Parameters<
      IContentRepository["insertGeneratedVideoClipAndLink"]
    >[0],
  ) {
    return this.content.insertGeneratedVideoClipAndLink(params);
  }

  replaceGeneratedVideoClipForShot(
    params: Parameters<
      IContentRepository["replaceGeneratedVideoClipForShot"]
    >[0],
  ) {
    return this.content.replaceGeneratedVideoClipForShot(params);
  }

  listVideoClipAssetsForAiAssembly(
    userId: string,
    generatedContentId: number,
  ) {
    return this.content.listVideoClipAssetsForAiAssembly(
      userId,
      generatedContentId,
    );
  }
}
