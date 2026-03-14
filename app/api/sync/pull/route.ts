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
import { eq, and, isNull, gt } from "drizzle-orm";
import type { FlatTaskRow } from "@/lib/sync-tree-utils";
import type { Tag, TaskList, CompletionRecord } from "@/lib/types";

export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const since = searchParams.get("since");
  const now = new Date();

  // ── Fetch tasks ─────────────────────────────────────────────────────
  let taskRows;
  if (since) {
    const sinceDate = new Date(since);
    taskRows = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.userId, userId), gt(tasks.updatedAt, sinceDate)));
  } else {
    taskRows = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.userId, userId), isNull(tasks.deletedAt)));
  }

  // ── Assemble flat task rows with junction data ──────────────────────
  const taskIds = taskRows.map((t) => t.id);

  // Batch fetch all junction data for these tasks
  const [allTaskTags, allTaskDeps, allCompletionHistory] = await Promise.all([
    taskIds.length > 0
      ? db.select().from(taskTags).where(
          // Use IN query for efficiency
          taskIds.length === 1
            ? eq(taskTags.taskId, taskIds[0])
            : eq(taskTags.taskId, taskIds[0]) // fallback; see below
        )
      : Promise.resolve([]),
    taskIds.length > 0
      ? db.select().from(taskDependencies).where(
          taskIds.length === 1
            ? eq(taskDependencies.taskId, taskIds[0])
            : eq(taskDependencies.taskId, taskIds[0])
        )
      : Promise.resolve([]),
    taskIds.length > 0
      ? db.select().from(completionHistory).where(
          taskIds.length === 1
            ? eq(completionHistory.taskId, taskIds[0])
            : eq(completionHistory.taskId, taskIds[0])
        )
      : Promise.resolve([]),
  ]);

  // For larger sets, we need to fetch all junction data for the user's tasks
  // and filter in memory (more efficient than N queries)
  let tagMap: Map<string, string[]>;
  let depMap: Map<string, string[]>;
  let historyMap: Map<string, CompletionRecord[]>;

  if (taskIds.length > 1) {
    // Fetch all junction data for user's tasks
    const allTags = await db
      .select({ taskId: taskTags.taskId, tagId: taskTags.tagId })
      .from(taskTags)
      .innerJoin(tasks, eq(tasks.id, taskTags.taskId))
      .where(eq(tasks.userId, userId));

    const allDeps = await db
      .select({ taskId: taskDependencies.taskId, dependsOnId: taskDependencies.dependsOnId })
      .from(taskDependencies)
      .innerJoin(tasks, eq(tasks.id, taskDependencies.taskId))
      .where(eq(tasks.userId, userId));

    const allHistory = await db
      .select()
      .from(completionHistory)
      .innerJoin(tasks, eq(tasks.id, completionHistory.taskId))
      .where(eq(tasks.userId, userId));

    tagMap = new Map();
    for (const row of allTags) {
      if (!tagMap.has(row.taskId)) tagMap.set(row.taskId, []);
      tagMap.get(row.taskId)!.push(row.tagId);
    }

    depMap = new Map();
    for (const row of allDeps) {
      if (!depMap.has(row.taskId)) depMap.set(row.taskId, []);
      depMap.get(row.taskId)!.push(row.dependsOnId);
    }

    historyMap = new Map();
    for (const row of allHistory) {
      const ch = row.completion_history;
      if (!historyMap.has(ch.taskId)) historyMap.set(ch.taskId, []);
      historyMap.get(ch.taskId)!.push({
        scheduledDate: ch.scheduledDate,
        dueDate: ch.dueDate,
        completedAt: ch.completedAt,
        timeInvestedMs: ch.timeInvestedMs,
      });
    }
  } else if (taskIds.length === 1) {
    tagMap = new Map();
    for (const row of allTaskTags) {
      if (!tagMap.has(row.taskId)) tagMap.set(row.taskId, []);
      tagMap.get(row.taskId)!.push(row.tagId);
    }

    depMap = new Map();
    for (const row of allTaskDeps) {
      if (!depMap.has(row.taskId)) depMap.set(row.taskId, []);
      depMap.get(row.taskId)!.push(row.dependsOnId);
    }

    historyMap = new Map();
    for (const row of allCompletionHistory) {
      if (!historyMap.has(row.taskId)) historyMap.set(row.taskId, []);
      historyMap.get(row.taskId)!.push({
        scheduledDate: row.scheduledDate,
        dueDate: row.dueDate,
        completedAt: row.completedAt,
        timeInvestedMs: row.timeInvestedMs,
      });
    }
  } else {
    tagMap = new Map();
    depMap = new Map();
    historyMap = new Map();
  }

  const taskIdSet = new Set(taskIds);
  const flatTasks: (FlatTaskRow & { deletedAt?: string | null })[] = taskRows.map((t) => ({
    id: t.id,
    parentId: t.parentId,
    position: t.position,
    title: t.title,
    completed: t.completed,
    priority: t.priority,
    dueDate: t.dueDate,
    scheduledDate: t.scheduledDate,
    startDate: t.startDate,
    completedDate: t.completedDate,
    createdDate: t.createdDate,
    timeInvestedMs: t.timeInvestedMs,
    timeEstimateMs: t.timeEstimateMs,
    archived: t.archived,
    listId: t.listId,
    recurrenceInterval: t.recurrenceInterval,
    recurrenceFrequency: t.recurrenceFrequency,
    recurrenceDaysOfWeek: t.recurrenceDaysOfWeek,
    tags: tagMap.get(t.id) ?? [],
    dependsOn: depMap.get(t.id) ?? [],
    completionHistory: historyMap.get(t.id) ?? [],
    deletedAt: t.deletedAt?.toISOString() ?? null,
  }));

  // ── Fetch tags ──────────────────────────────────────────────────────
  let tagRows;
  if (since) {
    const sinceDate = new Date(since);
    tagRows = await db
      .select()
      .from(tags)
      .where(and(eq(tags.userId, userId), gt(tags.updatedAt, sinceDate)));
  } else {
    tagRows = await db
      .select()
      .from(tags)
      .where(and(eq(tags.userId, userId), isNull(tags.deletedAt)));
  }

  // Fetch tag-list scoping
  const allTagLists = tagRows.length > 0
    ? await db
        .select()
        .from(tagLists)
        .innerJoin(tags, eq(tags.id, tagLists.tagId))
        .where(eq(tags.userId, userId))
    : [];

  const tagListMap = new Map<string, string[]>();
  for (const row of allTagLists) {
    const tl = row.tag_lists;
    if (!tagListMap.has(tl.tagId)) tagListMap.set(tl.tagId, []);
    tagListMap.get(tl.tagId)!.push(tl.listId);
  }

  const responseTags: (Tag & { deletedAt?: string | null })[] = tagRows.map((t) => ({
    id: t.id,
    name: t.name,
    color: t.color as Tag["color"],
    listIds: tagListMap.get(t.id) ?? [],
    deletedAt: t.deletedAt?.toISOString() ?? null,
  }));

  // ── Fetch lists ─────────────────────────────────────────────────────
  let listRows;
  if (since) {
    const sinceDate = new Date(since);
    listRows = await db
      .select()
      .from(lists)
      .where(and(eq(lists.userId, userId), gt(lists.updatedAt, sinceDate)));
  } else {
    listRows = await db
      .select()
      .from(lists)
      .where(and(eq(lists.userId, userId), isNull(lists.deletedAt)));
  }

  const responseLists: (TaskList & { deletedAt?: string | null })[] = listRows.map((l) => ({
    id: l.id,
    name: l.name,
    color: l.color as TaskList["color"],
    createdDate: l.createdDate,
    deletedAt: l.deletedAt?.toISOString() ?? null,
  }));

  return NextResponse.json({
    tasks: flatTasks,
    tags: responseTags,
    lists: responseLists,
    serverTime: now.toISOString(),
  });
}
