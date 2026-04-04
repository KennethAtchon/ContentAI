import {
  pgTable,
  text,
  boolean,
  timestamp,
  integer,
  numeric,
  jsonb,
  serial,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import type { TextPreset as CaptionTextPreset } from "../../../domain/editor/captions/types";

export const users = pgTable("user", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  firebaseUid: text("firebase_uid").unique(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone"),
  address: text("address"),
  notes: text("notes"),
  timezone: text("timezone").default("UTC"),
  role: text("role").notNull().default("user"),
  isActive: boolean("is_active").notNull().default(true),
  isDeleted: boolean("is_deleted").notNull().default(false),
  deletedAt: timestamp("deleted_at"),
  lastLogin: timestamp("last_login"),
  hasUsedFreeTrial: boolean("has_used_free_trial").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdateFn(() => new Date()),
});

export const orders = pgTable(
  "order",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    totalAmount: numeric("total_amount", { precision: 10, scale: 2 }).notNull(),
    status: text("status"),
    stripeSessionId: text("stripe_session_id").unique(),
    skipPayment: boolean("skip_payment").notNull().default(false),
    orderType: text("order_type").notNull().default("one_time"),
    isDeleted: boolean("is_deleted").notNull().default(false),
    deletedAt: timestamp("deleted_at"),
    deletedBy: text("deleted_by"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("orders_user_id_idx").on(t.userId)],
);

export const contactMessages = pgTable("contact_message", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  subject: text("subject").notNull(),
  message: text("message").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const featureUsages = pgTable(
  "feature_usage",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    featureType: text("feature_type").notNull(),
    inputData: jsonb("input_data").notNull(),
    resultData: jsonb("result_data").notNull(),
    usageTimeMs: integer("usage_time_ms").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("feature_usages_user_id_idx").on(t.userId)],
);

// ─── Niches ───────────────────────────────────────────────────────────────────

export const niches = pgTable("niche", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  scrapeLimit: integer("scrape_limit").notNull().default(100),
  scrapeMinViews: integer("scrape_min_views").notNull().default(1000),
  scrapeMaxDaysOld: integer("scrape_max_days_old").notNull().default(30),
  scrapeIncludeViralOnly: boolean("scrape_include_viral_only")
    .notNull()
    .default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdateFn(() => new Date()),
});

// ─── Reels ────────────────────────────────────────────────────────────────────

