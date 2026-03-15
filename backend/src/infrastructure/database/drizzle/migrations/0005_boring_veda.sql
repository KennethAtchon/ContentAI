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
ALTER TABLE "reel_asset" ADD CONSTRAINT "reel_asset_generated_content_id_generated_content_id_fk" FOREIGN KEY ("generated_content_id") REFERENCES "public"."generated_content"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "music_track_mood_idx" ON "music_track" USING btree ("mood");--> statement-breakpoint
CREATE INDEX "music_track_active_idx" ON "music_track" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "reel_asset_content_idx" ON "reel_asset" USING btree ("generated_content_id");--> statement-breakpoint
CREATE INDEX "reel_asset_user_idx" ON "reel_asset" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "reel_asset_type_idx" ON "reel_asset" USING btree ("generated_content_id","type");