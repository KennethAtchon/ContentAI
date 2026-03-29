import type { IChatRepository } from "./chat.repository";
import { Errors } from "../../utils/errors/app-error";

export class ChatService {
  constructor(private readonly chatRepo: IChatRepository) {}

  async listSessions(userId: string, projectId?: string) {
    const sessions = await this.chatRepo.listSessions(userId, projectId);
    return { sessions };
  }

  async createSession(
    userId: string,
    projectId: string,
    title?: string,
  ) {
    // Verify project exists and belongs to user
    const project = await this.chatRepo.findProjectById(projectId, userId);
    if (!project) {
      throw Errors.notFound("Project");
    }

    const sessionTitle = title || "New Chat Session";
    const newSession = await this.chatRepo.createSession({
      id: crypto.randomUUID(),
      userId,
      projectId,
      title: sessionTitle,
    });

    return { session: newSession };
  }

  async findOrCreateSessionForContent(userId: string, contentId: string) {
    // Check if there's an existing session for this content
    const existingSession = await this.chatRepo.findSessionByContentId(
      userId,
      contentId,
    );

    if (existingSession) {
      return { session: existingSession, isNew: false };
    }

    // Verify content exists and get its project
    const content = await this.chatRepo.findContentById(Number(contentId), userId);
    if (!content) {
      throw Errors.notFound("Content");
    }

    if (!content.projectId) {
      throw Errors.badRequest(
        "Content has no associated project",
        "NO_PROJECT_FOR_CONTENT",
      );
    }

    // Create new session for this content's project
    const newSession = await this.chatRepo.createSession({
      id: crypto.randomUUID(),
      userId,
      projectId: content.projectId,
      title: content.hook || "Chat Session",
    });

    return { session: newSession, isNew: true };
  }

  async updateSession(userId: string, sessionId: string, title: string) {
    // Verify session exists and belongs to user
    const session = await this.chatRepo.findSessionById(sessionId, userId);
    if (!session) {
      throw Errors.notFound("Session");
    }

    const updated = await this.chatRepo.updateSession(sessionId, userId, {
      title,
    });

    return { session: updated };
  }

  async deleteSession(userId: string, sessionId: string) {
    // Verify session exists and belongs to user
    const session = await this.chatRepo.findSessionById(sessionId, userId);
    if (!session) {
      throw Errors.notFound("Session");
    }

    await this.chatRepo.deleteSession(sessionId, userId);

    return { success: true };
  }

  async getSessionMessages(userId: string, sessionId: string) {
    // Verify session exists and belongs to user
    const session = await this.chatRepo.findSessionById(sessionId, userId);
    if (!session) {
      throw Errors.notFound("Session");
    }

    const messages = await this.chatRepo.listMessages(sessionId);

    return { messages };
  }

  async createMessage(
    userId: string,
    sessionId: string,
    data: {
      role: string;
      content: string;
      attachments?: {
        type: string;
        reelId?: number;
        mediaAssetId?: string;
        generatedContentId?: number;
      }[];
    },
  ) {
    // Verify session exists and belongs to user
    const session = await this.chatRepo.findSessionById(sessionId, userId);
    if (!session) {
      throw Errors.notFound("Session");
    }

    const message = await this.chatRepo.createMessage({
      id: crypto.randomUUID(),
      sessionId,
      role: data.role,
      content: data.content,
    });

    // Create attachments if any
    if (data.attachments && data.attachments.length > 0) {
      await this.chatRepo.createAttachments(
        data.attachments.map((att) => ({
          messageId: message.id,
          type: att.type,
          reelId: att.reelId,
          mediaAssetId: att.mediaAssetId,
          generatedContentId: att.generatedContentId,
        })),
      );
    }

    return { message };
  }

  async getReelsForChat(userId: string, reelIds: number[]) {
    if (reelIds.length === 0) {
      return { reels: [] };
    }

    const reels = await this.chatRepo.findReelsByIds(reelIds, userId);
    return { reels };
  }

  async getGeneratedContentForChat(userId: string, contentIds: number[]) {
    if (contentIds.length === 0) {
      return { content: [] };
    }

    const content = await this.chatRepo.findGeneratedContentByIds(
      contentIds,
      userId,
    );
    return { content };
  }
}
