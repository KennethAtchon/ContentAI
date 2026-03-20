CREATE TABLE "system_config" (
	"id" text PRIMARY KEY NOT NULL,
	"category" text NOT NULL,
	"key" text NOT NULL,
	"value" text,
	"encrypted_value" text,
	"value_type" text DEFAULT 'string' NOT NULL,
	"is_secret" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"description" text,
	"updated_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"preferred_ai_provider" text,
	"preferred_video_provider" text,
	"preferred_voice_id" text,
	"preferred_tts_speed" text,
	"preferred_aspect_ratio" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_settings_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "system_config_category_key_idx" ON "system_config" USING btree ("category","key");--> statement-breakpoint
CREATE INDEX "system_config_category_idx" ON "system_config" USING btree ("category");--> statement-breakpoint
CREATE UNIQUE INDEX "user_settings_user_id_idx" ON "user_settings" USING btree ("user_id");