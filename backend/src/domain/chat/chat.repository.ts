import { eq, and, desc, sql, inArray } from "drizzle-orm";
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
  }): Promise<{
    id: string;
    userId: string;
    projectId: string | null;
    title: string;
    createdAt: Date;
    updatedAt: Date;
  }>;

  updateSession(
    sessionId: string,
    userId: string,
    data: { title: string },
  ): Promise<{
    id: string;
    userId: string;
    projectId: string | null;
    title: string;
    createdAt: Date;
    updatedAt: Date;
  }>;

  deleteSession(sessionId: string, userId: string): Promise<void>;

  // Messages
  listMessages(sessionId: string): Promise<
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

  // Content and reels lookup
  findContentById(
    contentId: number,
    userId: string,
  ): Promise<
    | {
        id: number;
        userId: string;
        projectId: string | null;
        hook: string | null;
      }
    | undefined
  >;

  findReelsByIds(
    reelIds: number[],
    userId: string,
  ): Promise<
    {
      id: number;
      reelId: string;
      videoUrl: string | null;
    }[]
  >;

  findGeneratedContentByIds(
    contentIds: number[],
    userId: string,
  ): Promise<
    {
      id: number;
      script: string | null;
      imageUrl: string | null;
      voiceOverUrl: string | null;
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
    const [session] = await this.db
      .select({
        id: chatSessions.id,
        userId: chatSessions.userId,
        projectId: chatSessions.projectId,
        title: chatSessions.title,
        createdAt: chatSessions.createdAt,
        updatedAt: chatSessions.updatedAt,
      })
      .from(chatSessions)
      .innerJoin(
        generatedContent,
        eq(chatSessions.projectId, generatedContent.projectId),
      )
      .where(
        and(
          eq(generatedContent.id, Number(contentId)),
          eq(generatedContent.userId, userId),
          eq(chatSessions.userId, userId),
        ),
      )
      .limit(1);

    return session;
  }

  async createSession(data: {
    id: string;
    userId: string;
    projectId: string;
    title: string;
  }) {
    const [newSession] = await this.db
      .insert(chatSessions)
      .values({
        id: data.id,
        userId: data.userId,
        projectId: data.projectId,
        title: data.title,
      })
      .returning({
        id: chatSessions.id,
        userId: chatSessions.userId,
        projectId: chatSessions.projectId,
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
    data: { title: string },
  ) {
    const [updated] = await this.db
      .update(chatSessions)
      .set(data)
      .where(and(eq(chatSessions.id, sessionId), eq(chatSessions.userId, userId)))
      .returning({
        id: chatSessions.id,
        userId: chatSessions.userId,
        projectId: chatSessions.projectId,
        title: chatSessions.title,
        createdAt: chatSessions.createdAt,
        updatedAt: chatSessions.updatedAt,
      });

    if (!updated) {
      throw new Error("Failed to update session");
    }

    return updated;
  }

  async deleteSession(sessionId: string, userId: string): Promise<void> {
    await this.db
      .delete(chatSessions)
      .where(and(eq(chatSessions.id, sessionId), eq(chatSessions.userId, userId)));
  }

  async listMessages(sessionId: string) {
    const messages = await this.db
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

    // Fetch attachments for all messages
    const messageIds = messages.map((m) => m.id);
    if (messageIds.length === 0) {
      return messages.map((m) => ({ ...m, attachments: [] }));
    }

    const attachments = await this.db
      .select({
        id: messageAttachments.id,
        messageId: messageAttachments.messageId,
        type: messageAttachments.type,
        reelId: messageAttachments.reelId,
        mediaAssetId: messageAttachments.mediaAssetId,
        generatedContentId: messageAttachments.generatedContentId,
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
        type: a.type,
        reelId: a.reelId ?? null,
        mediaAssetId: a.mediaAssetId ?? null,
        generatedContentId: a.generatedContentId ?? null,
      })),
    );
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

  async findContentById(contentId: number, userId: string) {
    const [content] = await this.db
      .select({
        id: generatedContent.id,
        userId: generatedContent.userId,
        projectId: generatedContent.projectId,
        hook: generatedContent.hook,
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

  async findReelsByIds(reelIds: number[], userId: string) {
    if (reelIds.length === 0) return [];

    return this.db
      .select({
        id: reels.id,
        reelId: reels.reelId,
        videoUrl: reels.videoUrl,
      })
      .from(reels)
      .where(and(inArray(reels.id, reelIds), eq(reels.userId, userId)));
  }

  async findGeneratedContentByIds(contentIds: number[], userId: string) {
    if (contentIds.length === 0) return [];

    return this.db
      .select({
        id: generatedContent.id,
        script: generatedContent.script,
        imageUrl: generatedContent.imageUrl,
        voiceOverUrl: generatedContent.voiceOverUrl,
      })
      .from(generatedContent)
      .where(
        and(inArray(generatedContent.id, contentIds), eq(generatedContent.userId, userId)),
      );
  }
}
