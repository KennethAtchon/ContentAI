CREATE TABLE "caption" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"asset_id" text NOT NULL,
	"language" text DEFAULT 'en' NOT NULL,
	"words" jsonb NOT NULL,
	"full_text" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "caption" ADD CONSTRAINT "caption_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "caption" ADD CONSTRAINT "caption_asset_id_asset_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."asset"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "captions_asset_idx" ON "caption" USING btree ("asset_id");--> statement-breakpoint
CREATE INDEX "captions_user_idx" ON "caption" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "captions_user_asset_unique" ON "caption" USING btree ("user_id","asset_id");