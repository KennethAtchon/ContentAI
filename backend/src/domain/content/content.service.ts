import type { IContentRepository } from "./content.repository";

export class ContentService {
  constructor(private readonly content: IContentRepository) {}

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
}
