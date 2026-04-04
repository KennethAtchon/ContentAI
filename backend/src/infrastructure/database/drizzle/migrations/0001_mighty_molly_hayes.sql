CREATE TABLE "chat_session_content" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"content_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
INSERT INTO "chat_session_content" ("session_id", "content_id")
SELECT DISTINCT "session_id", "generated_content_id"
FROM "chat_message"
WHERE "generated_content_id" IS NOT NULL;
--> statement-breakpoint
ALTER TABLE "chat_message" DROP CONSTRAINT "chat_message_generated_content_id_generated_content_id_fk";
--> statement-breakpoint
ALTER TABLE "chat_session_content" ADD CONSTRAINT "chat_session_content_session_id_chat_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."chat_session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_session_content" ADD CONSTRAINT "chat_session_content_content_id_generated_content_id_fk" FOREIGN KEY ("content_id") REFERENCES "public"."generated_content"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "chat_session_content_session_content_idx" ON "chat_session_content" USING btree ("session_id","content_id");--> statement-breakpoint
CREATE INDEX "chat_session_content_session_idx" ON "chat_session_content" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "chat_session_content_content_idx" ON "chat_session_content" USING btree ("content_id");--> statement-breakpoint
ALTER TABLE "chat_message" DROP COLUMN "generated_content_id";
