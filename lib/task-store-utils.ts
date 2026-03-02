import type { Task, CompletionRecord } from "./types";

/** Migrate legacy completionHistory entries from string[] to CompletionRecord[]. */
export function migrateTask(task: Task): Task {
  let completionHistory = task.completionHistory;
  if (completionHistory && completionHistory.length > 0) {
    completionHistory = (completionHistory as unknown as Array<string | CompletionRecord>).map(
      (entry): CompletionRecord => {
        if (typeof entry === "string") {
          return { scheduledDate: null, dueDate: null, completedAt: entry, timeInvestedMs: 0 };
        }
        return { ...entry, timeInvestedMs: entry.timeInvestedMs ?? 0 };
      }
    );
  }

  return {
    ...task,
    startDate: task.startDate ?? null,
    timeInvestedMs: task.timeInvestedMs ?? 0,
    timeEstimateMs: task.timeEstimateMs ?? null,
    archived: task.archived ?? false,
    completionHistory,
    children: task.children.map(migrateTask),
  };
}

/** Recursively strip a deleted task's ID from all dependsOn arrays. */
export function removeDependencyRef(items: Task[], depId: string): Task[] {
  return items.map((item) => {
    const newDeps = item.dependsOn?.filter((id) => id !== depId);
    return {
      ...item,
      dependsOn: newDeps && newDeps.length > 0 ? newDeps : undefined,
      children: removeDependencyRef(item.children, depId),
    };
  });
}

/** Recursively reset children to incomplete for recurring-task cycle resets.
 *  - Completed children that lack completionHistory (first cycle) get a
 *    fallback CompletionRecord so no data is lost.
 *  - All children get completionHistory initialised to [] (if absent) so
 *    future completions can be recorded at toggle time.
 */
export function resetChildrenDeep(items: Task[]): Task[] {
  return items.map((item) => {
    // First-cycle fallback: child was completed but didn't have
    // completionHistory initialised yet, so the toggle couldn't record it.
    const needsFallback =
      item.completed && item.completedDate && !item.completionHistory;
    const newHistory = needsFallback
      ? [{
          scheduledDate: item.scheduledDate,
          dueDate: item.dueDate,
          completedAt: item.completedDate!,
          timeInvestedMs: item.timeInvestedMs,
        }]
      : (item.completionHistory ?? []);

    return {
      ...item,
      completed: false,
      completedDate: null,
      timeInvestedMs: 0,
      completionHistory: newHistory,
      children: resetChildrenDeep(item.children),
    };
  });
}

const MS_PER_DAY = 86_400_000;

/** Compute the number of days between two YYYY-MM-DD date strings using UTC midnights. */
export function daysBetweenDates(from: string, to: string): number {
  const f = new Date(from + "T00:00:00Z").getTime();
  const t = new Date(to + "T00:00:00Z").getTime();
  return Math.round((t - f) / MS_PER_DAY);
}

/** Shift a YYYY-MM-DD date string by `deltaDays` days. */
function shiftDate(dateStr: string, deltaDays: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + deltaDays);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Recursively shift dueDate, scheduledDate, and startDate on all items by `deltaDays`. */
export function shiftDatesDeep(items: Task[], deltaDays: number): Task[] {
  if (deltaDays === 0) return items;
  return items.map((item) => ({
    ...item,
    dueDate: item.dueDate ? shiftDate(item.dueDate, deltaDays) : null,
    scheduledDate: item.scheduledDate ? shiftDate(item.scheduledDate, deltaDays) : null,
    startDate: item.startDate ? shiftDate(item.startDate, deltaDays) : null,
    children: shiftDatesDeep(item.children, deltaDays),
  }));
}

/** Recursively set the archived flag on all items and their children. */
export function setArchivedDeep(items: Task[], archived: boolean): Task[] {
  return items.map((item) => ({
    ...item,
    archived,
    children: setArchivedDeep(item.children, archived),
  }));
}

/**
 * Merge a reordered subset of tasks back into the full task tree.
 *
 * When viewing a filtered list, the UI only passes the visible (reordered)
 * tasks.  This function preserves tasks from other lists and reinserts
 * archived tasks that were stripped before the UI received the tree.
 */
export function mergeReorderedTasks(prev: Task[], reorderedActiveTasks: Task[]): Task[] {
  // 1. Collect archived tasks from previous state, keyed by parent ID.
  const archivedByParent = new Map<string | null, Task[]>();
  function collectArchived(items: Task[], parentId: string | null) {
    for (const item of items) {
      if (item.archived) {
        const list = archivedByParent.get(parentId) || [];
        list.push(item);
        archivedByParent.set(parentId, list);
      } else {
        collectArchived(item.children, item.id);
      }
    }
  }
  collectArchived(prev, null);

  // 2. Collect all IDs present in the reordered tree so we can
  //    identify root-level tasks from other lists that weren't included.
  const reorderedIds = new Set<string>();
  function collectIds(items: Task[]) {
    for (const item of items) {
      reorderedIds.add(item.id);
      collectIds(item.children);
    }
  }
  collectIds(reorderedActiveTasks);

  // 3. Preserve non-archived root-level tasks from prev that aren't
  //    in the reordered set (i.e., tasks from other lists).
  const preservedTasks: Task[] = [];
  for (const task of prev) {
    if (!task.archived && !reorderedIds.has(task.id)) {
      preservedTasks.push(task);
    }
  }

  // 4. Reinsert archived tasks at their original parent positions.
  function reinsert(items: Task[], parentId: string | null): Task[] {
    const result = items.map((item) => ({
      ...item,
      children: reinsert(item.children, item.id),
    }));
    const archived = archivedByParent.get(parentId);
    if (archived) result.push(...archived);
    return result;
  }

  return [...reinsert(reorderedActiveTasks, null), ...preservedTasks];
}

/** Find a task by ID and set archived on it + all children. */
export function setArchivedOnTask(items: Task[], id: string, archived: boolean): Task[] {
  return items.map((item) => {
    if (item.id === id) {
      return {
        ...item,
        archived,
        children: setArchivedDeep(item.children, archived),
      };
    }
    if (item.children.length > 0) {
      return { ...item, children: setArchivedOnTask(item.children, id, archived) };
    }
    return item;
  });
}
