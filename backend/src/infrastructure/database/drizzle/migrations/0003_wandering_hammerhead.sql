CREATE TABLE "ai_cost_ledger" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"feature_type" text NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"input_cost" numeric(12, 8) DEFAULT '0' NOT NULL,
	"output_cost" numeric(12, 8) DEFAULT '0' NOT NULL,
	"total_cost" numeric(12, 8) DEFAULT '0' NOT NULL,
	"duration_ms" integer DEFAULT 0 NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "ai_cost_ledger_created_at_idx" ON "ai_cost_ledger" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "ai_cost_ledger_user_id_idx" ON "ai_cost_ledger" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ai_cost_ledger_feature_type_idx" ON "ai_cost_ledger" USING btree ("feature_type");