import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import {
  tasks,
  completionHistory,
  taskTags,
  taskDependencies,
  tags,
  tagLists,
  lists,
} from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import type { FlatTaskRow } from "@/lib/sync-tree-utils";
import type { Tag, TaskList } from "@/lib/types";

interface PushBody {
  tasks?: {
    upsert?: FlatTaskRow[];
    delete?: string[];
  };
  tags?: {
    upsert?: Tag[];
    delete?: string[];
  };
  lists?: {
    upsert?: TaskList[];
    delete?: string[];
  };
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body: PushBody = await request.json();
  const now = new Date();

  // ── Task upserts ────────────────────────────────────────────────────
  if (body.tasks?.upsert?.length) {
    for (const row of body.tasks.upsert) {
      await db
        .insert(tasks)
        .values({
          id: row.id,
          userId,
          parentId: row.parentId,
          position: row.position,
          title: row.title,
          completed: row.completed,
          priority: row.priority,
          dueDate: row.dueDate,
          scheduledDate: row.scheduledDate,
          startDate: row.startDate,
          completedDate: row.completedDate,
          createdDate: row.createdDate,
          timeInvestedMs: row.timeInvestedMs,
          timeEstimateMs: row.timeEstimateMs,
          archived: row.archived,
          listId: row.listId,
          recurrenceInterval: row.recurrenceInterval,
          recurrenceFrequency: row.recurrenceFrequency,
          recurrenceDaysOfWeek: row.recurrenceDaysOfWeek,
          updatedAt: now,
          deletedAt: null, // un-delete if previously soft-deleted
        })
        .onConflictDoUpdate({
          target: tasks.id,
          set: {
            parentId: row.parentId,
            position: row.position,
            title: row.title,
            completed: row.completed,
            priority: row.priority,
            dueDate: row.dueDate,
            scheduledDate: row.scheduledDate,
            startDate: row.startDate,
            completedDate: row.completedDate,
            timeInvestedMs: row.timeInvestedMs,
            timeEstimateMs: row.timeEstimateMs,
            archived: row.archived,
            listId: row.listId,
            recurrenceInterval: row.recurrenceInterval,
            recurrenceFrequency: row.recurrenceFrequency,
            recurrenceDaysOfWeek: row.recurrenceDaysOfWeek,
            updatedAt: now,
            deletedAt: null,
          },
        });

      // Rebuild junction tables for this task
      await db.delete(taskTags).where(eq(taskTags.taskId, row.id));
      if (row.tags.length > 0) {
        await db.insert(taskTags).values(
          row.tags.map((tagId) => ({ taskId: row.id, tagId }))
        );
      }

      await db.delete(taskDependencies).where(eq(taskDependencies.taskId, row.id));
      if (row.dependsOn.length > 0) {
        await db.insert(taskDependencies).values(
          row.dependsOn.map((depId) => ({ taskId: row.id, dependsOnId: depId }))
        );
      }

      // Replace completion history for this task
      await db.delete(completionHistory).where(eq(completionHistory.taskId, row.id));
      if (row.completionHistory.length > 0) {
        const { v4: uuidv4 } = await import("uuid");
        await db.insert(completionHistory).values(
          row.completionHistory.map((record) => ({
            id: uuidv4(),
            taskId: row.id,
            scheduledDate: record.scheduledDate,
            dueDate: record.dueDate,
            completedAt: record.completedAt,
            timeInvestedMs: record.timeInvestedMs,
          }))
        );
      }
    }
  }

  // ── Task deletes (soft-delete with cascade to descendants) ──────────
  if (body.tasks?.delete?.length) {
    for (const id of body.tasks.delete) {
      // Soft-delete the task and all descendants via recursive CTE
      await db.execute(sql`
        WITH RECURSIVE descendants AS (
          SELECT id FROM tasks WHERE id = ${id} AND user_id = ${userId}
          UNION ALL
          SELECT t.id FROM tasks t JOIN descendants d ON t.parent_id = d.id
        )
        UPDATE tasks SET deleted_at = ${now}, updated_at = ${now}
        WHERE id IN (SELECT id FROM descendants)
      `);
    }
  }

  // ── Tag upserts ─────────────────────────────────────────────────────
  if (body.tags?.upsert?.length) {
    for (const tag of body.tags.upsert) {
      await db
        .insert(tags)
        .values({
          id: tag.id,
          userId,
          name: tag.name,
          color: tag.color,
          updatedAt: now,
          deletedAt: null,
        })
        .onConflictDoUpdate({
          target: tags.id,
          set: {
            name: tag.name,
            color: tag.color,
            updatedAt: now,
            deletedAt: null,
          },
        });

      // Rebuild tag-list scoping
      await db.delete(tagLists).where(eq(tagLists.tagId, tag.id));
      if (tag.listIds.length > 0) {
        await db.insert(tagLists).values(
          tag.listIds.map((listId) => ({ tagId: tag.id, listId }))
        );
      }
    }
  }

  // ── Tag deletes ─────────────────────────────────────────────────────
  if (body.tags?.delete?.length) {
    for (const id of body.tags.delete) {
      await db
        .update(tags)
        .set({ deletedAt: now, updatedAt: now })
        .where(and(eq(tags.id, id), eq(tags.userId, userId)));
    }
  }

  // ── List upserts ────────────────────────────────────────────────────
  if (body.lists?.upsert?.length) {
    for (const list of body.lists.upsert) {
      await db
        .insert(lists)
        .values({
          id: list.id,
          userId,
          name: list.name,
          color: list.color,
          createdDate: list.createdDate,
          updatedAt: now,
          deletedAt: null,
        })
        .onConflictDoUpdate({
          target: lists.id,
          set: {
            name: list.name,
            color: list.color,
            updatedAt: now,
            deletedAt: null,
          },
        });
    }
  }

  // ── List deletes ────────────────────────────────────────────────────
  if (body.lists?.delete?.length) {
    for (const id of body.lists.delete) {
      await db
        .update(lists)
        .set({ deletedAt: now, updatedAt: now })
        .where(and(eq(lists.id, id), eq(lists.userId, userId)));
    }
  }

  return NextResponse.json({ serverTime: now.toISOString() });
}
