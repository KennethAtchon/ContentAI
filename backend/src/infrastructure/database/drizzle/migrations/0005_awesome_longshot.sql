ALTER TABLE "edit_project" DROP CONSTRAINT "edit_project_parent_project_id_edit_project_id_fk";
--> statement-breakpoint
ALTER TABLE "edit_project" ADD CONSTRAINT "edit_project_parent_project_id_edit_project_id_fk" FOREIGN KEY ("parent_project_id") REFERENCES "public"."edit_project"("id") ON DELETE cascade ON UPDATE no action;