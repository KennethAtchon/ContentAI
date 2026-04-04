import { eq, and, desc, sql, inArray, or } from "drizzle-orm";
import {
  chatSessions,
  chatMessages,
  messageAttachments,
  projects,
  reels,
  generatedContent,
} from "../../infrastructure/database/drizzle/schema";
import type { AppDb } from "../database.types";

export interface IChatRepository {
  // Sessions
  listSessions(userId: string, projectId?: string): Promise<
    {
      id: string;
      title: string;
      projectId: string | null;
      activeContentId: number | null;
      project: { id: string; name: string } | null;
      createdAt: Date;
      updatedAt: Date;
      messageCount: number;
    }[]
  >;

  findSessionById(
    sessionId: string,
    userId: string,
  ): Promise<
    | {
        id: string;
        userId: string;
        projectId: string | null;
        activeContentId: number | null;
        title: string;
        createdAt: Date;
        updatedAt: Date;
      }
    | undefined
  >;

  findSessionByContentId(
    userId: string,
    contentId: string,
  ): Promise<
    | {
        id: string;
        userId: string;
        projectId: string | null;
        activeContentId: number | null;
        title: string;
        createdAt: Date;
        updatedAt: Date;
      }
    | undefined
  >;

  createSession(data: {
    id: string;
    userId: string;
    projectId: string;
    title: string;
    activeContentId?: number | null;
  }): Promise<{
    id: string;
    userId: string;
    projectId: string | null;
    activeContentId: number | null;
    title: string;
    createdAt: Date;
    updatedAt: Date;
  }>;

  updateSession(
    sessionId: string,
    userId: string,
    data: { title?: string; activeContentId?: number | null },
  ): Promise<{
    id: string;
    userId: string;
    projectId: string | null;
    activeContentId: number | null;
    title: string;
    createdAt: Date;
    updatedAt: Date;
  }>;

  setActiveContentId(
    sessionId: string,
    userId: string,
    activeContentId: number | null,
  ): Promise<void>;

  deleteSession(sessionId: string, userId: string): Promise<void>;

  // Messages
  listMessages(sessionId: string, limit?: number): Promise<
    {
      id: string;
      sessionId: string;
      role: string;
      content: string;
      createdAt: Date;
      attachments: {
        id: string;
        type: string;
        reelId: number | null;
        mediaAssetId: string | null;
        generatedContentId: number | null;
      }[];
    }[]
  >;

  createMessage(data: {
    id: string;
    sessionId: string;
    role: string;
    content: string;
  }): Promise<{
    id: string;
    sessionId: string;
    role: string;
    content: string;
    createdAt: Date;
  }>;

  createAssistantMessage(data: {
    id: string;
    sessionId: string;
    content: string;
    generatedContentId: number | null;
  }): Promise<void>;

  updateSessionTimestamp(sessionId: string): Promise<void>;

  // Attachments
  createAttachments(
    attachments: {
      messageId: string;
      type: string;
      reelId?: number | null;
      mediaAssetId?: string | null;
      generatedContentId?: number | null;
    }[],
  ): Promise<void>;

  listAttachmentsForMessages(
    messageIds: string[],
  ): Promise<
    Array<{
      id: string;
      messageId: string;
      type: string;
      reelId: number | null;
      mediaAssetId: string | null;
      generatedContentId: number | null;
    }>
  >;

  // Project verification
  findProjectById(
    projectId: string,
    userId: string,
  ): Promise<
    | {
        id: string;
        userId: string;
        name: string;
      }
    | undefined
  >;

  createProject(data: {
    id: string;
    userId: string;
    name: string;
  }): Promise<{ id: string; userId: string; name: string }>;

  // Content and reels lookup
  findContentById(
    contentId: number,
    userId: string,
  ): Promise<
    | {
        id: number;
        userId: string;
        generatedHook: string | null;
      }
    | undefined
  >;

  findReelsByIds(
    reelIds: number[],
    userId: string,
  ): Promise<
    {
      id: number;
      hook: string | null;
      videoUrl: string | null;
    }[]
  >;

