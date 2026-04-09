import { eq, and, desc, sql, inArray, or } from "drizzle-orm";
import {
  assets,
  chatSessions,
  chatSessionContent,
  chatMessages,
  messageAttachments,
  projects,
  reels,
  generatedContent,
  editProjects,
} from "../../infrastructure/database/drizzle/schema";
import type { AppDb } from "../database.types";
import { resolveGeneratedContentChainTip } from "../content/content.repository";

export interface IChatRepository {
  // Sessions
  listSessions(
    userId: string,
    projectId?: string,
  ): Promise<
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

  getSessionDeletePreview(
    sessionId: string,
    userId: string,
  ): Promise<{
    messages: number;
    generatedContent: number;
    editorProjects: number;
  }>;

  deleteSessionWithCleanup(sessionId: string, userId: string): Promise<void>;

  // Messages
  listMessages(
    sessionId: string,
    limit?: number,
  ): Promise<
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
  }): Promise<void>;

  attachContentToSession(
    sessionId: string,
    userId: string,
    contentId: number,
  ): Promise<void>;

  listSessionContentIds(sessionId: string, userId: string): Promise<number[]>;

  updateSessionTimestamp(sessionId: string): Promise<void>;

  // Attachments
  createAttachments(
    attachments: {
      messageId: string;
      type: string;
      reelId?: number | null;
      mediaAssetId?: string | null;
    }[],
  ): Promise<void>;

  listAttachmentsForMessages(messageIds: string[]): Promise<
    Array<{
      id: string;
      messageId: string;
      type: string;
      reelId: number | null;
      mediaAssetId: string | null;
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
        prompt: string | null;
        version: number;
        outputType: string;
        status: string;
        generatedHook: string | null;
        postCaption: string | null;
        generatedScript: string | null;
        voiceoverScript: string | null;
        sceneDescription: string | null;
        generatedMetadata: unknown;
        parentId: number | null;
        sourceReelId: number | null;
      }
    | undefined
  >;

  listSessionDraftsForContext(
    sessionId: string,
    userId: string,
  ): Promise<
    Array<{
      id: number;
      version: number;
      outputType: string;
      status: string;
      generatedHook: string | null;
      createdAt: Date;
    }>
  >;

  findAssetsByIds(
    assetIds: string[],
    userId: string,
  ): Promise<
    Array<{
      id: string;
      type: string;
      source: string;
      name: string | null;
      mimeType: string | null;
    }>
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

  private async buildSessionDeletePlan(sessionId: string, userId: string) {
    const [messageCountRow] = await this.db
      .select({
        count: sql<number>`count(*)`.mapWith(Number),
      })
      .from(chatMessages)
      .innerJoin(chatSessions, eq(chatMessages.sessionId, chatSessions.id))
      .where(
        and(eq(chatMessages.sessionId, sessionId), eq(chatSessions.userId, userId)),
      );

    const contentRows = await this.db
      .select({
        contentId: chatSessionContent.contentId,
      })
      .from(chatSessionContent)
      .innerJoin(chatSessions, eq(chatSessionContent.sessionId, chatSessions.id))
      .where(
        and(eq(chatSessionContent.sessionId, sessionId), eq(chatSessions.userId, userId)),
      );

    const contentIds = contentRows.map((row) => row.contentId);
    if (contentIds.length === 0) {
      return {
        messages: messageCountRow?.count ?? 0,
        generatedContentIds: [] as number[],
        editorProjectIds: [] as string[],
      };
    }

    const ownershipRows = await this.db
      .select({
        contentId: chatSessionContent.contentId,
        sessionCount: sql<number>`count(*)`.mapWith(Number),
      })
      .from(chatSessionContent)
      .where(inArray(chatSessionContent.contentId, contentIds))
      .groupBy(chatSessionContent.contentId);

    const generatedContentIds = ownershipRows
      .filter((row) => row.sessionCount === 1)
      .map((row) => row.contentId);

    const editorProjectIds =
      generatedContentIds.length === 0
        ? []
        : (
            await this.db
              .select({
                id: editProjects.id,
              })
              .from(editProjects)
              .where(
                and(
                  eq(editProjects.userId, userId),
                  inArray(editProjects.generatedContentId, generatedContentIds),
                  eq(editProjects.userHasEdited, false),
                ),
              )
          ).map((row) => row.id);

    return {
      messages: messageCountRow?.count ?? 0,
      generatedContentIds,
      editorProjectIds,
    };
  }

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
      .where(
        and(eq(chatSessions.id, sessionId), eq(chatSessions.userId, userId)),
      )
      .limit(1);

    return session;
  }

  async findSessionByContentId(userId: string, contentId: string) {
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
        chatSessionContent,
        eq(chatSessions.id, chatSessionContent.sessionId),
      )
      .where(
        and(
          or(
            eq(chatSessions.activeContentId, Number(contentId)),
            eq(chatSessionContent.contentId, Number(contentId)),
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
      .where(
        and(eq(chatSessions.id, sessionId), eq(chatSessions.userId, userId)),
      )
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
      .where(
        and(eq(chatSessions.id, sessionId), eq(chatSessions.userId, userId)),
      );
  }

  async deleteSession(sessionId: string, userId: string): Promise<void> {
    await this.db
      .delete(chatSessions)
      .where(
        and(eq(chatSessions.id, sessionId), eq(chatSessions.userId, userId)),
      );
  }

  async getSessionDeletePreview(sessionId: string, userId: string) {
    const plan = await this.buildSessionDeletePlan(sessionId, userId);
    return {
      messages: plan.messages,
      generatedContent: plan.generatedContentIds.length,
      editorProjects: plan.editorProjectIds.length,
    };
  }

  async deleteSessionWithCleanup(sessionId: string, userId: string): Promise<void> {
    const plan = await this.buildSessionDeletePlan(sessionId, userId);

    await this.db.transaction(async (tx) => {
      if (plan.editorProjectIds.length > 0) {
        await tx
          .delete(editProjects)
          .where(inArray(editProjects.id, plan.editorProjectIds));
      }

      if (plan.generatedContentIds.length > 0) {
        await tx
          .delete(generatedContent)
          .where(inArray(generatedContent.id, plan.generatedContentIds));
      }

      await tx
        .delete(chatSessions)
        .where(and(eq(chatSessions.id, sessionId), eq(chatSessions.userId, userId)));
    });
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

    const messages = limit ? await base.limit(limit) : await base;

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
  }): Promise<void> {
    await this.db.insert(chatMessages).values({
      id: data.id,
      sessionId: data.sessionId,
      role: "assistant",
      content: data.content,
    });
  }

  async attachContentToSession(
    sessionId: string,
    userId: string,
    contentId: number,
  ): Promise<void> {
    const session = await this.findSessionById(sessionId, userId);
    if (!session) {
      throw new Error("Session not found");
    }

    await this.db
      .insert(chatSessionContent)
      .values({
        sessionId,
        contentId,
      })
      .onConflictDoNothing({
        target: [chatSessionContent.sessionId, chatSessionContent.contentId],
      });
  }

  async listSessionContentIds(
    sessionId: string,
    userId: string,
  ): Promise<number[]> {
    const rows = await this.db
      .select({ contentId: chatSessionContent.contentId })
      .from(chatSessionContent)
      .innerJoin(
        chatSessions,
        eq(chatSessionContent.sessionId, chatSessions.id),
      )
      .where(
        and(
          eq(chatSessionContent.sessionId, sessionId),
          eq(chatSessions.userId, userId),
        ),
      );

    return [...new Set(rows.map((row) => row.contentId))];
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
        niche: sql<
          string | null
        >`(SELECT n.name FROM niche n WHERE n.id = ${reels.nicheId})`,
      })
      .from(reels)
      .where(inArray(reels.id, reelIds));
  }

  async findContentForChatContext(contentId: number, userId: string) {
    const [content] = await this.db
      .select({
        id: generatedContent.id,
        prompt: generatedContent.prompt,
        version: generatedContent.version,
        outputType: generatedContent.outputType,
        status: generatedContent.status,
        generatedHook: generatedContent.generatedHook,
        postCaption: generatedContent.postCaption,
        generatedScript: generatedContent.generatedScript,
        voiceoverScript: generatedContent.voiceoverScript,
        sceneDescription: generatedContent.sceneDescription,
        generatedMetadata: generatedContent.generatedMetadata,
        parentId: generatedContent.parentId,
        sourceReelId: generatedContent.sourceReelId,
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

  async listSessionDraftsForContext(sessionId: string, userId: string) {
    const attachedContentIds = await this.listSessionContentIds(
      sessionId,
      userId,
    );
    if (attachedContentIds.length === 0) return [];

    // Session membership stores every draft version the session has touched,
    // but prompt/workspace context should talk about the current usable tips.
    const tipIds = [
      ...new Set(
        await Promise.all(
          attachedContentIds.map(async (contentId) => {
            const tip = await resolveGeneratedContentChainTip(
              this.db,
              contentId,
              userId,
            );
            return tip.id;
          }),
        ),
      ),
    ];

    return this.db
      .select({
        id: generatedContent.id,
        version: generatedContent.version,
        outputType: generatedContent.outputType,
        status: generatedContent.status,
        generatedHook: generatedContent.generatedHook,
        createdAt: generatedContent.createdAt,
      })
      .from(generatedContent)
      .where(
        and(
          eq(generatedContent.userId, userId),
          inArray(generatedContent.id, tipIds),
        ),
      )
      .orderBy(generatedContent.createdAt);
  }

  async findAssetsByIds(assetIds: string[], userId: string) {
    if (assetIds.length === 0) return [];

    return this.db
      .select({
        id: assets.id,
        type: assets.type,
        source: assets.source,
        name: assets.name,
        mimeType: assets.mimeType,
      })
      .from(assets)
      .where(and(inArray(assets.id, assetIds), eq(assets.userId, userId)));
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
        and(
          inArray(generatedContent.id, contentIds),
          eq(generatedContent.userId, userId),
        ),
      );
  }
}
