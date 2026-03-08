CREATE TABLE "contact_message" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"subject" text NOT NULL,
	"message" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feature_usage" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"feature_type" text NOT NULL,
	"input_data" json NOT NULL,
	"result_data" json NOT NULL,
	"usage_time_ms" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"total_amount" numeric(10, 2) NOT NULL,
	"status" text,
	"stripe_session_id" text,
	"skip_payment" boolean DEFAULT false NOT NULL,
	"order_type" text DEFAULT 'one_time' NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp,
	"deleted_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "order_stripe_session_id_unique" UNIQUE("stripe_session_id")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"firebase_uid" text,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"address" text,
	"notes" text,
	"timezone" text DEFAULT 'UTC',
	"role" text DEFAULT 'user' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp,
	"last_login" timestamp,
	"has_used_free_trial" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_firebase_uid_unique" UNIQUE("firebase_uid"),
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
