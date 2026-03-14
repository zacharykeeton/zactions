CREATE TABLE "completion_history" (
	"id" text PRIMARY KEY NOT NULL,
	"task_id" text NOT NULL,
	"scheduled_date" text,
	"due_date" text,
	"completed_at" text NOT NULL,
	"time_invested_ms" bigint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lists" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"color" text NOT NULL,
	"created_date" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "tag_lists" (
	"tag_id" text NOT NULL,
	"list_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"color" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "task_dependencies" (
	"task_id" text NOT NULL,
	"depends_on_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_tags" (
	"task_id" text NOT NULL,
	"tag_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"parent_id" text,
	"position" integer DEFAULT 0 NOT NULL,
	"title" text NOT NULL,
	"completed" boolean DEFAULT false NOT NULL,
	"priority" text DEFAULT 'medium' NOT NULL,
	"due_date" text,
	"scheduled_date" text,
	"start_date" text,
	"completed_date" text,
	"created_date" text NOT NULL,
	"time_invested_ms" bigint DEFAULT 0 NOT NULL,
	"time_estimate_ms" bigint,
	"archived" boolean DEFAULT false NOT NULL,
	"list_id" text,
	"recurrence_interval" text,
	"recurrence_frequency" integer,
	"recurrence_days_of_week" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "completion_history_task_id_idx" ON "completion_history" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "lists_user_id_idx" ON "lists" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "lists_deleted_at_idx" ON "lists" USING btree ("deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "tag_lists_unique_idx" ON "tag_lists" USING btree ("tag_id","list_id");--> statement-breakpoint
CREATE INDEX "tags_user_id_idx" ON "tags" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "tags_deleted_at_idx" ON "tags" USING btree ("deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "task_dependencies_unique_idx" ON "task_dependencies" USING btree ("task_id","depends_on_id");--> statement-breakpoint
CREATE UNIQUE INDEX "task_tags_unique_idx" ON "task_tags" USING btree ("task_id","tag_id");--> statement-breakpoint
CREATE INDEX "tasks_user_id_idx" ON "tasks" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "tasks_user_parent_idx" ON "tasks" USING btree ("user_id","parent_id");--> statement-breakpoint
CREATE INDEX "tasks_deleted_at_idx" ON "tasks" USING btree ("deleted_at");