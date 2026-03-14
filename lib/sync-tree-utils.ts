import type { Task, RecurrencePattern, CompletionRecord, DayOfWeek } from "./types";
import { v4 as uuidv4 } from "uuid";

// ── Types for flat DB rows ──────────────────────────────────────────────────

export interface FlatTaskRow {
  id: string;
  parentId: string | null;
  position: number;
  title: string;
  completed: boolean;
  priority: string;
  dueDate: string | null;
  scheduledDate: string | null;
  startDate: string | null;
  completedDate: string | null;
  createdDate: string;
  timeInvestedMs: number;
  timeEstimateMs: number | null;
  archived: boolean;
  listId: string | null;
  recurrenceInterval: string | null;
  recurrenceFrequency: number | null;
  recurrenceDaysOfWeek: string | null; // JSON-encoded DayOfWeek[]
  tags: string[];
  dependsOn: string[];
  completionHistory: CompletionRecord[];
}

// ── Flatten: client tree → DB rows ──────────────────────────────────────────

export function flattenTasksForSync(
  tasks: Task[],
  parentId: string | null = null
): FlatTaskRow[] {
  const rows: FlatTaskRow[] = [];

  tasks.forEach((task, index) => {
    rows.push({
      id: task.id,
      parentId,
      position: index,
      title: task.title,
      completed: task.completed,
      priority: task.priority,
      dueDate: task.dueDate,
      scheduledDate: task.scheduledDate,
      startDate: task.startDate,
      completedDate: task.completedDate,
      createdDate: task.createdDate,
      timeInvestedMs: task.timeInvestedMs,
      timeEstimateMs: task.timeEstimateMs,
      archived: task.archived,
      listId: task.listId ?? null,
      recurrenceInterval: task.recurrence?.interval ?? null,
      recurrenceFrequency: task.recurrence?.frequency ?? null,
      recurrenceDaysOfWeek: task.recurrence?.daysOfWeek
        ? JSON.stringify(task.recurrence.daysOfWeek)
        : null,
      tags: task.tags ?? [],
      dependsOn: task.dependsOn ?? [],
      completionHistory: task.completionHistory ?? [],
    });

    if (task.children.length > 0) {
      rows.push(...flattenTasksForSync(task.children, task.id));
    }
  });

  return rows;
}

// ── Build: DB rows → client tree ────────────────────────────────────────────

export function buildTaskTreeFromRows(rows: FlatTaskRow[]): Task[] {
  // Build a map of id → Task (without children populated yet)
  const taskMap = new Map<string, Task>();
  const childrenMap = new Map<string, FlatTaskRow[]>(); // parentId → sorted child rows

  for (const row of rows) {
    const parentId = row.parentId ?? "__root__";
    if (!childrenMap.has(parentId)) {
      childrenMap.set(parentId, []);
    }
    childrenMap.get(parentId)!.push(row);
  }

  // Sort each group by position
  for (const [, children] of childrenMap) {
    children.sort((a, b) => a.position - b.position);
  }

  // Convert a FlatTaskRow to a Task (without children — those get assembled below)
  function rowToTask(row: FlatTaskRow): Task {
    const recurrence: RecurrencePattern | undefined = row.recurrenceInterval
      ? {
          interval: row.recurrenceInterval as RecurrencePattern["interval"],
          frequency: row.recurrenceFrequency ?? undefined,
          daysOfWeek: row.recurrenceDaysOfWeek
            ? (JSON.parse(row.recurrenceDaysOfWeek) as DayOfWeek[])
            : undefined,
        }
      : undefined;

    const task: Task = {
      id: row.id,
      title: row.title,
      completed: row.completed,
      priority: row.priority as Task["priority"],
      dueDate: row.dueDate,
      scheduledDate: row.scheduledDate,
      startDate: row.startDate,
      completedDate: row.completedDate,
      createdDate: row.createdDate,
      children: [],
      timeInvestedMs: row.timeInvestedMs,
      timeEstimateMs: row.timeEstimateMs,
      archived: row.archived,
      listId: row.listId ?? undefined,
      tags: row.tags.length > 0 ? row.tags : undefined,
      dependsOn: row.dependsOn.length > 0 ? row.dependsOn : undefined,
      recurrence,
      completionHistory:
        recurrence || row.completionHistory.length > 0
          ? row.completionHistory
          : undefined,
    };

    return task;
  }

  // Recursively build the tree
  function buildChildren(parentId: string): Task[] {
    const childRows = childrenMap.get(parentId) ?? [];
    return childRows.map((row) => {
      const task = rowToTask(row);
      task.children = buildChildren(row.id);
      return task;
    });
  }

  return buildChildren("__root__");
}

// ── Helpers for extracting junction data from flat rows ─────────────────────

export interface SyncJunctionData {
  taskTags: { taskId: string; tagId: string }[];
  taskDependencies: { taskId: string; dependsOnId: string }[];
  completionHistory: {
    id: string;
    taskId: string;
    scheduledDate: string | null;
    dueDate: string | null;
    completedAt: string;
    timeInvestedMs: number;
  }[];
}

export function extractJunctionData(rows: FlatTaskRow[]): SyncJunctionData {
  const taskTags: SyncJunctionData["taskTags"] = [];
  const taskDependencies: SyncJunctionData["taskDependencies"] = [];
  const completionHistoryRows: SyncJunctionData["completionHistory"] = [];

  for (const row of rows) {
    for (const tagId of row.tags) {
      taskTags.push({ taskId: row.id, tagId });
    }
    for (const depId of row.dependsOn) {
      taskDependencies.push({ taskId: row.id, dependsOnId: depId });
    }
    for (const record of row.completionHistory) {
      completionHistoryRows.push({
        id: uuidv4(),
        taskId: row.id,
        scheduledDate: record.scheduledDate,
        dueDate: record.dueDate,
        completedAt: record.completedAt,
        timeInvestedMs: record.timeInvestedMs,
      });
    }
  }

  return {
    taskTags,
    taskDependencies,
    completionHistory: completionHistoryRows,
  };
}
