CREATE TABLE "generated_content" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"source_reel_id" integer,
	"prompt" text NOT NULL,
	"generated_hook" text,
	"generated_caption" text,
	"generated_script" text,
	"output_type" text DEFAULT 'full' NOT NULL,
	"model" text,
	"status" text DEFAULT 'draft' NOT NULL,
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
	"analysis_model" text,
	"raw_response" jsonb,
	"analyzed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reel" (
	"id" serial PRIMARY KEY NOT NULL,
	"external_id" text,
	"username" text NOT NULL,
	"niche" text NOT NULL,
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
	"posted_at" timestamp,
	"days_ago" integer,
	"is_viral" boolean DEFAULT false NOT NULL,
	"scraped_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "reel_external_id_unique" UNIQUE("external_id")
);
--> statement-breakpoint
CREATE INDEX "generated_content_user_id_idx" ON "generated_content" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "generated_content_source_reel_idx" ON "generated_content" USING btree ("source_reel_id");--> statement-breakpoint
CREATE INDEX "queue_items_user_id_idx" ON "queue_item" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "queue_items_status_idx" ON "queue_item" USING btree ("status");--> statement-breakpoint
CREATE INDEX "reel_analyses_reel_id_idx" ON "reel_analysis" USING btree ("reel_id");--> statement-breakpoint
CREATE INDEX "reels_niche_idx" ON "reel" USING btree ("niche");--> statement-breakpoint
CREATE INDEX "reels_views_idx" ON "reel" USING btree ("views");--> statement-breakpoint
CREATE INDEX "feature_usages_user_id_idx" ON "feature_usage" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "orders_user_id_idx" ON "order" USING btree ("user_id");