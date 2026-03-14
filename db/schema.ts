import {
  pgTable,
  text,
  boolean,
  integer,
  bigint,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ── Tasks ───────────────────────────────────────────────────────────────────

export const tasks = pgTable(
  "tasks",
  {
    id: text("id").primaryKey(), // client-generated UUID
    userId: text("user_id").notNull(),
    parentId: text("parent_id"), // null = root-level task
    position: integer("position").notNull().default(0),
    title: text("title").notNull(),
    completed: boolean("completed").notNull().default(false),
    priority: text("priority").notNull().default("medium"), // low | medium | high
    dueDate: text("due_date"),
    scheduledDate: text("scheduled_date"),
    startDate: text("start_date"),
    completedDate: text("completed_date"),
    createdDate: text("created_date").notNull(),
    timeInvestedMs: bigint("time_invested_ms", { mode: "number" }).notNull().default(0),
    timeEstimateMs: bigint("time_estimate_ms", { mode: "number" }),
    archived: boolean("archived").notNull().default(false),
    listId: text("list_id"),
    // Recurrence fields (flattened from RecurrencePattern)
    recurrenceInterval: text("recurrence_interval"), // daily | weekly | monthly | yearly
    recurrenceFrequency: integer("recurrence_frequency"),
    recurrenceDaysOfWeek: text("recurrence_days_of_week"), // JSON string: number[]
    // Sync metadata
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("tasks_user_id_idx").on(table.userId),
    index("tasks_user_parent_idx").on(table.userId, table.parentId),
    index("tasks_deleted_at_idx").on(table.deletedAt),
  ]
);

export const tasksRelations = relations(tasks, ({ many }) => ({
  completionHistory: many(completionHistory),
  taskTags: many(taskTags),
  taskDependencies: many(taskDependencies),
}));

// ── Completion History ──────────────────────────────────────────────────────

export const completionHistory = pgTable(
  "completion_history",
  {
    id: text("id").primaryKey(), // server-generated or client UUID
    taskId: text("task_id").notNull(),
    scheduledDate: text("scheduled_date"),
    dueDate: text("due_date"),
    completedAt: text("completed_at").notNull(),
    timeInvestedMs: bigint("time_invested_ms", { mode: "number" }).notNull().default(0),
  },
  (table) => [
    index("completion_history_task_id_idx").on(table.taskId),
  ]
);

export const completionHistoryRelations = relations(completionHistory, ({ one }) => ({
  task: one(tasks, {
    fields: [completionHistory.taskId],
    references: [tasks.id],
  }),
}));

// ── Task Tags (junction) ────────────────────────────────────────────────────

export const taskTags = pgTable(
  "task_tags",
  {
    taskId: text("task_id").notNull(),
    tagId: text("tag_id").notNull(),
  },
  (table) => [
    uniqueIndex("task_tags_unique_idx").on(table.taskId, table.tagId),
  ]
);

export const taskTagsRelations = relations(taskTags, ({ one }) => ({
  task: one(tasks, {
    fields: [taskTags.taskId],
    references: [tasks.id],
  }),
  tag: one(tags, {
    fields: [taskTags.tagId],
    references: [tags.id],
  }),
}));

// ── Task Dependencies (junction) ────────────────────────────────────────────

export const taskDependencies = pgTable(
  "task_dependencies",
  {
    taskId: text("task_id").notNull(),
    dependsOnId: text("depends_on_id").notNull(),
  },
  (table) => [
    uniqueIndex("task_dependencies_unique_idx").on(table.taskId, table.dependsOnId),
  ]
);

export const taskDependenciesRelations = relations(taskDependencies, ({ one }) => ({
  task: one(tasks, {
    fields: [taskDependencies.taskId],
    references: [tasks.id],
  }),
}));

// ── Tags ────────────────────────────────────────────────────────────────────

export const tags = pgTable(
  "tags",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    name: text("name").notNull(),
    color: text("color").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("tags_user_id_idx").on(table.userId),
    index("tags_deleted_at_idx").on(table.deletedAt),
  ]
);

export const tagsRelations = relations(tags, ({ many }) => ({
  tagLists: many(tagLists),
  taskTags: many(taskTags),
}));

// ── Tag Lists (junction for list scoping) ───────────────────────────────────

export const tagLists = pgTable(
  "tag_lists",
  {
    tagId: text("tag_id").notNull(),
    listId: text("list_id").notNull(),
  },
  (table) => [
    uniqueIndex("tag_lists_unique_idx").on(table.tagId, table.listId),
  ]
);

export const tagListsRelations = relations(tagLists, ({ one }) => ({
  tag: one(tags, {
    fields: [tagLists.tagId],
    references: [tags.id],
  }),
}));

// ── Lists ───────────────────────────────────────────────────────────────────

export const lists = pgTable(
  "lists",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    name: text("name").notNull(),
    color: text("color").notNull(),
    createdDate: text("created_date").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("lists_user_id_idx").on(table.userId),
    index("lists_deleted_at_idx").on(table.deletedAt),
  ]
);