  findReelsWithContext(
    reelIds: number[],
    userId: string,
  ): Promise<
    {
      id: number;
      username: string;
      hook: string | null;
      views: number;
      niche: string | null;
    }[]
  >;

  findContentForChatContext(
    contentId: number,
    userId: string,
  ): Promise<
    | {
        id: number;
        version: number;
        outputType: string;
        status: string;
        generatedHook: string | null;
        postCaption: string | null;
        generatedScript: string | null;
        voiceoverScript: string | null;
        sceneDescription: string | null;
        generatedMetadata: unknown;
      }
    | undefined
  >;

  findGeneratedContentByIds(
    contentIds: number[],
    userId: string,
  ): Promise<
    {
      id: number;
      generatedScript: string | null;
    }[]
  >;
}

export class ChatRepository implements IChatRepository {
  constructor(private readonly db: AppDb) {}

  async listSessions(userId: string, projectId?: string) {
    const whereClause = projectId
      ? and(
          eq(chatSessions.userId, userId),
          eq(chatSessions.projectId, projectId),
        )
      : eq(chatSessions.userId, userId);

    return this.db
      .select({
        id: chatSessions.id,
        title: chatSessions.title,
        projectId: chatSessions.projectId,
        activeContentId: chatSessions.activeContentId,
        project: {
          id: projects.id,
          name: projects.name,
        },
        createdAt: chatSessions.createdAt,
        updatedAt: chatSessions.updatedAt,
        messageCount:
          sql<number>`(SELECT COUNT(*) FROM ${chatMessages} WHERE ${chatMessages.sessionId} = ${chatSessions.id})`.mapWith(
            Number,
          ),
      })
      .from(chatSessions)
      .leftJoin(projects, eq(chatSessions.projectId, projects.id))
      .where(whereClause)
      .orderBy(desc(chatSessions.updatedAt));
  }

  async findSessionById(sessionId: string, userId: string) {
    const [session] = await this.db
      .select({
        id: chatSessions.id,
        userId: chatSessions.userId,
        projectId: chatSessions.projectId,
        activeContentId: chatSessions.activeContentId,
        title: chatSessions.title,
        createdAt: chatSessions.createdAt,
        updatedAt: chatSessions.updatedAt,
      })
      .from(chatSessions)
      .where(and(eq(chatSessions.id, sessionId), eq(chatSessions.userId, userId)))
      .limit(1);

    return session;
  }

  async findSessionByContentId(userId: string, contentId: string) {
    // Match either a persisted active draft anchor or historical chat messages.
    const [session] = await this.db
      .select({
        id: chatSessions.id,
        userId: chatSessions.userId,
        projectId: chatSessions.projectId,
        activeContentId: chatSessions.activeContentId,
        title: chatSessions.title,
        createdAt: chatSessions.createdAt,
        updatedAt: chatSessions.updatedAt,
      })
      .from(chatSessions)
      .leftJoin(
        chatMessages,
        eq(chatSessions.id, chatMessages.sessionId),
      )
      .where(
        and(
          or(
            eq(chatSessions.activeContentId, Number(contentId)),
            eq(chatMessages.generatedContentId, Number(contentId)),
          ),
          eq(chatSessions.userId, userId),
        ),
      )
      .orderBy(desc(chatSessions.updatedAt))
      .limit(1);

    return session;
  }

  async createSession(data: {
    id: string;
    userId: string;
    projectId: string;
    title: string;
    activeContentId?: number | null;
  }) {
    const [newSession] = await this.db
      .insert(chatSessions)
      .values({
        id: data.id,
        userId: data.userId,
        projectId: data.projectId,
        title: data.title,
        activeContentId: data.activeContentId ?? null,
      })
      .returning({
        id: chatSessions.id,
        userId: chatSessions.userId,
        projectId: chatSessions.projectId,
        activeContentId: chatSessions.activeContentId,
        title: chatSessions.title,
        createdAt: chatSessions.createdAt,
        updatedAt: chatSessions.updatedAt,
      });

    if (!newSession) {
      throw new Error("Failed to create session");
    }

    return newSession;
  }

