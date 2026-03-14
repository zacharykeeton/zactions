import { NextResponse } from "next/server";
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
import { lt, and, isNotNull, inArray, sql } from "drizzle-orm";

export async function POST(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // ── Hard-delete old soft-deleted tasks ──────────────────────────────
  // First, find task IDs to delete
  const deletedTaskRows = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(
      and(isNotNull(tasks.deletedAt), lt(tasks.deletedAt, thirtyDaysAgo))
    );

  const deletedTaskIds = deletedTaskRows.map((r) => r.id);

  if (deletedTaskIds.length > 0) {
    // Delete junction data first (FK references)
    await db.delete(completionHistory).where(
      inArray(completionHistory.taskId, deletedTaskIds)
    );
    await db.delete(taskTags).where(
      inArray(taskTags.taskId, deletedTaskIds)
    );
    await db.delete(taskDependencies).where(
      inArray(taskDependencies.taskId, deletedTaskIds)
    );
    // Delete the tasks
    await db.delete(tasks).where(
      inArray(tasks.id, deletedTaskIds)
    );
  }

  // ── Hard-delete old soft-deleted tags ───────────────────────────────
  const deletedTagRows = await db
    .select({ id: tags.id })
    .from(tags)
    .where(
      and(isNotNull(tags.deletedAt), lt(tags.deletedAt, thirtyDaysAgo))
    );

  const deletedTagIds = deletedTagRows.map((r) => r.id);

  if (deletedTagIds.length > 0) {
    await db.delete(tagLists).where(inArray(tagLists.tagId, deletedTagIds));
    await db.delete(taskTags).where(inArray(taskTags.tagId, deletedTagIds));
    await db.delete(tags).where(inArray(tags.id, deletedTagIds));
  }

  // ── Hard-delete old soft-deleted lists ──────────────────────────────
  const deletedListRows = await db
    .select({ id: lists.id })
    .from(lists)
    .where(
      and(isNotNull(lists.deletedAt), lt(lists.deletedAt, thirtyDaysAgo))
    );

  const deletedListIds = deletedListRows.map((r) => r.id);

  if (deletedListIds.length > 0) {
    await db.delete(tagLists).where(inArray(tagLists.listId, deletedListIds));
    await db.delete(lists).where(inArray(lists.id, deletedListIds));
  }

  return NextResponse.json({
    deleted: {
      tasks: deletedTaskIds.length,
      tags: deletedTagIds.length,
      lists: deletedListIds.length,
    },
  });
}
