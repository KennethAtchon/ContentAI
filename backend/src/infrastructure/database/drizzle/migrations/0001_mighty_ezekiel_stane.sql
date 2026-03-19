CREATE TABLE "edit_project" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"title" text DEFAULT 'Untitled Edit' NOT NULL,
	"generated_content_id" integer,
	"tracks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"duration_ms" integer DEFAULT 0 NOT NULL,
	"fps" integer DEFAULT 30 NOT NULL,
	"resolution" text DEFAULT '1080p' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "export_job" (
	"id" text PRIMARY KEY NOT NULL,
	"edit_project_id" text NOT NULL,
	"user_id" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"r2_key" text,
	"r2_url" text,
	"error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "edit_project" ADD CONSTRAINT "edit_project_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edit_project" ADD CONSTRAINT "edit_project_generated_content_id_generated_content_id_fk" FOREIGN KEY ("generated_content_id") REFERENCES "public"."generated_content"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "export_job" ADD CONSTRAINT "export_job_edit_project_id_edit_project_id_fk" FOREIGN KEY ("edit_project_id") REFERENCES "public"."edit_project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "export_job" ADD CONSTRAINT "export_job_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "edit_projects_user_idx" ON "edit_project" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "edit_projects_content_idx" ON "edit_project" USING btree ("generated_content_id");--> statement-breakpoint
CREATE INDEX "export_jobs_project_idx" ON "export_job" USING btree ("edit_project_id");--> statement-breakpoint
CREATE INDEX "export_jobs_user_idx" ON "export_job" USING btree ("user_id");