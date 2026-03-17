CREATE TABLE "reel_composition" (
	"id" text PRIMARY KEY NOT NULL,
	"generated_content_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"timeline" jsonb NOT NULL,
	"base_assembled_asset_id" text,
	"latest_rendered_asset_id" text,
	"version" integer DEFAULT 1 NOT NULL,
	"edit_mode" text DEFAULT 'quick' NOT NULL,
	"preview_preset" text DEFAULT 'instagram-9-16' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "reel_composition" ADD CONSTRAINT "reel_composition_generated_content_id_generated_content_id_fk" FOREIGN KEY ("generated_content_id") REFERENCES "public"."generated_content"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "reel_composition_generated_content_idx" ON "reel_composition" USING btree ("generated_content_id");--> statement-breakpoint
CREATE INDEX "reel_composition_user_updated_idx" ON "reel_composition" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "reel_composition_content_user_idx" ON "reel_composition" USING btree ("generated_content_id","user_id");