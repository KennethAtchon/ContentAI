import type { IChatRepository } from "./chat.repository";
import { Errors } from "../../utils/errors/app-error";

const CONTEXT_FIELD_LIMITS = {
  prompt: 600,
  generatedHook: 300,
  postCaption: 700,
  generatedScript: 1400,
  voiceoverScript: 1000,
  sceneDescription: 700,
  generatedMetadata: 1000,
} as const;

type SessionDraftForContext = Awaited<
  ReturnType<IChatRepository["listSessionDraftsForContext"]>
>[number];

type ActiveDraftForContext = NonNullable<
  Awaited<ReturnType<IChatRepository["findContentForChatContext"]>>
>;

export function truncateContextField(
  value: string | null | undefined,
  maxLength: number,
  contentId: number,
): string {
  // Keep prompt context bounded, but leave the model an explicit escape hatch
  // to fetch the full artifact when it needs exact source text.
  if (!value) return "none";
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength)} [truncated; call get_content with contentId ${contentId} for the full record]`;
}

export function buildSessionDraftInventorySection(
  drafts: SessionDraftForContext[],
  activeContentId?: number,
): string {
  if (drafts.length === 0) {
    return "Session drafts:\n- none";
  }

  const lines = drafts.map((draft) => {
    const activeMarker = draft.id === activeContentId ? " [ACTIVE]" : "";
    const hookPreview = truncateContextField(
      draft.generatedHook,
      120,
      draft.id,
    );
    return `- contentId ${draft.id}${activeMarker}; version ${draft.version}; status ${draft.status}; outputType ${draft.outputType}; hook "${hookPreview}"`;
  });

  return `Session drafts:\n${lines.join("\n")}`;
}

export function buildActiveDraftSection(draft: ActiveDraftForContext): string {
  const metadataJson =
    draft.generatedMetadata == null
      ? "none"
      : truncateContextField(
          JSON.stringify(draft.generatedMetadata, null, 2),
          CONTEXT_FIELD_LIMITS.generatedMetadata,
          draft.id,
        );

  return `Active draft:
id: ${draft.id}
version: ${draft.version}
status: ${draft.status}
outputType: ${draft.outputType}
prompt: "${truncateContextField(draft.prompt, CONTEXT_FIELD_LIMITS.prompt, draft.id)}"
generatedHook: "${truncateContextField(draft.generatedHook, CONTEXT_FIELD_LIMITS.generatedHook, draft.id)}"
postCaption: "${truncateContextField(draft.postCaption, CONTEXT_FIELD_LIMITS.postCaption, draft.id)}"
generatedScript: "${truncateContextField(draft.generatedScript, CONTEXT_FIELD_LIMITS.generatedScript, draft.id)}"
voiceoverScript: "${truncateContextField(draft.voiceoverScript, CONTEXT_FIELD_LIMITS.voiceoverScript, draft.id)}"
sceneDescription: "${truncateContextField(draft.sceneDescription, CONTEXT_FIELD_LIMITS.sceneDescription, draft.id)}"
generatedMetadata: ${metadataJson}
parentId: ${draft.parentId ?? "none"}
sourceReelId: ${draft.sourceReelId ?? "none"}`;
}

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
    // Session membership is the source of truth. User ownership alone is no
    // longer enough to treat a draft as valid chat state for this chat.
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

  async createSession(userId: string, projectId: string, title?: string) {
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
    const content = await this.chatRepo.findContentById(
      Number(contentId),
      userId,
    );
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

    if (
      updates.activeContentId !== undefined &&
      updates.activeContentId !== null
    ) {
      await this.assertSessionOwnsContent(
        sessionId,
        userId,
        updates.activeContentId,
      );
    }

    const updated = await this.chatRepo.updateSession(
      sessionId,
      userId,
      updates,
    );

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

    await this.chatRepo.deleteSessionWithCleanup(sessionId, userId);

    return { success: true };
  }

  async getSessionDeletePreview(userId: string, sessionId: string) {
    const session = await this.chatRepo.findSessionById(sessionId, userId);
    if (!session) {
      throw Errors.notFound("Session");
    }

    return this.chatRepo.getSessionDeletePreview(sessionId, userId);
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
    // Content-creating tools call this so the workspace state is persisted by
    // the server at the same moment the new draft is created.
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

  async isContentAttachedToSession(
    sessionId: string,
    userId: string,
    contentId: number,
  ) {
    const sessionContentIds = await this.chatRepo.listSessionContentIds(
      sessionId,
      userId,
    );
    return sessionContentIds.includes(contentId);
  }

  async listSessionDraftsForContext(sessionId: string, userId: string) {
    await this.assertSessionExists(sessionId, userId);
    return this.chatRepo.listSessionDraftsForContext(sessionId, userId);
  }

  async findActiveDraftForSessionContext(
    sessionId: string,
    userId: string,
    effectiveActiveContentId?: number,
  ) {
    // The active draft used for AI grounding must be coherent with the session
    // the user is currently chatting in, not merely "a draft this user owns".
    if (effectiveActiveContentId == null) {
      return undefined;
    }

    const isAttached = await this.isContentAttachedToSession(
      sessionId,
      userId,
      effectiveActiveContentId,
    );
    if (!isAttached) {
      return undefined;
    }

    return this.chatRepo.findContentForChatContext(
      effectiveActiveContentId,
      userId,
    );
  }

  async buildProjectAndAttachmentContext(
    userId: string,
    projectId: string | null,
    reelRefs?: number[],
    mediaRefs?: string[],
  ) {
    const sections: string[] = [];

    if (projectId) {
      const project = await this.chatRepo.findProjectById(projectId, userId);
      if (project) {
        sections.push(`Project: ${project.name}`);
      }
    }

    if (reelRefs && reelRefs.length > 0) {
      const reelRows = await this.chatRepo.findReelsWithContext(
        reelRefs,
        userId,
      );

      if (reelRows.length > 0) {
        const reelContext = reelRows
          .map(
            (r) =>
              `- Reel ID ${r.id} @${r.username} (${r.views.toLocaleString()} views, ${r.niche ?? "unknown niche"}): hook="${r.hook ?? "N/A"}"`,
          )
          .join("\n");
        sections.push(
          `Attached reels (use get_reel_analysis to fetch deep analysis before generating):\n${reelContext}`,
        );
      }
    }

    if (mediaRefs && mediaRefs.length > 0) {
      const assets = await this.chatRepo.findAssetsByIds(mediaRefs, userId);
      if (assets.length > 0) {
        const assetContext = assets
          .map(
            (asset) =>
              `- Asset ID ${asset.id}: type=${asset.type}, source=${asset.source}, name="${asset.name ?? "unnamed"}", mimeType=${asset.mimeType ?? "unknown"}`,
          )
          .join("\n");
        sections.push(`Attached media assets:\n${assetContext}`);
      }
    }

    return sections.join("\n\n");
  }

  async buildSessionDraftInventoryContext(
    sessionId: string,
    userId: string,
    activeContentId?: number,
  ) {
    // Give the model a compact map of the session workspace without spending
    // the token budget on full draft bodies for every draft in the session.
    const drafts = await this.listSessionDraftsForContext(sessionId, userId);
    return buildSessionDraftInventorySection(drafts, activeContentId);
  }

  async buildActiveContentContext(
    sessionId: string,
    userId: string,
    activeContentId?: number,
  ) {
    const active = await this.findActiveDraftForSessionContext(
      sessionId,
      userId,
      activeContentId,
    );
    if (!active) {
      return "";
    }

    return buildActiveDraftSection(active);
  }
}