export const reels = pgTable(
  "reel",
  {
    id: serial("id").primaryKey(),
    externalId: text("external_id").unique(),
    username: text("username").notNull(),
    nicheId: integer("niche_id")
      .notNull()
      .references(() => niches.id, { onDelete: "restrict" }),
    views: integer("views").notNull().default(0),
    likes: integer("likes").notNull().default(0),
    comments: integer("comments").notNull().default(0),
    engagementRate: numeric("engagement_rate", { precision: 5, scale: 2 }),
    hook: text("hook"),
    caption: text("caption"),
    audioName: text("audio_name"),
    audioId: text("audio_id"),
    thumbnailEmoji: text("thumbnail_emoji"),
    thumbnailUrl: text("thumbnail_url"),
    videoUrl: text("video_url"),
    // R2 storage URLs for downloaded media (always prefer these over Instagram CDN URLs)
    videoR2Url: text("video_r2_url"),
    audioR2Url: text("audio_r2_url"),
    thumbnailR2Url: text("thumbnail_r2_url"),
    // Video metadata
    videoLengthSeconds: integer("video_length_seconds"),
    cutFrequencySeconds: numeric("cut_frequency_seconds", {
      precision: 4,
      scale: 2,
    }),
    postedAt: timestamp("posted_at"),
    daysAgo: integer("days_ago"),
    isViral: boolean("is_viral").notNull().default(false),
    scrapedAt: timestamp("scraped_at").notNull().defaultNow(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("reels_niche_id_idx").on(t.nicheId),
    index("reels_views_idx").on(t.views),
  ],
);

export const reelAnalyses = pgTable(
  "reel_analysis",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    reelId: integer("reel_id")
      .notNull()
      .references(() => reels.id, { onDelete: "cascade" }),
    hookPattern: text("hook_pattern"),
    hookCategory: text("hook_category"),
    emotionalTrigger: text("emotional_trigger"),
    formatPattern: text("format_pattern"),
    ctaType: text("cta_type"),
    captionFramework: text("caption_framework"),
    curiosityGapStyle: text("curiosity_gap_style"),
    remixSuggestion: text("remix_suggestion"),
    audioType: text("audio_type"),
    captionStyle: text("caption_style"),
    captionFont: text("caption_font"),
    commentBaitStyle: text("comment_bait_style"),
    onScreenTextStructure: text("on_screen_text_structure"),
    textPosition: text("text_position"),
    shotBreakdown: jsonb("shot_breakdown"),
    engagementDrivers: jsonb("engagement_drivers"),
    replicabilityScore: integer("replicability_score"),
    replicabilityNotes: text("replicability_notes"),
    analysisModel: text("analysis_model"),
    rawResponse: jsonb("raw_response"),
    analyzedAt: timestamp("analyzed_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("reel_analyses_reel_id_idx").on(t.reelId)],
);

/**
 * THE most important table in the entire database.
 *
 * A generated_content row is the thing users are paying for — the finished,
 * structured content package that gets published to Instagram, TikTok, etc.
 * It contains everything needed to produce a real post:
 *   - The hook, script, caption, hashtags, and CTA (AI-authored copy)
 *   - Assets are tracked via content_asset join table (no denormalized URLs)
 *
 * Rows form a version chain via parentId: v1 → v2 → v3 (iterate_content).
 * The tip of each chain (no child exists) is the canonical "current" draft.
 * Status lifecycle: draft → queued → processing → published | failed.
 */
export const generatedContent = pgTable(
  "generated_content",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    sourceReelId: integer("source_reel_id").references(() => reels.id, {
      onDelete: "set null",
    }),
    prompt: text("prompt"),
    // AI-authored copy
    generatedHook: text("generated_hook"),
    postCaption: text("post_caption"),
    generatedScript: text("generated_script"),
    voiceoverScript: text("voiceover_script"),
    sceneDescription: text("scene_description"),
    generatedMetadata: jsonb("generated_metadata"),
    outputType: text("output_type").notNull().default("full"),
    model: text("model"),
    // draft → queued → processing → published | failed
    status: text("status").notNull().default("draft"),
    version: integer("version").notNull().default(1),
    parentId: integer("parent_id").references(
      (): AnyPgColumn => generatedContent.id,
    ),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("generated_content_user_id_idx").on(t.userId),
    index("generated_content_source_reel_idx").on(t.sourceReelId),
  ],
);

export const trendingAudio = pgTable(
  "trending_audio",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    audioId: text("audio_id").notNull().unique(),
    audioName: text("audio_name").notNull(),
    artistName: text("artist_name"),
    useCount: integer("use_count").notNull().default(0),
    firstSeen: timestamp("first_seen").notNull().defaultNow(),
    lastSeen: timestamp("last_seen").notNull().defaultNow(),
  },
  (t) => [index("trending_audio_audio_id_idx").on(t.audioId)],
);

export const instagramPages = pgTable("instagram_page", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  pageId: text("page_id").notNull(),
  username: text("username").notNull(),
  accessToken: text("access_token"),
  tokenExpiresAt: timestamp("token_expires_at"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const queueItems = pgTable(
  "queue_item",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    generatedContentId: integer("generated_content_id").references(
      () => generatedContent.id,
      { onDelete: "cascade" },
    ),
    scheduledFor: timestamp("scheduled_for"),
    postedAt: timestamp("posted_at"),
    instagramPageId: text("instagram_page_id").references(
      () => instagramPages.id,
      { onDelete: "set null" },
    ),
    status: text("status").notNull().default("scheduled"),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("queue_items_user_id_idx").on(t.userId),
    index("queue_items_status_idx").on(t.status),
  ],
);

// ─── Assets ───────────────────────────────────────────────────────────────────
// Central registry for every file stored in R2.
// Replaces the old reel_asset and media_item tables.

export const assets = pgTable(
  "asset",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
    // nullable for platform assets (music tracks, system-generated)

    type: text("type").notNull(),
    // "video" | "image" | "audio" | "voiceover" | "thumbnail" | "video_clip" | "assembled_video"

    source: text("source").notNull(),
    // "uploaded"  — user uploaded via media library
    // "generated" — produced by video render pipeline
    // "tts"       — produced by text-to-speech
    // "platform"  — admin-uploaded platform asset (music tracks)
    // "export"    — final render from an export job

    name: text("name"),
    mimeType: text("mime_type"),
    r2Key: text("r2_key").notNull(),
    r2Url: text("r2_url"),
    sizeBytes: integer("size_bytes"),
    durationMs: integer("duration_ms"),
    metadata: jsonb("metadata").default({}),

    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("assets_user_id_idx").on(t.userId),
    index("assets_type_source_idx").on(t.type, t.source),
  ],
);

