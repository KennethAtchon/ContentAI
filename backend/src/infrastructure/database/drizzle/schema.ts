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
    // R2 storage keys for downloaded media
    videoR2Key: text("video_r2_key"),
    audioR2Key: text("audio_r2_key"),
    // Video metadata
    videoLengthSeconds: integer("video_length_seconds"),
    cutFrequencySeconds: numeric("cut_frequency_seconds", { precision: 4, scale: 2 }),
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
    outputType: text("output_type").notNull().default("full"),
    model: text("model"),
    status: text("status").notNull().default("draft"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("generated_content_user_id_idx").on(t.userId),
    index("generated_content_source_reel_idx").on(t.sourceReelId),
  ],
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

// ─── Relations ────────────────────────────────────────────────────────────────

export const usersRelations = relations(users, ({ many }) => ({
  orders: many(orders),
  featureUsages: many(featureUsages),
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
