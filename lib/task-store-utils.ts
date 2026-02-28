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

/** Recursively set the archived flag on all items and their children. */
export function setArchivedDeep(items: Task[], archived: boolean): Task[] {
  return items.map((item) => ({
    ...item,
    archived,
    children: setArchivedDeep(item.children, archived),
  }));
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
