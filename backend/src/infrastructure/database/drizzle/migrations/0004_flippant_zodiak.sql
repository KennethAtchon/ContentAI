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
CREATE INDEX "trending_audio_audio_id_idx" ON "trending_audio" USING btree ("audio_id");