// ─── Content Assets ───────────────────────────────────────────────────────────
// Join table: which assets belong to which generated content, and in what role.
// Replaces the old reel_asset table's content-linking function.

export const contentAssets = pgTable(
  "content_asset",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    generatedContentId: integer("generated_content_id")
      .notNull()
      .references(() => generatedContent.id, { onDelete: "cascade" }),
    assetId: text("asset_id")
      .notNull()
      .references(() => assets.id, { onDelete: "restrict" }),
    role: text("role").notNull(),
    // "voiceover" | "background_music" | "thumbnail" | "final_video" | "video_clip" | "assembled_video" | "image"
  },
  (t) => [
    index("content_assets_content_idx").on(t.generatedContentId),
    index("content_assets_asset_idx").on(t.assetId),
    index("content_assets_role_idx").on(t.generatedContentId, t.role),
  ],
);

// ─── Projects ───────────────────────────────────────────────────────────────

export const projects = pgTable(
  "project",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
  },
  (t) => [index("projects_user_id_idx").on(t.userId)],
);

// ─── Chat ────────────────────────────────────────────────────────────────────

export const chatSessions = pgTable(
  "chat_session",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id").notNull(),
    projectId: text("project_id").references(() => projects.id, {
      onDelete: "cascade",
    }),
    activeContentId: integer("active_content_id").references(
      () => generatedContent.id,
      { onDelete: "set null" },
    ),
    title: text("title").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
  },
  (t) => [
    index("chat_sessions_user_id_idx").on(t.userId),
    index("chat_sessions_project_id_idx").on(t.projectId),
  ],
);

export const chatSessionContent = pgTable(
  "chat_session_content",
  {
    id: serial("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => chatSessions.id, { onDelete: "cascade" }),
    contentId: integer("content_id")
      .notNull()
      .references(() => generatedContent.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("chat_session_content_session_content_idx").on(
      t.sessionId,
      t.contentId,
    ),
    index("chat_session_content_session_idx").on(t.sessionId),
    index("chat_session_content_content_idx").on(t.contentId),
  ],
);

export const chatMessages = pgTable(
  "chat_message",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    sessionId: text("session_id")
      .notNull()
      .references(() => chatSessions.id, { onDelete: "cascade" }),
    role: text("role").notNull(), // "user" | "assistant" | "system"
    content: text("content").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("chat_messages_session_id_idx").on(t.sessionId)],
);

// ─── Message Attachments ──────────────────────────────────────────────────────
// Join table: replaces jsonb reelRefs / mediaRefs columns on chat_message.
// Enforces referential integrity and enables reverse lookups.

export const messageAttachments = pgTable(
  "message_attachment",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    messageId: text("message_id")
      .notNull()
      .references(() => chatMessages.id, { onDelete: "cascade" }),
    entityType: text("entity_type").notNull(), // "reel" | "asset"
    reelId: integer("reel_id").references(() => reels.id, {
      onDelete: "set null",
    }),
    assetId: text("asset_id").references(() => assets.id, {
      onDelete: "set null",
    }),
  },
  (t) => [
    index("message_attachments_message_idx").on(t.messageId),
    index("message_attachments_reel_idx").on(t.reelId),
    index("message_attachments_asset_idx").on(t.assetId),
  ],
);

// ─── Music Tracks ─────────────────────────────────────────────────────────────
// Platform catalog of background music. r2Key is stored on the linked asset row.

