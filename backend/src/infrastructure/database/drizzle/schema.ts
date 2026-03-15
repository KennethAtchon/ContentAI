import {
  pgTable,
  text,
  boolean,
  timestamp,
  integer,
  numeric,
  json,
  jsonb,
  serial,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

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
    userId: text("user_id").notNull(),
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
    userId: text("user_id").notNull(),
    featureType: text("feature_type").notNull(),
    inputData: json("input_data").notNull(),
    resultData: json("result_data").notNull(),
    usageTimeMs: integer("usage_time_ms").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("feature_usages_user_id_idx").on(t.userId)],
);

// ─── Niches ───────────────────────────────────────────────────────────────────

export const niches = pgTable("niche", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(), // e.g., "Personal Finance"
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  // Scraping configuration
  scrapeLimit: integer("scrape_limit").notNull().default(100), // Max reels to scrape per run
  scrapeMinViews: integer("scrape_min_views").notNull().default(1000), // Minimum views for reels
  scrapeMaxDaysOld: integer("scrape_max_days_old").notNull().default(30), // Maximum age in days
  scrapeIncludeViralOnly: boolean("scrape_include_viral_only")
    .notNull()
    .default(false), // Only viral content
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
    // R2 storage URLs for downloaded media
    videoR2Url: text("video_r2_url"),
    audioR2Url: text("audio_r2_url"),
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
    id: serial("id").primaryKey(),
    reelId: integer("reel_id").notNull(),
    hookPattern: text("hook_pattern"),
    hookCategory: text("hook_category"),
    emotionalTrigger: text("emotional_trigger"),
    formatPattern: text("format_pattern"),
    ctaType: text("cta_type"),
    captionFramework: text("caption_framework"),
    curiosityGapStyle: text("curiosity_gap_style"),
    remixSuggestion: text("remix_suggestion"),
    // Audio analysis
    // e.g. "motivational", "voiceover", "inspirational", "modern_songs", "no_audio"
    audioType: text("audio_type"),
    // Caption analysis
    // e.g. "hook_based", "pov", "cta", "question_driven", "warning", "one_liner",
    //      "teaser", "listicle", "emoji_heavy", "aesthetic_motivational"
    captionStyle: text("caption_style"),
    // e.g. "montserrat", "helvetica", "the_bold_font", "poppins", "arial",
    //      "roboto", "open_sans", "futura", "bebas_neue"
    captionFont: text("caption_font"),
    // Comment bait strategy description
    commentBaitStyle: text("comment_bait_style"),
    // Description of how on-screen text is structured (lists, instructions, etc.)
    onScreenTextStructure: text("on_screen_text_structure"),
    // e.g. "middle", "top", "bottom", "top_and_bottom"
    textPosition: text("text_position"),
    // Enhanced analysis fields
    shotBreakdown: jsonb("shot_breakdown"),
    engagementDrivers: jsonb("engagement_drivers"),
    replicabilityScore: integer("replicability_score"),
    replicabilityNotes: text("replicability_notes"),
    analysisModel: text("analysis_model"),
    rawResponse: jsonb("raw_response"),
    analyzedAt: timestamp("analyzed_at").notNull().defaultNow(),
  },
  (t) => [index("reel_analyses_reel_id_idx").on(t.reelId)],
);

export const generatedContent = pgTable(
  "generated_content",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    sourceReelId: integer("source_reel_id"),
    prompt: text("prompt").notNull(),
    generatedHook: text("generated_hook"),
    generatedCaption: text("generated_caption"),
    generatedScript: text("generated_script"),
    generatedMetadata: jsonb("generated_metadata"),
    thumbnailR2Key: text("thumbnail_r2_key"),
    videoR2Url: text("video_r2_url"),
    outputType: text("output_type").notNull().default("full"),
    model: text("model"),
    status: text("status").notNull().default("draft"),
    version: integer("version").notNull().default(1),
    parentId: integer("parent_id"),
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
    id: serial("id").primaryKey(),
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
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
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
    generatedContentId: integer("generated_content_id"),
    scheduledFor: timestamp("scheduled_for"),
    postedAt: timestamp("posted_at"),
    instagramPageId: text("instagram_page_id"),
    status: text("status").notNull().default("scheduled"),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("queue_items_user_id_idx").on(t.userId),
    index("queue_items_status_idx").on(t.status),
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
    reelRefs: jsonb("reel_refs"), // Array of reel IDs referenced in this message
    generatedContentId: integer("generated_content_id"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("chat_messages_session_id_idx").on(t.sessionId)],
);

// ─── Reel Assets ──────────────────────────────────────────────────────────────
export const reelAssets = pgTable(
  "reel_asset",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    generatedContentId: integer("generated_content_id")
      .notNull()
      .references(() => generatedContent.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    type: text("type").notNull(), // "voiceover" | "music" | "video_clip" | "image"
    r2Key: text("r2_key").notNull(),
    r2Url: text("r2_url"),
    durationMs: integer("duration_ms"),
    metadata: jsonb("metadata").default({}),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("reel_asset_content_idx").on(t.generatedContentId),
    index("reel_asset_user_idx").on(t.userId),
    index("reel_asset_type_idx").on(t.generatedContentId, t.type),
  ],
);

// ─── Music Tracks ─────────────────────────────────────────────────────────────
export const musicTracks = pgTable(
  "music_track",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: text("name").notNull(),
    artistName: text("artist_name"),
    durationSeconds: integer("duration_seconds").notNull(),
    mood: text("mood").notNull(), // "energetic" | "calm" | "dramatic" | "funny" | "inspiring"
    genre: text("genre"),
    r2Key: text("r2_key").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    uploadedBy: text("uploaded_by"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("music_track_mood_idx").on(t.mood),
    index("music_track_active_idx").on(t.isActive),
  ],
);

// ─── Relations ────────────────────────────────────────────────────────────────

export const usersRelations = relations(users, ({ many }) => ({
  orders: many(orders),
  featureUsages: many(featureUsages),
  projects: many(projects),
  chatSessions: many(chatSessions),
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
    messages: many(chatMessages),
  }),
);

export const chatMessagesRelations = relations(chatMessages, ({ one }) => ({
  session: one(chatSessions, {
    fields: [chatMessages.sessionId],
    references: [chatSessions.id],
  }),
  generatedContent: one(generatedContent, {
    fields: [chatMessages.generatedContentId],
    references: [generatedContent.id],
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
    provider: text("provider").notNull(), // "openai" | "claude"
    model: text("model").notNull(),
    featureType: text("feature_type").notNull(), // "reel_analysis" | "generation" | etc.
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
export type ChatMessage = typeof chatMessages.$inferSelect;
export type NewChatMessage = typeof chatMessages.$inferInsert;
export type ReelAsset = typeof reelAssets.$inferSelect;
export type NewReelAsset = typeof reelAssets.$inferInsert;
export type MusicTrack = typeof musicTracks.$inferSelect;
export type NewMusicTrack = typeof musicTracks.$inferInsert;
