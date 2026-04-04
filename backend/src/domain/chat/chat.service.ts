import type { IChatRepository } from "./chat.repository";
import { Errors } from "../../utils/errors/app-error";

export class ChatService {
  constructor(private readonly chatRepo: IChatRepository) {}

  private async assertSessionExists(sessionId: string, userId: string) {
    const session = await this.chatRepo.findSessionById(sessionId, userId);
    if (!session) {
      throw Errors.notFound("Session");
    }
    return session;
  }

  private async assertSessionOwnsContent(
    sessionId: string,
    userId: string,
    contentId: number,
  ) {
    const content = await this.chatRepo.findContentById(contentId, userId);
    if (!content) {
      throw Errors.notFound("Content");
    }

    const sessionContentIds = await this.chatRepo.listSessionContentIds(
      sessionId,
      userId,
    );

    if (!sessionContentIds.includes(contentId)) {
      throw Errors.badRequest(
        "Content is not attached to this session",
        "CONTENT_NOT_IN_SESSION",
      );
    }
  }

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
      activeContentId: null,
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

    // Find user's default project or create one for this content
    const sessions = await this.chatRepo.listSessions(userId, undefined);
    let projectId: string | null = sessions[0]?.projectId ?? null;
    
    if (!projectId) {
      // Create a new project for this user if none exists
      const newProject = await this.chatRepo.createProject({
        id: crypto.randomUUID(),
        userId,
        name: "My Project",
      });
      projectId = newProject.id;
    }

    // Create new session for this content
    const newSession = await this.chatRepo.createSession({
      id: crypto.randomUUID(),
      userId,
      projectId,
      title: content.generatedHook || "Chat Session",
      activeContentId: Number(contentId),
    });

    await this.chatRepo.attachContentToSession(
      newSession.id,
      userId,
      Number(contentId),
    );

    return { session: newSession, isNew: true };
  }

  async updateSession(
    userId: string,
    sessionId: string,
    updates: { title?: string; activeContentId?: number | null },
  ) {
    await this.assertSessionExists(sessionId, userId);

    if (updates.activeContentId !== undefined && updates.activeContentId !== null) {
      await this.assertSessionOwnsContent(
        sessionId,
        userId,
        updates.activeContentId,
      );
    }

    const updated = await this.chatRepo.updateSession(sessionId, userId, updates);

    return { session: updated };
  }

  async setActiveContentId(
    userId: string,
    sessionId: string,
    activeContentId: number | null,
  ) {
    await this.assertSessionExists(sessionId, userId);

    if (activeContentId !== null) {
      await this.assertSessionOwnsContent(sessionId, userId, activeContentId);
    }

    await this.chatRepo.setActiveContentId(sessionId, userId, activeContentId);
    return { success: true };
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

  async findSessionById(userId: string, sessionId: string) {
    return this.chatRepo.findSessionById(sessionId, userId);
  }

  async getRecentMessages(sessionId: string, limit: number) {
    return this.chatRepo.listMessages(sessionId, limit);
  }

  async createMessageSimple(data: {
    id: string;
    sessionId: string;
    role: string;
    content: string;
  }) {
    return this.chatRepo.createMessage(data);
  }

  async createAttachmentsSimple(
    attachments: {
      messageId: string;
      type: string;
      reelId?: number;
      mediaAssetId?: string;
    }[],
  ) {
    if (attachments.length === 0) return;
    return this.chatRepo.createAttachments(
      attachments.map((a) => ({
        messageId: a.messageId,
        type: a.type,
        reelId: a.reelId,
        mediaAssetId: a.mediaAssetId,
      })),
    );
  }

  async saveAssistantMessage(data: {
    id: string;
    sessionId: string;
    content: string;
  }) {
    await this.chatRepo.createAssistantMessage(data);
  }

  async attachContentToSession(
    userId: string,
    sessionId: string,
    contentId: number,
  ) {
    await this.assertSessionExists(sessionId, userId);
    const content = await this.chatRepo.findContentById(contentId, userId);
    if (!content) {
      throw Errors.notFound("Content");
    }

    await this.chatRepo.attachContentToSession(sessionId, userId, contentId);
  }

  async attachContentToSessionAndSetActive(
    userId: string,
    sessionId: string,
    contentId: number,
  ) {
    await this.attachContentToSession(userId, sessionId, contentId);
    await this.chatRepo.setActiveContentId(sessionId, userId, contentId);
    return { success: true };
  }

  async touchSession(sessionId: string) {
    await this.chatRepo.updateSessionTimestamp(sessionId);
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

  async getSessionWithMessages(userId: string, sessionId: string) {
    // Verify session exists and belongs to user
    const session = await this.chatRepo.findSessionById(sessionId, userId);
    if (!session) {
      throw Errors.notFound("Session");
    }

    const messages = await this.chatRepo.listMessages(sessionId);
    const attachments = await this.chatRepo.listAttachmentsForMessages(
      messages.map((m) => m.id),
    );

    const attachmentsByMessage = attachments.reduce<
      Record<string, typeof attachments>
    >((acc, a) => {
      acc[a.messageId] ??= [];
      acc[a.messageId].push(a);
      return acc;
    }, {});

    const messagesWithAttachments = messages.map((m) => ({
      ...m,
      attachments: attachmentsByMessage[m.id] ?? [],
    }));

    return { session, messages: messagesWithAttachments };
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

  async buildChatContext(
    userId: string,
    projectName: string,
    reelRefs?: number[],
    activeContentId?: number,
  ) {
    let context = `Project: ${projectName}`;

    if (reelRefs && reelRefs.length > 0) {
      const reelRows = await this.chatRepo.findReelsWithContext(reelRefs, userId);

      if (reelRows.length > 0) {
        const reelContext = reelRows
          .map(
            (r) =>
              `Reel ID ${r.id} @${r.username} (${r.views.toLocaleString()} views, ${r.niche ?? "unknown niche"}): hook="${r.hook ?? "N/A"}"`,
          )
          .join("\n");
        context += `\nAttached reels (use get_reel_analysis to fetch deep analysis before generating):\n${reelContext}`;
      }
    }

    if (activeContentId) {
      const active = await this.chatRepo.findContentForChatContext(
        activeContentId,
        userId,
      );

      if (active) {
        const meta = active.generatedMetadata as Record<string, unknown> | null;
        const hashtags = Array.isArray(meta?.hashtags)
          ? (meta.hashtags as string[]).join(", ")
          : "none";
        const cta = (meta?.cta as string) ?? "none";

        context += `\n\nActive Draft (ID: ${active.id}, v${active.version}, status: ${active.status}):
Hook: "${active.generatedHook ?? "none"}"
Post caption: "${active.postCaption ?? "none"}"
Hashtags: ${hashtags}
CTA: ${cta}
Script (first 300 chars): "${(active.generatedScript ?? "none").slice(0, 300)}..."
Scene Description: "${active.sceneDescription ?? "none"}"
Type: ${active.outputType}

For targeted field edits (postCaption, hook, hashtags, CTA only), call edit_content_field with contentId: ${active.id}.
For full rewrites or multi-field changes, call iterate_content with parentContentId: ${active.id}.`;
      }
    }

    return context;
  }
}
