ALTER TABLE "edit_project" ADD COLUMN "status" text DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE "edit_project" ADD COLUMN "published_at" timestamp;--> statement-breakpoint
ALTER TABLE "edit_project" ADD COLUMN "parent_project_id" text;--> statement-breakpoint
ALTER TABLE "edit_project" ADD CONSTRAINT "edit_project_parent_project_id_edit_project_id_fk" FOREIGN KEY ("parent_project_id") REFERENCES "public"."edit_project"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "edit_projects_status_idx" ON "edit_project" USING btree ("user_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "edit_project_unique_content" ON "edit_project" USING btree ("user_id","generated_content_id") WHERE generated_content_id IS NOT NULL;