export const musicTracks = pgTable(
  "music_track",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    assetId: text("asset_id")
      .notNull()
      .references(() => assets.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    artistName: text("artist_name"),
    durationSeconds: integer("duration_seconds").notNull(),
    mood: text("mood").notNull(),
    genre: text("genre"),
    isActive: boolean("is_active").notNull().default(true),
    uploadedBy: text("uploaded_by"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("music_track_mood_idx").on(t.mood),
    index("music_track_active_idx").on(t.isActive),
  ],
);

// ─── Edit Projects ────────────────────────────────────────────────────────────

export const editProjects = pgTable(
  "edit_project",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull().default("Untitled Edit"),
    autoTitle: boolean("auto_title").notNull().default(true),
    generatedContentId: integer("generated_content_id").references(
      () => generatedContent.id,
      { onDelete: "set null" },
    ),
    tracks: jsonb("tracks").notNull().default([]),
    durationMs: integer("duration_ms").notNull().default(0),
    fps: integer("fps").notNull().default(30),
    resolution: text("resolution").notNull().default("1080x1920"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
    // ── publish / draft model ──────────────────────────────────────
    status: text("status").notNull().default("draft"),
    // "draft" | "published"
    publishedAt: timestamp("published_at"),
    userHasEdited: boolean("user_has_edited").notNull().default(false),
    thumbnailUrl: text("thumbnail_url"),
    parentProjectId: text("parent_project_id").references(
      (): AnyPgColumn => editProjects.id,
      { onDelete: "cascade" },
    ),
  },
  (t) => [
    index("edit_projects_user_idx").on(t.userId),
    index("edit_projects_content_idx").on(t.generatedContentId),
    index("edit_projects_status_idx").on(t.userId, t.status),
    // 1:1: one root editor project per (user, generatedContent).
    // Partial index — root projects only (parentProjectId IS NULL), and only
    // when generatedContentId is non-null. Snapshot rows are excluded so they
    // do not violate this constraint.
    uniqueIndex("edit_project_unique_content_root")
      .on(t.userId, t.generatedContentId)
      .where(
        sql`parent_project_id IS NULL AND generated_content_id IS NOT NULL`,
      ),
  ],
);

export const exportJobs = pgTable(
  "export_job",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    editProjectId: text("edit_project_id")
      .notNull()
      .references(() => editProjects.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // "queued" | "rendering" | "done" | "failed"
    status: text("status").notNull().default("queued"),
    progress: integer("progress").notNull().default(0),
    outputAssetId: text("output_asset_id").references(() => assets.id, {
      onDelete: "set null",
    }),
    error: text("error"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
  },
  (t) => [
    index("export_jobs_project_idx").on(t.editProjectId),
    index("export_jobs_user_idx").on(t.userId),
  ],
);

// ─── System Config ─────────────────────────────────────────────────────────────

export const systemConfig = pgTable(
  "system_config",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    category: text("category").notNull(),
    key: text("key").notNull(),
    value: text("value"),
    encryptedValue: text("encrypted_value"),
    valueType: text("value_type").notNull().default("string"),
    isSecret: boolean("is_secret").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    description: text("description"),
    updatedBy: text("updated_by"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
  },
  (t) => [
    uniqueIndex("system_config_category_key_idx").on(t.category, t.key),
    index("system_config_category_idx").on(t.category),
  ],
);

// ─── User Settings ──────────────────────────────────────────────────────────

export const userSettings = pgTable(
  "user_settings",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: "cascade" }),
    preferredAiProvider: text("preferred_ai_provider"),
    preferredVideoProvider: text("preferred_video_provider"),
    preferredVoiceId: text("preferred_voice_id"),
    preferredTtsSpeed: text("preferred_tts_speed"),
    preferredAspectRatio: text("preferred_aspect_ratio"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
  },
  (t) => [uniqueIndex("user_settings_user_id_idx").on(t.userId)],
);

// ─── Relations ────────────────────────────────────────────────────────────────

export const usersRelations = relations(users, ({ many, one }) => ({
  orders: many(orders),
  featureUsages: many(featureUsages),
  projects: many(projects),
  chatSessions: many(chatSessions),
  assets: many(assets),
  settings: one(userSettings, {
    fields: [users.id],
    references: [userSettings.userId],
  }),
}));

export const ordersRelations = relations(orders, ({ one }) => ({
  user: one(users, { fields: [orders.userId], references: [users.id] }),
}));

export const featureUsagesRelations = relations(featureUsages, ({ one }) => ({
  user: one(users, { fields: [featureUsages.userId], references: [users.id] }),
}));

