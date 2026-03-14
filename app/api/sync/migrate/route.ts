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
import { eq, and, isNull } from "drizzle-orm";
import { flattenTasksForSync, extractJunctionData } from "@/lib/sync-tree-utils";
import type { Task, Tag, TaskList } from "@/lib/types";

interface MigrateBody {
  tasks: Task[];
  tags: Tag[];
  lists: TaskList[];
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check if user already has data
  const existingTasks = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(and(eq(tasks.userId, userId), isNull(tasks.deletedAt)))
    .limit(1);

  if (existingTasks.length > 0) {
    return NextResponse.json(
      { error: "User already has data on server" },
      { status: 409 }
    );
  }

  const body: MigrateBody = await request.json();
  const now = new Date();

  // ── Flatten tasks and extract junction data ─────────────────────────
  const flatRows = flattenTasksForSync(body.tasks);
  const junctions = extractJunctionData(flatRows);

  // ── Insert tasks ────────────────────────────────────────────────────
  if (flatRows.length > 0) {
    for (const row of flatRows) {
      await db.insert(tasks).values({
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
      });
    }
  }

  // ── Insert junction data ────────────────────────────────────────────
  if (junctions.taskTags.length > 0) {
    for (const tt of junctions.taskTags) {
      await db.insert(taskTags).values(tt).onConflictDoNothing();
    }
  }

  if (junctions.taskDependencies.length > 0) {
    for (const td of junctions.taskDependencies) {
      await db.insert(taskDependencies).values(td).onConflictDoNothing();
    }
  }

  if (junctions.completionHistory.length > 0) {
    for (const ch of junctions.completionHistory) {
      await db.insert(completionHistory).values(ch);
    }
  }

  // ── Insert tags ─────────────────────────────────────────────────────
  if (body.tags.length > 0) {
    for (const tag of body.tags) {
      await db.insert(tags).values({
        id: tag.id,
        userId,
        name: tag.name,
        color: tag.color,
        updatedAt: now,
      });

      if (tag.listIds.length > 0) {
        for (const listId of tag.listIds) {
          await db.insert(tagLists).values({ tagId: tag.id, listId }).onConflictDoNothing();
        }
      }
    }
  }

  // ── Insert lists ────────────────────────────────────────────────────
  if (body.lists.length > 0) {
    for (const list of body.lists) {
      await db.insert(lists).values({
        id: list.id,
        userId,
        name: list.name,
        color: list.color,
        createdDate: list.createdDate,
        updatedAt: now,
      });
    }
  }

  return NextResponse.json({ serverTime: now.toISOString() });
}
