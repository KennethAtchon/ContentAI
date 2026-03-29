import type { IContentRepository } from "./content.repository";

export class ContentService {
  constructor(private readonly content: IContentRepository) {}

  getOwnedContentHook(generatedContentId: number, userId: string) {
    return this.content.findIdAndHookForUser(generatedContentId, userId);
  }

  listAssetsForContent(generatedContentId: number) {
    return this.content.listAssetsLinkedToGeneratedContent(generatedContentId);
  }
}
