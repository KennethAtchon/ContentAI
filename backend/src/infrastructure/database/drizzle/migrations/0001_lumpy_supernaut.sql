ALTER TABLE "generated_content" ADD COLUMN "generated_metadata" jsonb;--> statement-breakpoint
ALTER TABLE "generated_content" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "generated_content" ADD COLUMN "parent_id" integer;--> statement-breakpoint
ALTER TABLE "reel_analysis" ADD COLUMN "shot_breakdown" jsonb;--> statement-breakpoint
ALTER TABLE "reel_analysis" ADD COLUMN "engagement_drivers" jsonb;--> statement-breakpoint
ALTER TABLE "reel_analysis" ADD COLUMN "replicability_score" integer;--> statement-breakpoint
ALTER TABLE "reel_analysis" ADD COLUMN "replicability_notes" text;