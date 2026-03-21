CREATE TABLE "media_item" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"mime_type" text NOT NULL,
	"r2_key" text NOT NULL,
	"r2_url" text,
	"size_bytes" integer,
	"duration_ms" integer,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chat_message" ADD COLUMN "media_refs" jsonb;--> statement-breakpoint
ALTER TABLE "media_item" ADD CONSTRAINT "media_item_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "media_item_user_idx" ON "media_item" USING btree ("user_id");