export const nichesRelations = relations(niches, ({ many }) => ({
  reels: many(reels),
}));

export const reelsRelations = relations(reels, ({ one }) => ({
  niche: one(niches, { fields: [reels.nicheId], references: [niches.id] }),
}));

export const assetsRelations = relations(assets, ({ one, many }) => ({
  user: one(users, { fields: [assets.userId], references: [users.id] }),
  contentAssets: many(contentAssets),
  messageAttachments: many(messageAttachments),
}));

export const contentAssetsRelations = relations(contentAssets, ({ one }) => ({
  generatedContent: one(generatedContent, {
    fields: [contentAssets.generatedContentId],
    references: [generatedContent.id],
  }),
  asset: one(assets, {
    fields: [contentAssets.assetId],
    references: [assets.id],
  }),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  user: one(users, { fields: [projects.userId], references: [users.id] }),
  chatSessions: many(chatSessions),
}));

export const chatSessionsRelations = relations(
  chatSessions,
  ({ one, many }) => ({
    user: one(users, { fields: [chatSessions.userId], references: [users.id] }),
    project: one(projects, {
      fields: [chatSessions.projectId],
      references: [projects.id],
    }),
    activeContent: one(generatedContent, {
      fields: [chatSessions.activeContentId],
      references: [generatedContent.id],
    }),
    contents: many(chatSessionContent),
    messages: many(chatMessages),
  }),
);

export const chatSessionContentRelations = relations(
  chatSessionContent,
  ({ one }) => ({
    session: one(chatSessions, {
      fields: [chatSessionContent.sessionId],
      references: [chatSessions.id],
    }),
    content: one(generatedContent, {
      fields: [chatSessionContent.contentId],
      references: [generatedContent.id],
    }),
  }),
);

export const chatMessagesRelations = relations(
  chatMessages,
  ({ one, many }) => ({
    session: one(chatSessions, {
      fields: [chatMessages.sessionId],
      references: [chatSessions.id],
    }),
    attachments: many(messageAttachments),
  }),
);

export const messageAttachmentsRelations = relations(
  messageAttachments,
  ({ one }) => ({
    message: one(chatMessages, {
      fields: [messageAttachments.messageId],
      references: [chatMessages.id],
    }),
    reel: one(reels, {
      fields: [messageAttachments.reelId],
      references: [reels.id],
    }),
    asset: one(assets, {
      fields: [messageAttachments.assetId],
      references: [assets.id],
    }),
  }),
);

export const editProjectsRelations = relations(
  editProjects,
  ({ one, many }) => ({
    user: one(users, { fields: [editProjects.userId], references: [users.id] }),
    exportJobs: many(exportJobs),
  }),
);

export const exportJobsRelations = relations(exportJobs, ({ one }) => ({
  project: one(editProjects, {
    fields: [exportJobs.editProjectId],
    references: [editProjects.id],
  }),
  outputAsset: one(assets, {
    fields: [exportJobs.outputAssetId],
    references: [assets.id],
  }),
}));

export const userSettingsRelations = relations(userSettings, ({ one }) => ({
  user: one(users, {
    fields: [userSettings.userId],
    references: [users.id],
  }),
}));

// ─── AI Cost Ledger ────────────────────────────────────────────────────────────

export const aiCostLedger = pgTable(
  "ai_cost_ledger",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id"), // nullable for system/background calls
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    featureType: text("feature_type").notNull(),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    inputCost: numeric("input_cost", { precision: 12, scale: 8 })
      .notNull()
      .default("0"),
    outputCost: numeric("output_cost", { precision: 12, scale: 8 })
      .notNull()
      .default("0"),
    totalCost: numeric("total_cost", { precision: 12, scale: 8 })
      .notNull()
      .default("0"),
    durationMs: integer("duration_ms").notNull().default(0),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("ai_cost_ledger_created_at_idx").on(t.createdAt),
    index("ai_cost_ledger_user_id_idx").on(t.userId),
    index("ai_cost_ledger_feature_type_idx").on(t.featureType),
  ],
);

export type AiCostEntry = typeof aiCostLedger.$inferSelect;

// ─── Captions ──────────────────────────────────────────────────────────────────
// Word-level transcription data from Whisper, one row per (user, asset).

