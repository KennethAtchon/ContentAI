CREATE TABLE "ai_cost_ledger" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"feature_type" text NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"input_cost" numeric(12, 8) DEFAULT '0' NOT NULL,
	"output_cost" numeric(12, 8) DEFAULT '0' NOT NULL,
	"total_cost" numeric(12, 8) DEFAULT '0' NOT NULL,
	"duration_ms" integer DEFAULT 0 NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_message" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"reel_refs" jsonb,
	"generated_content_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_session" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"project_id" text,
	"title" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contact_message" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"subject" text NOT NULL,
	"message" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feature_usage" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"feature_type" text NOT NULL,
	"input_data" json NOT NULL,
	"result_data" json NOT NULL,
	"usage_time_ms" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "generated_content" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"source_reel_id" integer,
	"prompt" text NOT NULL,
	"generated_hook" text,
	"generated_caption" text,
	"generated_script" text,
	"clean_script_for_audio" text,
	"scene_description" text,
	"generated_metadata" jsonb,
	"voiceover_url" text,
	"background_audio_url" text,
	"thumbnail_r2_key" text,
	"video_r2_url" text,
	"output_type" text DEFAULT 'full' NOT NULL,
	"model" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"parent_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "instagram_page" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"page_id" text NOT NULL,
	"username" text NOT NULL,
	"access_token" text,
	"token_expires_at" timestamp,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "music_track" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"artist_name" text,
	"duration_seconds" integer NOT NULL,
	"mood" text NOT NULL,
	"genre" text,
	"r2_key" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"uploaded_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "niche" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"scrape_limit" integer DEFAULT 100 NOT NULL,
	"scrape_min_views" integer DEFAULT 1000 NOT NULL,
	"scrape_max_days_old" integer DEFAULT 30 NOT NULL,
	"scrape_include_viral_only" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "niche_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "order" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"total_amount" numeric(10, 2) NOT NULL,
	"status" text,
	"stripe_session_id" text,
	"skip_payment" boolean DEFAULT false NOT NULL,
	"order_type" text DEFAULT 'one_time' NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp,
	"deleted_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "order_stripe_session_id_unique" UNIQUE("stripe_session_id")
);
--> statement-breakpoint
CREATE TABLE "project" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "queue_item" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"generated_content_id" integer,
	"scheduled_for" timestamp,
	"posted_at" timestamp,
	"instagram_page_id" text,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reel_analysis" (
	"id" serial PRIMARY KEY NOT NULL,
	"reel_id" integer NOT NULL,
	"hook_pattern" text,
	"hook_category" text,
	"emotional_trigger" text,
	"format_pattern" text,
	"cta_type" text,
	"caption_framework" text,
	"curiosity_gap_style" text,
	"remix_suggestion" text,
	"audio_type" text,
	"caption_style" text,
	"caption_font" text,
	"comment_bait_style" text,
	"on_screen_text_structure" text,
	"text_position" text,
	"shot_breakdown" jsonb,
	"engagement_drivers" jsonb,
	"replicability_score" integer,
	"replicability_notes" text,
	"analysis_model" text,
	"raw_response" jsonb,
	"analyzed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reel_asset" (
	"id" text PRIMARY KEY NOT NULL,
	"generated_content_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"r2_key" text NOT NULL,
	"r2_url" text,
	"duration_ms" integer,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reel" (
	"id" serial PRIMARY KEY NOT NULL,
	"external_id" text,
	"username" text NOT NULL,
	"niche_id" integer NOT NULL,
	"views" integer DEFAULT 0 NOT NULL,
	"likes" integer DEFAULT 0 NOT NULL,
	"comments" integer DEFAULT 0 NOT NULL,
	"engagement_rate" numeric(5, 2),
	"hook" text,
	"caption" text,
	"audio_name" text,
	"audio_id" text,
	"thumbnail_emoji" text,
	"thumbnail_url" text,
	"video_url" text,
	"video_r2_url" text,
	"audio_r2_url" text,
	"thumbnail_r2_url" text,
	"video_length_seconds" integer,
	"cut_frequency_seconds" numeric(4, 2),
	"posted_at" timestamp,
	"days_ago" integer,
	"is_viral" boolean DEFAULT false NOT NULL,
	"scraped_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "reel_external_id_unique" UNIQUE("external_id")
);
--> statement-breakpoint
CREATE TABLE "trending_audio" (
	"id" serial PRIMARY KEY NOT NULL,
	"audio_id" text NOT NULL,
	"audio_name" text NOT NULL,
	"artist_name" text,
	"use_count" integer DEFAULT 0 NOT NULL,
	"first_seen" timestamp DEFAULT now() NOT NULL,
	"last_seen" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "trending_audio_audio_id_unique" UNIQUE("audio_id")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"firebase_uid" text,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"address" text,
	"notes" text,
	"timezone" text DEFAULT 'UTC',
	"role" text DEFAULT 'user' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp,
	"last_login" timestamp,
	"has_used_free_trial" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_firebase_uid_unique" UNIQUE("firebase_uid"),
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "chat_message" ADD CONSTRAINT "chat_message_session_id_chat_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."chat_session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_session" ADD CONSTRAINT "chat_session_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reel_asset" ADD CONSTRAINT "reel_asset_generated_content_id_generated_content_id_fk" FOREIGN KEY ("generated_content_id") REFERENCES "public"."generated_content"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reel" ADD CONSTRAINT "reel_niche_id_niche_id_fk" FOREIGN KEY ("niche_id") REFERENCES "public"."niche"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_cost_ledger_created_at_idx" ON "ai_cost_ledger" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "ai_cost_ledger_user_id_idx" ON "ai_cost_ledger" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ai_cost_ledger_feature_type_idx" ON "ai_cost_ledger" USING btree ("feature_type");--> statement-breakpoint
CREATE INDEX "chat_messages_session_id_idx" ON "chat_message" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "chat_sessions_user_id_idx" ON "chat_session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "chat_sessions_project_id_idx" ON "chat_session" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "feature_usages_user_id_idx" ON "feature_usage" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "generated_content_user_id_idx" ON "generated_content" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "generated_content_source_reel_idx" ON "generated_content" USING btree ("source_reel_id");--> statement-breakpoint
CREATE INDEX "music_track_mood_idx" ON "music_track" USING btree ("mood");--> statement-breakpoint
CREATE INDEX "music_track_active_idx" ON "music_track" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "orders_user_id_idx" ON "order" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "projects_user_id_idx" ON "project" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "queue_items_user_id_idx" ON "queue_item" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "queue_items_status_idx" ON "queue_item" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "reel_analyses_reel_id_idx" ON "reel_analysis" USING btree ("reel_id");--> statement-breakpoint
CREATE INDEX "reel_asset_content_idx" ON "reel_asset" USING btree ("generated_content_id");--> statement-breakpoint
CREATE INDEX "reel_asset_user_idx" ON "reel_asset" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "reel_asset_type_idx" ON "reel_asset" USING btree ("generated_content_id","type");--> statement-breakpoint
CREATE INDEX "reels_niche_id_idx" ON "reel" USING btree ("niche_id");--> statement-breakpoint
CREATE INDEX "reels_views_idx" ON "reel" USING btree ("views");--> statement-breakpoint
CREATE INDEX "trending_audio_audio_id_idx" ON "trending_audio" USING btree ("audio_id");