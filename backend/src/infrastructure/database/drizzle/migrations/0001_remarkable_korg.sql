ALTER TABLE "niche" ADD COLUMN "scrape_limit" integer DEFAULT 100 NOT NULL;--> statement-breakpoint
ALTER TABLE "niche" ADD COLUMN "scrape_min_views" integer DEFAULT 1000 NOT NULL;--> statement-breakpoint
ALTER TABLE "niche" ADD COLUMN "scrape_max_days_old" integer DEFAULT 30 NOT NULL;--> statement-breakpoint
ALTER TABLE "niche" ADD COLUMN "scrape_include_viral_only" boolean DEFAULT false NOT NULL;