  async updateSession(
    sessionId: string,
    userId: string,
    data: { title?: string; activeContentId?: number | null },
  ) {
    const [updated] = await this.db
      .update(chatSessions)
      .set(data)
      .where(and(eq(chatSessions.id, sessionId), eq(chatSessions.userId, userId)))
      .returning({
        id: chatSessions.id,
        userId: chatSessions.userId,
        projectId: chatSessions.projectId,
        activeContentId: chatSessions.activeContentId,
        title: chatSessions.title,
        createdAt: chatSessions.createdAt,
        updatedAt: chatSessions.updatedAt,
      });

    if (!updated) {
      throw new Error("Failed to update session");
    }

    return updated;
  }

  async setActiveContentId(
    sessionId: string,
    userId: string,
    activeContentId: number | null,
  ): Promise<void> {
    await this.db
      .update(chatSessions)
      .set({ activeContentId })
      .where(and(eq(chatSessions.id, sessionId), eq(chatSessions.userId, userId)));
  }

  async deleteSession(sessionId: string, userId: string): Promise<void> {
    await this.db
      .delete(chatSessions)
      .where(and(eq(chatSessions.id, sessionId), eq(chatSessions.userId, userId)));
  }

  async listMessages(sessionId: string, limit?: number) {
    const base = this.db
      .select({
        id: chatMessages.id,
        sessionId: chatMessages.sessionId,
        role: chatMessages.role,
        content: chatMessages.content,
        createdAt: chatMessages.createdAt,
      })
      .from(chatMessages)
      .where(eq(chatMessages.sessionId, sessionId))
      .orderBy(chatMessages.createdAt);

    const messages = limit
      ? await base.limit(limit)
      : await base;

    // Fetch attachments for all messages
    const messageIds = messages.map((m) => m.id);
    if (messageIds.length === 0) {
      return messages.map((m) => ({ ...m, attachments: [] }));
    }

    const attachments = await this.db
      .select({
        id: messageAttachments.id,
        messageId: messageAttachments.messageId,
        type: messageAttachments.entityType,
        reelId: messageAttachments.reelId,
        mediaAssetId: messageAttachments.assetId,
        generatedContentId: sql<null>`NULL`,
      })
      .from(messageAttachments)
      .where(inArray(messageAttachments.messageId, messageIds));

    // Group attachments by message
    const attachmentsByMessage = new Map<string, typeof attachments>();
    for (const att of attachments) {
      const list = attachmentsByMessage.get(att.messageId) || [];
      list.push(att);
      attachmentsByMessage.set(att.messageId, list);
    }

    return messages.map((m) => ({
      ...m,
      attachments: attachmentsByMessage.get(m.id) || [],
    }));
  }

  async createMessage(data: {
    id: string;
    sessionId: string;
    role: string;
    content: string;
  }) {
    const [message] = await this.db
      .insert(chatMessages)
      .values({
        id: data.id,
        sessionId: data.sessionId,
        role: data.role,
        content: data.content,
      })
      .returning({
        id: chatMessages.id,
        sessionId: chatMessages.sessionId,
        role: chatMessages.role,
        content: chatMessages.content,
        createdAt: chatMessages.createdAt,
      });

    if (!message) {
      throw new Error("Failed to create message");
    }

    return message;
  }

  async createAssistantMessage(data: {
    id: string;
    sessionId: string;
    content: string;
    generatedContentId: number | null;
  }): Promise<void> {
    await this.db.insert(chatMessages).values({
      id: data.id,
      sessionId: data.sessionId,
      role: "assistant",
      content: data.content,
      generatedContentId: data.generatedContentId,
    });
  }

  async updateSessionTimestamp(sessionId: string): Promise<void> {
    await this.db
      .update(chatSessions)
      .set({ updatedAt: new Date() })
      .where(eq(chatSessions.id, sessionId));
  }

