ALTER TABLE "edit_project" ADD COLUMN "auto_title" boolean DEFAULT true NOT NULL;

--> statement-breakpoint
UPDATE "edit_project" AS ep
SET auto_title = false
FROM "generated_content" AS gc
WHERE ep.generated_content_id = gc.id
  AND ep.title IS DISTINCT FROM gc.generated_hook;

--> statement-breakpoint
INSERT INTO "export_job" (
  id,
  edit_project_id,
  user_id,
  status,
  progress,
  output_asset_id,
  error,
  created_at,
  updated_at
)
SELECT
  gen_random_uuid()::text,
  ep.id,
  ep.user_id,
  'done',
  100,
  ca.asset_id,
  NULL,
  now(),
  now()
FROM "content_asset" AS ca
INNER JOIN "generated_content" AS gc ON gc.id = ca.generated_content_id
INNER JOIN "edit_project" AS ep
  ON ep.user_id = gc.user_id
  AND ep.generated_content_id = ca.generated_content_id
  AND ep.parent_project_id IS NULL
WHERE ca.role = 'assembled_video'
  AND NOT EXISTS (
    SELECT 1
    FROM "export_job" AS ej
    WHERE ej.edit_project_id = ep.id
      AND ej.status = 'done'
  );