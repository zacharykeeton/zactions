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
        return { timeInvestedMs: 0, ...entry };
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