  async createAttachments(
    attachments: {
      messageId: string;
      type: string;
      reelId?: number | null;
      mediaAssetId?: string | null;
      generatedContentId?: number | null;
    }[],
  ): Promise<void> {
    if (attachments.length === 0) return;

    await this.db.insert(messageAttachments).values(
      attachments.map((a) => ({
        messageId: a.messageId,
        entityType: a.type,
        reelId: a.reelId ?? null,
        assetId: a.mediaAssetId ?? null,
      })),
    );
  }

  async listAttachmentsForMessages(
    messageIds: string[],
  ): ReturnType<IChatRepository["listAttachmentsForMessages"]> {
    if (messageIds.length === 0) return [];

    return this.db
      .select({
        id: messageAttachments.id,
        messageId: messageAttachments.messageId,
        type: messageAttachments.entityType,
        reelId: messageAttachments.reelId,
        mediaAssetId: messageAttachments.assetId,
        generatedContentId: sql<null>`NULL`,
      })
      .from(messageAttachments)
      .where(inArray(messageAttachments.messageId, messageIds));
  }

  async findProjectById(projectId: string, userId: string) {
    const [project] = await this.db
      .select({
        id: projects.id,
        userId: projects.userId,
        name: projects.name,
      })
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
      .limit(1);

    return project;
  }

  async createProject(data: {
    id: string;
    userId: string;
    name: string;
  }): Promise<{ id: string; userId: string; name: string }> {
    const [project] = await this.db
      .insert(projects)
      .values({
        id: data.id,
        userId: data.userId,
        name: data.name,
      })
      .returning({
        id: projects.id,
        userId: projects.userId,
        name: projects.name,
      });

    return project;
  }

  async findContentById(contentId: number, userId: string) {
    const [content] = await this.db
      .select({
        id: generatedContent.id,
        userId: generatedContent.userId,
        generatedHook: generatedContent.generatedHook,
      })
      .from(generatedContent)
      .where(
        and(
          eq(generatedContent.id, contentId),
          eq(generatedContent.userId, userId),
        ),
      )
      .limit(1);

    return content;
  }

  async findReelsByIds(reelIds: number[], _userId: string) {
    if (reelIds.length === 0) return [];

    return this.db
      .select({
        id: reels.id,
        hook: reels.hook,
        videoUrl: reels.videoUrl,
      })
      .from(reels)
      .where(inArray(reels.id, reelIds));
  }

  async findReelsWithContext(reelIds: number[], _userId: string) {
    if (reelIds.length === 0) return [];

    return this.db
      .select({
        id: reels.id,
        username: reels.username,
        hook: reels.hook,
        views: reels.views,
        niche: sql<string | null>`(SELECT n.name FROM niche n WHERE n.id = ${reels.nicheId})`,
      })
      .from(reels)
      .where(inArray(reels.id, reelIds));
  }

  async findContentForChatContext(contentId: number, userId: string) {
    const [content] = await this.db
      .select({
        id: generatedContent.id,
        version: generatedContent.version,
        outputType: generatedContent.outputType,
        status: generatedContent.status,
        generatedHook: generatedContent.generatedHook,
        postCaption: generatedContent.postCaption,
        generatedScript: generatedContent.generatedScript,
        voiceoverScript: generatedContent.voiceoverScript,
        sceneDescription: generatedContent.sceneDescription,
        generatedMetadata: generatedContent.generatedMetadata,
      })
      .from(generatedContent)
      .where(
        and(
          eq(generatedContent.id, contentId),
          eq(generatedContent.userId, userId),
        ),
      )
      .limit(1);

    return content;
  }

  async findGeneratedContentByIds(contentIds: number[], userId: string) {
    if (contentIds.length === 0) return [];

    return this.db
      .select({
        id: generatedContent.id,
        generatedScript: generatedContent.generatedScript,
      })
      .from(generatedContent)
      .where(
        and(inArray(generatedContent.id, contentIds), eq(generatedContent.userId, userId)),
      );
  }
}