export interface Token {
  text: string;
  startMs: number;
  endMs: number;
}

export type CaptionDocSource = "whisper" | "manual" | "import";

/**
 * Phase 2 stores the canonical preset JSON in the database before the full
 * caption renderer/export type system lands in later phases.
 */
export type CaptionPresetDefinition = CaptionTextPreset;

export const captionDocs = pgTable(
  "caption_doc",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    assetId: text("asset_id").references(() => assets.id, {
      onDelete: "cascade",
    }),
    language: text("language").notNull().default("en"),
    tokens: jsonb("tokens").notNull().$type<Token[]>(),
    fullText: text("full_text").notNull(),
    source: text("source")
      .notNull()
      .default("whisper")
      .$type<CaptionDocSource>(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
  },
  (t) => [
    index("caption_doc_asset_idx").on(t.assetId),
    index("caption_doc_user_idx").on(t.userId),
    uniqueIndex("caption_doc_user_asset_unique")
      .on(t.userId, t.assetId)
      .where(sql`asset_id IS NOT NULL`),
  ],
);

export const captionDocsRelations = relations(captionDocs, ({ one }) => ({
  user: one(users, { fields: [captionDocs.userId], references: [users.id] }),
  asset: one(assets, {
    fields: [captionDocs.assetId],
    references: [assets.id],
  }),
}));

export const captionPresets = pgTable("caption_preset", {
  id: text("id").primaryKey(),
  definition: jsonb("definition").notNull().$type<CaptionPresetDefinition>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdateFn(() => new Date()),
});

// ─── Inferred types ───────────────────────────────────────────────────────────

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;
export type ContactMessage = typeof contactMessages.$inferSelect;
export type NewContactMessage = typeof contactMessages.$inferInsert;
export type FeatureUsage = typeof featureUsages.$inferSelect;
export type NewFeatureUsage = typeof featureUsages.$inferInsert;
export type Niche = typeof niches.$inferSelect;
export type NewNiche = typeof niches.$inferInsert;
export type Reel = typeof reels.$inferSelect;
export type NewReel = typeof reels.$inferInsert;
export type ReelAnalysis = typeof reelAnalyses.$inferSelect;
export type NewReelAnalysis = typeof reelAnalyses.$inferInsert;
export type GeneratedContent = typeof generatedContent.$inferSelect;
export type NewGeneratedContent = typeof generatedContent.$inferInsert;
export type InstagramPage = typeof instagramPages.$inferSelect;
export type QueueItem = typeof queueItems.$inferSelect;
export type TrendingAudio = typeof trendingAudio.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type ChatSession = typeof chatSessions.$inferSelect;
export type NewChatSession = typeof chatSessions.$inferInsert;
export type ChatSessionContent = typeof chatSessionContent.$inferSelect;
export type NewChatSessionContent = typeof chatSessionContent.$inferInsert;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type NewChatMessage = typeof chatMessages.$inferInsert;
export type Asset = typeof assets.$inferSelect;
export type NewAsset = typeof assets.$inferInsert;
export type ContentAsset = typeof contentAssets.$inferSelect;
export type NewContentAsset = typeof contentAssets.$inferInsert;
export type MessageAttachment = typeof messageAttachments.$inferSelect;
export type NewMessageAttachment = typeof messageAttachments.$inferInsert;
export type MusicTrack = typeof musicTracks.$inferSelect;
export type NewMusicTrack = typeof musicTracks.$inferInsert;
export type EditProject = typeof editProjects.$inferSelect;
export type NewEditProject = typeof editProjects.$inferInsert;
export type ExportJob = typeof exportJobs.$inferSelect;
export type NewExportJob = typeof exportJobs.$inferInsert;
export type SystemConfig = typeof systemConfig.$inferSelect;
export type NewSystemConfig = typeof systemConfig.$inferInsert;
export type UserSettings = typeof userSettings.$inferSelect;
export type NewUserSettings = typeof userSettings.$inferInsert;
export type CaptionDoc = typeof captionDocs.$inferSelect;
export type NewCaptionDoc = typeof captionDocs.$inferInsert;
export type CaptionPreset = typeof captionPresets.$inferSelect;
export type NewCaptionPreset = typeof captionPresets.$inferInsert;
