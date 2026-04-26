CREATE TABLE "edit_project_artifact" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"user_id" text NOT NULL,
	"revision_id" text,
	"source_media_id" text,
	"asset_id" text,
	"kind" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"provider" text,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"data_hash" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "edit_project_asset" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"asset_id" text NOT NULL,
	"user_id" text NOT NULL,
	"media_id" text,
	"revision_id" text,
	"role" text NOT NULL,
	"source" text NOT NULL,
	"generated_content_id" integer,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "edit_project_revision" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"user_id" text NOT NULL,
	"revision_number" integer NOT NULL,
	"kind" text NOT NULL,
	"project_document" jsonb NOT NULL,
	"project_document_version" text NOT NULL,
	"contract_version" text,
	"editor_core_version" text NOT NULL,
	"renderer_version" text,
	"document_hash" text NOT NULL,
	"source_revision_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "edit_project" ADD COLUMN "project_document" jsonb;--> statement-breakpoint
ALTER TABLE "edit_project" ADD COLUMN "project_document_version" text;--> statement-breakpoint
ALTER TABLE "edit_project" ADD COLUMN "contract_version" text;--> statement-breakpoint
ALTER TABLE "edit_project" ADD COLUMN "editor_core_version" text;--> statement-breakpoint
ALTER TABLE "edit_project" ADD COLUMN "document_hash" text;--> statement-breakpoint
ALTER TABLE "edit_project" ADD COLUMN "save_revision" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "edit_project" ADD COLUMN "last_saved_revision_id" text;--> statement-breakpoint
ALTER TABLE "export_job" ADD COLUMN "project_revision_id" text;--> statement-breakpoint
ALTER TABLE "export_job" ADD COLUMN "export_settings" jsonb;--> statement-breakpoint
ALTER TABLE "export_job" ADD COLUMN "input_document_hash" text;--> statement-breakpoint
ALTER TABLE "export_job" ADD COLUMN "editor_core_version" text;--> statement-breakpoint
ALTER TABLE "export_job" ADD COLUMN "renderer_version" text;--> statement-breakpoint
ALTER TABLE "export_job" ADD COLUMN "worker_version" text;--> statement-breakpoint
ALTER TABLE "export_job" ADD COLUMN "capability_snapshot" jsonb;--> statement-breakpoint
ALTER TABLE "export_job" ADD COLUMN "error_details" jsonb;--> statement-breakpoint
ALTER TABLE "export_job" ADD COLUMN "started_at" timestamp;--> statement-breakpoint
ALTER TABLE "export_job" ADD COLUMN "completed_at" timestamp;--> statement-breakpoint
ALTER TABLE "export_job" ADD COLUMN "progress_phase" text;--> statement-breakpoint
ALTER TABLE "edit_project_artifact" ADD CONSTRAINT "edit_project_artifact_project_id_edit_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."edit_project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edit_project_artifact" ADD CONSTRAINT "edit_project_artifact_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edit_project_artifact" ADD CONSTRAINT "edit_project_artifact_revision_id_edit_project_revision_id_fk" FOREIGN KEY ("revision_id") REFERENCES "public"."edit_project_revision"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edit_project_artifact" ADD CONSTRAINT "edit_project_artifact_asset_id_asset_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."asset"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edit_project_asset" ADD CONSTRAINT "edit_project_asset_project_id_edit_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."edit_project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edit_project_asset" ADD CONSTRAINT "edit_project_asset_asset_id_asset_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."asset"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edit_project_asset" ADD CONSTRAINT "edit_project_asset_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edit_project_asset" ADD CONSTRAINT "edit_project_asset_revision_id_edit_project_revision_id_fk" FOREIGN KEY ("revision_id") REFERENCES "public"."edit_project_revision"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edit_project_asset" ADD CONSTRAINT "edit_project_asset_generated_content_id_generated_content_id_fk" FOREIGN KEY ("generated_content_id") REFERENCES "public"."generated_content"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edit_project_revision" ADD CONSTRAINT "edit_project_revision_project_id_edit_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."edit_project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edit_project_revision" ADD CONSTRAINT "edit_project_revision_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edit_project_revision" ADD CONSTRAINT "edit_project_revision_source_revision_id_edit_project_revision_id_fk" FOREIGN KEY ("source_revision_id") REFERENCES "public"."edit_project_revision"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "edit_project_artifacts_project_kind_status_idx" ON "edit_project_artifact" USING btree ("project_id","kind","status");--> statement-breakpoint
CREATE INDEX "edit_project_artifacts_project_revision_idx" ON "edit_project_artifact" USING btree ("project_id","revision_id");--> statement-breakpoint
CREATE INDEX "edit_project_artifacts_source_media_idx" ON "edit_project_artifact" USING btree ("source_media_id");--> statement-breakpoint
CREATE INDEX "edit_project_artifacts_asset_idx" ON "edit_project_artifact" USING btree ("asset_id");--> statement-breakpoint
CREATE UNIQUE INDEX "edit_project_assets_project_media_source_idx" ON "edit_project_asset" USING btree ("project_id","media_id") WHERE media_id IS NOT NULL AND role IN ('source_video', 'source_audio', 'source_image', 'voiceover', 'music');--> statement-breakpoint
CREATE INDEX "edit_project_assets_project_role_idx" ON "edit_project_asset" USING btree ("project_id","role");--> statement-breakpoint
CREATE INDEX "edit_project_assets_project_revision_idx" ON "edit_project_asset" USING btree ("project_id","revision_id");--> statement-breakpoint
CREATE INDEX "edit_project_assets_asset_idx" ON "edit_project_asset" USING btree ("asset_id");--> statement-breakpoint
CREATE INDEX "edit_project_assets_generated_content_idx" ON "edit_project_asset" USING btree ("generated_content_id");--> statement-breakpoint
CREATE UNIQUE INDEX "edit_project_revisions_project_number_idx" ON "edit_project_revision" USING btree ("project_id","revision_number");--> statement-breakpoint
CREATE INDEX "edit_project_revisions_project_created_idx" ON "edit_project_revision" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE INDEX "edit_project_revisions_user_created_idx" ON "edit_project_revision" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "edit_project_revisions_project_hash_kind_idx" ON "edit_project_revision" USING btree ("project_id","document_hash","kind");--> statement-breakpoint
ALTER TABLE "edit_project" ADD CONSTRAINT "edit_project_last_saved_revision_id_edit_project_revision_id_fk" FOREIGN KEY ("last_saved_revision_id") REFERENCES "public"."edit_project_revision"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "export_job" ADD CONSTRAINT "export_job_project_revision_id_edit_project_revision_id_fk" FOREIGN KEY ("project_revision_id") REFERENCES "public"."edit_project_revision"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "export_jobs_revision_idx" ON "export_job" USING btree ("project_revision_id");--> statement-breakpoint
CREATE INDEX "export_jobs_output_asset_idx" ON "export_job" USING btree ("output_asset_id");--> statement-breakpoint
CREATE INDEX "export_jobs_user_status_created_idx" ON "export_job" USING btree ("user_id","status","created_at");