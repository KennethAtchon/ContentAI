DROP INDEX "reel_analyses_reel_id_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "reel_analyses_reel_id_idx" ON "reel_analysis" USING btree ("reel_id");